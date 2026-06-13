//! # tessera-vault
//!
//! Tessera lending vault as an Arbitrum Stylus contract.
//!
//! Architecture (per `TDD.md` §3):
//!
//! - **Lender side (ERC-4626 on USDC)** — depositors supply USDC, receive
//!   shares that compound as borrowers pay interest.
//! - **Borrower side** — users deposit whitelisted tStock tokens as
//!   collateral and borrow USDC against them, gated by per-asset LTV.
//! - **Liquidation** — agent-only entrypoint that partially closes
//!   undercollateralised positions per the close-factor / bonus math in
//!   `interest_model::compute_liquidation`.
//! - **Interest** — single global borrow index, accrued lazily on every
//!   state-mutating call.
//!
//! All math comes from the `interest_model` crate; this crate owns the
//! storage, the access-control surface, and the external-call wiring.

#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]
// Stylus's proc-macros emit `cfg(feature = "contract-client-gen")` checks for
// the future client-generation feature; we don't expose it yet.
#![allow(unexpected_cfgs)]
// Wildcard imports are idiomatic in Stylus contracts (prelude + sol! glob
// re-exports). The clippy lint flags them at pedantic level; we explicitly
// accept it for parity with the official examples.
#![allow(clippy::wildcard_imports)]

extern crate alloc;

use alloc::{vec, vec::Vec};

use alloy_primitives::{Address, FixedBytes, U256, U64};
use interest_model::{
    collateral_value_usd_8, compute_liquidation, health_factor, supply_rate_bps, CollateralLeg,
    WAD,
};
use stylus_sdk::prelude::*;

/// Ceiling for the depth-based Dutch-auction liquidation bonus (Phase 4). The
/// per-asset `liq_bonus_bps` is the floor; the effective bonus ramps up to this
/// as a position sinks toward HF 0.90. 15% covers thin-market slippage on
/// tokenized equities without being predatory.
const MAX_LIQ_BONUS_BPS: u32 = 1_500;

/// Hard ceiling on the max borrow APR (base + slope1 + slope2, reached at 100%
/// utilization). 300% — even a timelocked misconfig can't produce an absurd,
/// position-destroying rate. (Phase 6.1)
const MAX_BORROW_RATE_BPS: u32 = 30_000;

/// Bank-run buffer (Phase 6.5): a borrow may not push utilization above this, so
/// a withdrawal buffer of idle USDC always remains for lenders. 9500 = 95%.
const MAX_UTIL_BPS: u64 = 9_500;

/// Market-closed borrowing-power haircut (Phase 5): while PriceGuard reports the
/// underlying market closed, new borrows get this fraction of normal LTV — 24/7
/// borrowing stays available, with weekend/holiday gap-risk priced in. 8500 = 85%.
const MARKET_CLOSED_LTV_BPS: u64 = 8_500;

pub mod errors;
pub mod events;
pub mod interest;
pub mod oracle;
pub mod storage;
pub mod token;

use crate::errors::*;
use crate::events::*;
use crate::storage::{CollateralBook, Config, DebtBook, InterestState, LendingPool, PauseState};

// ---------- Storage root ----------

#[entrypoint]
#[storage]
pub struct TesseraVault {
    pub config: Config,
    pub lending: LendingPool,
    pub collateral: CollateralBook,
    pub debt: DebtBook,
    pub interest: InterestState,
    pub pause: PauseState,
}

// Param keys for `ParamUpdate` events. Indexed `bytes32` so off-chain
// consumers can filter by key.
fn key(name: &[u8]) -> FixedBytes<32> {
    let mut k = [0u8; 32];
    let n = name.len().min(32);
    k[..n].copy_from_slice(&name[..n]);
    FixedBytes::from(k)
}

/// `num / den`, truncating (round down). `den` is always non-zero at call sites
/// (virtual shares/assets guarantee it), but we guard defensively.
fn mul_div_down(num: U256, den: U256) -> U256 {
    num.checked_div(den).unwrap_or(U256::ZERO)
}

/// `num / den`, rounding up.
fn mul_div_up(num: U256, den: U256) -> U256 {
    let q = num.checked_div(den).unwrap_or(U256::ZERO);
    let r = num.checked_rem(den).unwrap_or(U256::ZERO);
    if r.is_zero() {
        q
    } else {
        q.saturating_add(U256::from(1u64))
    }
}

// pow10_u256 / normalize_price_8 moved to the PriceGuard contract (Phase 5).

// ---------- Internal helpers ----------

impl TesseraVault {
    fn only_owner(&self) -> Result<(), VaultError> {
        let owner = self.config.owner.get();
        if owner == Address::ZERO {
            // Uninitialised contract is owned by no one; nothing is callable
            // through admin until `initialize` runs.
            return Err(VaultError::NotOwner(NotOwner {}));
        }
        if self.vm().msg_sender() != owner {
            return Err(VaultError::NotOwner(NotOwner {}));
        }
        Ok(())
    }

    fn only_agent(&self) -> Result<(), VaultError> {
        let agent = self.config.agent.get();
        if self.vm().msg_sender() != agent || agent == Address::ZERO {
            return Err(VaultError::NotAgent(NotAgent {}));
        }
        Ok(())
    }

    /// Enforce the on-chain per-(user, UTC-day) auto-repay ceiling and return the
    /// amount the agent is allowed to repay this call. `max == 0` disables the cap.
    fn charge_daily_repay(&mut self, user: Address, amount: U256) -> Result<U256, VaultError> {
        let max = self.config.max_agent_repay_per_day.get();
        if max.is_zero() {
            return Ok(amount);
        }
        let day = U64::from(self.now_ts() / 86_400);
        let last_day = self.debt.agent_repaid_day.get(user);
        let used = if last_day == day {
            self.debt.agent_repaid_today.get(user)
        } else {
            U256::ZERO
        };
        if used >= max {
            return Err(VaultError::InvalidParameter(InvalidParameter {}));
        }
        let remaining = max - used;
        let capped = core::cmp::min(amount, remaining);
        if capped.is_zero() {
            return Err(VaultError::InvalidParameter(InvalidParameter {}));
        }
        self.debt.agent_repaid_day.setter(user).set(day);
        self.debt
            .agent_repaid_today
            .setter(user)
            .set(used.saturating_add(capped));
        Ok(capped)
    }

    fn check_not_paused(&self) -> Result<(), VaultError> {
        if self.pause.paused.get() {
            return Err(VaultError::Paused(Paused {}));
        }
        Ok(())
    }

    fn lock_reentrancy(&mut self) -> Result<(), VaultError> {
        if self.pause.entered.get() {
            return Err(VaultError::Reentrancy(Reentrancy {}));
        }
        self.pause.entered.set(true);
        Ok(())
    }

    fn unlock_reentrancy(&mut self) {
        self.pause.entered.set(false);
    }

    fn now_ts(&self) -> u64 {
        self.vm().block_timestamp()
    }

    fn accrue(&mut self) {
        let now = self.now_ts();
        let (dt, rate, new_idx) =
            interest::roll_index(&mut self.interest, &mut self.lending, now);
        if dt > 0 {
            self.vm().log(interest::accrue_event(dt, rate, new_idx));
        }
    }

    fn require_asset(&self, asset: Address) -> Result<(), VaultError> {
        if !self.config.asset_whitelist.get(asset).enabled.get() {
            return Err(VaultError::AssetNotEnabled(AssetNotEnabled { asset }));
        }
        Ok(())
    }

    fn oracle_price(&mut self, asset: Address) -> Result<U256, VaultError> {
        // Read through the PriceGuard router (Phase 5): it enforces staleness, the
        // dual-feed deviation guard, and decimal normalization, returning a
        // validated 8dp price (or reverting). `config.oracle` is the PriceGuard
        // address. Moving this logic out of the vault is what keeps the core under
        // the 24KB code-size ceiling.
        let guard = self.config.oracle.get();
        let pg = oracle::IPriceGuard::new(guard);
        let cfg = Call::new_mutating(self);
        pg.get_price(self.vm(), cfg, asset)
            .map_err(|_| VaultError::OracleFailure(OracleFailure { asset }))
    }

    /// PriceGuard's halt flag (circuit breaker): when true, NEW risk is blocked.
    fn oracle_halted(&mut self) -> bool {
        let pg = oracle::IPriceGuard::new(self.config.oracle.get());
        pg.halted(self.vm(), Call::new()).unwrap_or(false)
    }

    /// PriceGuard's market-closed flag: when true, new borrows are haircut.
    fn oracle_market_closed(&mut self) -> bool {
        let pg = oracle::IPriceGuard::new(self.config.oracle.get());
        pg.market_closed(self.vm(), Call::new()).unwrap_or(false)
    }

    /// Aggregate the user's collateral into the legs the interest-model needs,
    /// returning the `1e8`-scaled USD value already weighted by each asset's
    /// liquidation threshold.
    fn collateral_legs(&mut self, user: Address) -> Result<U256, VaultError> {
        self.collateral_legs_weighted(user, false)
    }

    /// Aggregate the user's collateral, weighted by either each asset's
    /// liquidation threshold (`use_max_ltv == false`, for HF) or its max LTV
    /// (`use_max_ltv == true`, for the stricter borrow-open gate). The
    /// `liq_threshold_bps` field of `CollateralLeg` is just the weight applied by
    /// `collateral_value_usd_8`, so passing `max_ltv_bps` there yields the
    /// max-LTV-weighted value.
    fn collateral_legs_weighted(&mut self, user: Address, use_max_ltv: bool) -> Result<U256, VaultError> {
        let n = self.config.listed_assets.len();
        let mut legs: Vec<CollateralLeg> = Vec::new();
        for i in 0..n {
            let Some(token) = self.config.listed_assets.get(i) else {
                continue;
            };
            if !self.collateral.has_deposited.get(user).get(token) {
                continue;
            }
            let amount = self.collateral.deposits.get(user).get(token);
            if amount.is_zero() {
                continue;
            }
            let params = self.config.asset_whitelist.get(token);
            if !params.enabled.get() {
                // Disabled (delisted) assets are valued at zero. Note: a *frozen*
                // asset stays enabled, so existing collateral keeps its value —
                // a freeze only blocks new deposits (see deposit_collateral).
                continue;
            }
            let decimals = u32::from(params.decimals.get().to::<u8>());
            let weight = if use_max_ltv {
                u32::from(params.max_ltv_bps.get().to::<u16>())
            } else {
                u32::from(params.liq_threshold_bps.get().to::<u16>())
            };
            let price = self.oracle_price(token)?;
            legs.push(CollateralLeg {
                amount,
                decimals,
                price_usd_8: price,
                liq_threshold_bps: weight,
            });
        }
        Ok(collateral_value_usd_8(&legs))
    }

    /// Current debt in USDC (6-decimal) units.
    fn user_debt(&self, user: Address) -> U256 {
        let principal = self.debt.principal.get(user);
        let snap = self.debt.user_index.get(user);
        interest::debt_of(&self.interest, principal, snap)
    }

    /// Health factor for `user`, scaled by `1e18`.
    fn hf(&mut self, user: Address) -> Result<U256, VaultError> {
        let debt_usdc = self.user_debt(user);
        if debt_usdc.is_zero() {
            return Ok(U256::MAX);
        }
        let coll_usd_8 = self.collateral_legs(user)?;
        // Convert USDC (6dp) → 8dp USD for the ratio. `1 USDC == $1 == 1e8`
        // at 8dp scale, but the debt is in 6dp units, so multiply by 1e2.
        let debt_usd_8 = debt_usdc.saturating_mul(U256::from(100u64));
        Ok(health_factor(coll_usd_8, debt_usd_8))
    }

    /// Total USDC the lender vault represents (idle + outstanding debt at the
    /// current index). ERC-4626's `totalAssets`.
    ///
    /// Outstanding debt is computed EXACTLY as `scaled_total_principal * index /
    /// WAD`, where `scaled_total_principal = Σ principal[u] * WAD / user_index[u]`
    /// (Aave's scaledTotalSupply). This is `Σ debt_of(u)` — no over-count of
    /// accrued interest, so lender share price is correct (invariant I1).
    fn total_assets_internal(&self) -> U256 {
        let idle = self.lending.idle_assets.get();
        let reserve = self.lending.reserve_assets.get();
        let scaled = self.lending.scaled_total_principal.get();
        let total_debt = if scaled.is_zero() {
            U256::ZERO
        } else {
            let idx = interest::current_index(&self.interest);
            scaled
                .saturating_mul(idx)
                .checked_div(U256::from(WAD))
                .unwrap_or(scaled)
        };
        // Lender-facing assets exclude the protocol reserve.
        idle.saturating_add(total_debt).saturating_sub(reserve)
    }

    /// Maintain `scaled_total_principal` across a single user's debt change.
    /// `scaled[u] = principal[u] * WAD / user_index[u]`; we subtract the old
    /// contribution and add the new one. Call AFTER computing the new principal
    /// and the new index (which the user's `user_index` is set to).
    fn apply_scaled_debt(
        &mut self,
        prev_principal: U256,
        prev_index: U256,
        new_principal: U256,
        new_index: U256,
    ) {
        let wad = U256::from(WAD);
        let scaled = |p: U256, i: U256| -> U256 {
            if p.is_zero() || i.is_zero() {
                U256::ZERO
            } else {
                p.saturating_mul(wad).checked_div(i).unwrap_or(U256::ZERO)
            }
        };
        let old_s = scaled(prev_principal, prev_index);
        let new_s = scaled(new_principal, new_index);
        let cur = self.lending.scaled_total_principal.get();
        self.lending
            .scaled_total_principal
            .set(cur.saturating_sub(old_s).saturating_add(new_s));
    }

    // ERC-4626 conversion with OpenZeppelin-style virtual shares/assets
    // (decimals_offset = 6). The virtual buffer makes the classic first-depositor
    // inflation attack economically infeasible: there is no "supply == 0" edge to
    // exploit, and a tiny real supply can no longer round the next depositor to
    // zero shares. shares = assets·(supply + 1e6)/(totalAssets + 1).
    fn convert_to_shares_round_down(&self, assets: U256) -> U256 {
        let num = assets.saturating_mul(self.virtual_supply());
        mul_div_down(num, self.virtual_total_assets())
    }

    fn convert_to_shares_round_up(&self, assets: U256) -> U256 {
        let num = assets.saturating_mul(self.virtual_supply());
        mul_div_up(num, self.virtual_total_assets())
    }

    fn convert_to_assets_round_down(&self, shares: U256) -> U256 {
        let num = shares.saturating_mul(self.virtual_total_assets());
        mul_div_down(num, self.virtual_supply())
    }

    fn convert_to_assets_round_up(&self, shares: U256) -> U256 {
        let num = shares.saturating_mul(self.virtual_total_assets());
        mul_div_up(num, self.virtual_supply())
    }

    /// total_shares + 10^6 virtual shares.
    fn virtual_supply(&self) -> U256 {
        self.lending
            .total_shares
            .get()
            .saturating_add(U256::from(1_000_000u64))
    }

    /// total_assets + 1 virtual asset.
    fn virtual_total_assets(&self) -> U256 {
        self.total_assets_internal().saturating_add(U256::from(1u64))
    }

    /// Repay `amount` of `user`'s debt, pulling USDC from `user`'s allowance to
    /// the vault. Shared by `repay` (msg.sender repays self) and
    /// `agent_repay_for` (agent triggers a protective repay from the user's own
    /// pre-approved USDC). Caller MUST already hold the reentrancy lock.
    fn repay_internal(&mut self, user: Address, amount: U256) -> Result<U256, VaultError> {
        if amount.is_zero() {
            return Err(VaultError::ZeroAmount(ZeroAmount {}));
        }
        self.accrue();
        let cur_debt = self.user_debt(user);
        if cur_debt.is_zero() {
            return Err(VaultError::InsufficientBalance(InsufficientBalance {}));
        }
        let pay = core::cmp::min(amount, cur_debt);
        let new_debt = cur_debt - pay;
        // Min-debt floor (Phase 2.4): a repay may clear the position fully or leave
        // it at/above the floor — never strand a dust position whose liquidation
        // would cost more than its bonus. Repay fully, or repay less.
        let min_debt_floor = self.config.min_debt.get();
        if !new_debt.is_zero() && !min_debt_floor.is_zero() && new_debt < min_debt_floor {
            return Err(VaultError::InvalidParameter(InvalidParameter {}));
        }
        let idx = interest::current_index(&self.interest);

        let prev_principal = self.debt.principal.get(user);
        let prev_index = self.debt.user_index.get(user);
        let total = self.lending.total_principal.get();
        let total_after = total.saturating_sub(prev_principal).saturating_add(new_debt);

        self.debt.principal.setter(user).set(new_debt);
        self.debt.user_index.setter(user).set(idx);
        self.lending.total_principal.set(total_after);
        self.apply_scaled_debt(prev_principal, prev_index, new_debt, idx);
        self.lending
            .idle_assets
            .set(self.lending.idle_assets.get().saturating_add(pay));

        let usdc = self.config.usdc.get();
        self::token::pull(self, usdc, user, pay)?;

        self.vm().log(Repay {
            user,
            amount: pay,
            new_principal: new_debt,
        });
        Ok(new_debt)
    }
}

// ---------- Public entrypoints ----------

#[public]
impl TesseraVault {
    // ===================== Initialization & admin =====================

    /// Constructor (Phase 2.2 — atomic init-hardening). Runs exactly once, AT
    /// DEPLOY, in the same transaction as contract creation — so there is no
    /// separate `initialize` tx for anyone to front-run. The `owner.is_zero()`
    /// guard additionally rejects any direct re-invocation.
    #[constructor]
    pub fn constructor(
        &mut self,
        owner: Address,
        usdc: Address,
        oracle: Address,
        agent: Address,
    ) -> Result<(), VaultError> {
        if !self.config.owner.get().is_zero() {
            return Err(VaultError::NotOwner(NotOwner {}));
        }
        // Init hardening: reject zero for ALL core addresses (was owner/usdc only).
        if owner.is_zero() || usdc.is_zero() || oracle.is_zero() || agent.is_zero() {
            return Err(VaultError::ZeroAddress(ZeroAddress {}));
        }
        self.config.owner.set(owner);
        self.config.usdc.set(usdc);
        self.config.oracle.set(oracle);
        self.config.agent.set(agent);
        // Defaults per TDD §3.4.3 / §3.5.
        self.config.max_price_age_secs.set(U64::from(3600u64));
        self.config.close_factor_bps.set(alloy_primitives::U16::from(5_000u16));
        self.interest.base_rate_bps.set(alloy_primitives::U16::from(200u16));
        self.interest.slope1_bps.set(alloy_primitives::U16::from(400u16));
        self.interest.slope2_bps.set(alloy_primitives::U16::from(6_000u16));
        self.interest.optimal_util_bps.set(alloy_primitives::U16::from(8_000u16));
        // Reserve factor = 15% (the blueprint's number, now real in code). The
        // skim runs in `interest::roll_index`, diverting 15% of accrued interest
        // into the on-chain reserve (first-loss capital + protocol revenue);
        // lenders earn the other 85% via the share price. Adjustable via the
        // (timelocked, Phase 3) `setRateParams`, bounded <= 25%.
        self.interest.reserve_factor_bps.set(alloy_primitives::U16::from(1_500u16));
        // Min-debt floor: 100 USDC. No dust positions whose liquidation would cost
        // more than the bonus. Timelock-adjustable (Phase 3), bounded <= 1000 USDC.
        self.config.min_debt.set(U256::from(100_000_000u64)); // 100e6
        self.interest.borrow_index.set(U256::from(WAD));
        self.interest.last_accrual_ts.set(U64::from(self.vm().block_timestamp()));
        self.vm().log(OwnershipTransferred {
            previous_owner: Address::ZERO,
            new_owner: owner,
        });
        self.vm().log(OracleSet {
            old_oracle: Address::ZERO,
            new_oracle: oracle,
        });
        self.vm().log(AgentSet {
            old_agent: Address::ZERO,
            new_agent: agent,
        });
        Ok(())
    }

    pub fn owner(&self) -> Address {
        self.config.owner.get()
    }
    pub fn agent(&self) -> Address {
        self.config.agent.get()
    }
    pub fn oracle(&self) -> Address {
        self.config.oracle.get()
    }
    pub fn usdc(&self) -> Address {
        self.config.usdc.get()
    }
    pub fn paused(&self) -> bool {
        self.pause.paused.get()
    }
    pub fn max_price_age(&self) -> U64 {
        self.config.max_price_age_secs.get()
    }
    pub fn close_factor_bps(&self) -> u16 {
        self.config.close_factor_bps.get().to::<u16>()
    }

    pub fn transfer_ownership(&mut self, new_owner: Address) -> Result<(), VaultError> {
        self.only_owner()?;
        if new_owner.is_zero() {
            return Err(VaultError::ZeroAddress(ZeroAddress {}));
        }
        // Two-step (OZ Ownable2Step semantics): set the PENDING owner; ownership
        // only moves once `new_owner` calls accept_ownership. No one-step,
        // irreversible handoff to a wrong/dead address (typo, un-spendable multisig).
        self.config.pending_owner.set(new_owner);
        self.vm().log(OwnershipTransferStarted {
            previous_owner: self.config.owner.get(),
            new_owner,
        });
        Ok(())
    }

    /// Second step of ownership transfer: the pending owner claims ownership.
    #[selector(name = "acceptOwnership")]
    pub fn accept_ownership(&mut self) -> Result<(), VaultError> {
        let pending = self.config.pending_owner.get();
        if pending.is_zero() || self.vm().msg_sender() != pending {
            return Err(VaultError::NotOwner(NotOwner {}));
        }
        let old = self.config.owner.get();
        self.config.owner.set(pending);
        self.config.pending_owner.set(Address::ZERO);
        self.vm().log(OwnershipTransferred {
            previous_owner: old,
            new_owner: pending,
        });
        Ok(())
    }

    #[selector(name = "pendingOwner")]
    pub fn pending_owner(&self) -> Address {
        self.config.pending_owner.get()
    }

    /// Owner (timelock): set the guardian — a role whose ONLY power is `pause`.
    /// address(0) disables it.
    #[selector(name = "setGuardian")]
    pub fn set_guardian(&mut self, guardian: Address) -> Result<(), VaultError> {
        self.only_owner()?;
        self.config.guardian.set(guardian);
        self.vm().log(GuardianSet { guardian });
        Ok(())
    }

    #[selector(name = "guardian")]
    pub fn guardian(&self) -> Address {
        self.config.guardian.get()
    }

    pub fn set_oracle(&mut self, new_oracle: Address) -> Result<(), VaultError> {
        self.only_owner()?;
        if new_oracle.is_zero() {
            return Err(VaultError::ZeroAddress(ZeroAddress {}));
        }
        let old = self.config.oracle.get();
        self.config.oracle.set(new_oracle);
        self.vm().log(OracleSet {
            old_oracle: old,
            new_oracle,
        });
        Ok(())
    }

    pub fn set_agent(&mut self, new_agent: Address) -> Result<(), VaultError> {
        self.only_owner()?;
        let old = self.config.agent.get();
        self.config.agent.set(new_agent);
        self.vm().log(AgentSet {
            old_agent: old,
            new_agent,
        });
        Ok(())
    }

    pub fn set_max_price_age(&mut self, secs: U64) -> Result<(), VaultError> {
        self.only_owner()?;
        if secs == U64::ZERO {
            return Err(VaultError::InvalidParameter(InvalidParameter {}));
        }
        self.config.max_price_age_secs.set(secs);
        self.vm().log(ParamUpdate {
            key: key(b"max_price_age"),
            value: U256::from(secs.to::<u64>()),
        });
        Ok(())
    }

    pub fn set_close_factor(&mut self, bps: u16) -> Result<(), VaultError> {
        self.only_owner()?;
        if bps == 0 || bps > 10_000 {
            return Err(VaultError::InvalidParameter(InvalidParameter {}));
        }
        self.config.close_factor_bps.set(alloy_primitives::U16::from(bps));
        self.vm().log(ParamUpdate {
            key: key(b"close_factor_bps"),
            value: U256::from(bps),
        });
        Ok(())
    }

    /// Owner (timelock at mainnet): move accrued protocol reserve to the treasury
    /// `to`. The reserve is the protocol's cut of interest and the first-loss
    /// buffer; withdrawing it does NOT change lender share price (already excluded
    /// from `total_assets`) but is bounded by both the reserve balance and the
    /// idle USDC available, so it can never tap lender liquidity.
    #[selector(name = "withdrawReserves")]
    pub fn withdraw_reserves(&mut self, to: Address, amount: U256) -> Result<(), VaultError> {
        self.lock_reentrancy()?;
        let r = (|| -> Result<(), VaultError> {
            self.only_owner()?;
            if to.is_zero() {
                return Err(VaultError::ZeroAddress(ZeroAddress {}));
            }
            if amount.is_zero() {
                return Err(VaultError::ZeroAmount(ZeroAmount {}));
            }
            let reserve = self.lending.reserve_assets.get();
            if amount > reserve {
                return Err(VaultError::InsufficientBalance(InsufficientBalance {}));
            }
            let idle = self.lending.idle_assets.get();
            if amount > idle {
                return Err(VaultError::InsufficientLiquidity(InsufficientLiquidity {}));
            }
            // Effects before interaction.
            self.lending.reserve_assets.set(reserve - amount);
            self.lending.idle_assets.set(idle - amount);
            let usdc = self.config.usdc.get();
            self::token::push(self, usdc, to, amount)?;
            self.vm().log(ReservesWithdrawn { to, amount });
            Ok(())
        })();
        self.unlock_reentrancy();
        r
    }

    /// Owner (timelock): minimum per-user debt (USDC, 6dp). Bounded <= 1000 USDC
    /// so it can't lock ordinary borrowers out. 0 disables the floor.
    #[selector(name = "setMinDebt")]
    pub fn set_min_debt(&mut self, amount: U256) -> Result<(), VaultError> {
        self.only_owner()?;
        if amount > U256::from(1_000_000_000u64) {
            return Err(VaultError::InvalidParameter(InvalidParameter {}));
        }
        self.config.min_debt.set(amount);
        self.vm().log(ParamUpdate { key: key(b"min_debt"), value: amount });
        Ok(())
    }

    /// Owner (timelock): global borrow cap (USDC, 6dp). 0 = uncapped.
    #[selector(name = "setBorrowCap")]
    pub fn set_borrow_cap(&mut self, amount: U256) -> Result<(), VaultError> {
        self.only_owner()?;
        self.config.borrow_cap.set(amount);
        self.vm().log(ParamUpdate { key: key(b"borrow_cap"), value: amount });
        Ok(())
    }

    /// Owner (timelock): per-asset supply cap (collateral token units). 0 =
    /// uncapped. The asset must already be listed.
    #[selector(name = "setSupplyCap")]
    pub fn set_supply_cap(&mut self, token: Address, cap: U256) -> Result<(), VaultError> {
        self.only_owner()?;
        if self.config.asset_whitelist.get(token).decimals.get().is_zero() {
            return Err(VaultError::AssetNotEnabled(AssetNotEnabled { asset: token }));
        }
        self.config.asset_whitelist.setter(token).supply_cap.set(cap);
        Ok(())
    }

    pub fn set_rate_params(
        &mut self,
        base: u16,
        slope1: u16,
        slope2: u16,
        optimal: u16,
        reserve_factor: u16,
    ) -> Result<(), VaultError> {
        self.only_owner()?;
        // Reserve factor capped at 25% — even a (timelocked) misconfig can't
        // starve lenders of most of the interest they're owed.
        if optimal == 0 || optimal > 10_000 || reserve_factor > 2_500 {
            return Err(VaultError::InvalidParameter(InvalidParameter {}));
        }
        // Rate ceiling (Phase 6.1): the max borrow APR (at 100% utilization) is
        // base + slope1 + slope2 — cap it so no misconfig can produce an absurd rate.
        if u32::from(base) + u32::from(slope1) + u32::from(slope2) > MAX_BORROW_RATE_BPS {
            return Err(VaultError::InvalidParameter(InvalidParameter {}));
        }
        // Accrue under the old curve before installing the new one.
        self.accrue();
        self.interest.base_rate_bps.set(alloy_primitives::U16::from(base));
        self.interest.slope1_bps.set(alloy_primitives::U16::from(slope1));
        self.interest.slope2_bps.set(alloy_primitives::U16::from(slope2));
        self.interest.optimal_util_bps.set(alloy_primitives::U16::from(optimal));
        self.interest
            .reserve_factor_bps
            .set(alloy_primitives::U16::from(reserve_factor));
        self.vm().log(ParamUpdate {
            key: key(b"base_rate_bps"),
            value: U256::from(base),
        });
        self.vm().log(ParamUpdate {
            key: key(b"slope1_bps"),
            value: U256::from(slope1),
        });
        self.vm().log(ParamUpdate {
            key: key(b"slope2_bps"),
            value: U256::from(slope2),
        });
        self.vm().log(ParamUpdate {
            key: key(b"optimal_util_bps"),
            value: U256::from(optimal),
        });
        self.vm().log(ParamUpdate {
            key: key(b"reserve_factor_bps"),
            value: U256::from(reserve_factor),
        });
        Ok(())
    }

    pub fn list_collateral(
        &mut self,
        token: Address,
        max_ltv_bps: u16,
        liq_threshold_bps: u16,
        liq_bonus_bps: u16,
        decimals: u8,
    ) -> Result<(), VaultError> {
        self.only_owner()?;
        if token.is_zero() {
            return Err(VaultError::ZeroAddress(ZeroAddress {}));
        }
        if max_ltv_bps == 0
            || max_ltv_bps > liq_threshold_bps
            || liq_threshold_bps > 10_000
            || liq_bonus_bps > 5_000
            || (decimals != 6 && decimals != 18)
        {
            return Err(VaultError::InvalidParameter(InvalidParameter {}));
        }
        let already = {
            let p = self.config.asset_whitelist.get(token);
            // We treat "decimals already set" as "already listed".
            !p.decimals.get().is_zero() || p.enabled.get()
        };
        // Decimals are IMMUTABLE once listed. Live positions' balances are scaled
        // by this value, so changing it (e.g. 18 -> 6) would silently mis-account
        // every holder by 10^12. Re-listing may update risk params; never decimals.
        if already {
            let stored = self.config.asset_whitelist.get(token).decimals.get().to::<u8>();
            if stored != decimals {
                return Err(VaultError::InvalidParameter(InvalidParameter {}));
            }
        }
        let mut p = self.config.asset_whitelist.setter(token);
        p.enabled.set(true);
        p.decimals.set(alloy_primitives::U8::from(decimals));
        p.max_ltv_bps.set(alloy_primitives::U16::from(max_ltv_bps));
        p.liq_threshold_bps
            .set(alloy_primitives::U16::from(liq_threshold_bps));
        p.liq_bonus_bps
            .set(alloy_primitives::U16::from(liq_bonus_bps));
        let _ = p;
        if !already {
            self.config.listed_assets.push(token);
        }
        self.vm().log(AssetConfigured {
            token,
            max_ltv_bps,
            liq_threshold_bps,
            liq_bonus_bps,
            decimals,
        });
        Ok(())
    }

    pub fn set_asset_enabled(&mut self, token: Address, enabled: bool) -> Result<(), VaultError> {
        self.only_owner()?;
        let mut p = self.config.asset_whitelist.setter(token);
        if p.decimals.get().is_zero() {
            return Err(VaultError::AssetNotEnabled(AssetNotEnabled { asset: token }));
        }
        p.enabled.set(enabled);
        Ok(())
    }

    /// Freeze/unfreeze an asset: a frozen asset accepts no new collateral but
    /// keeps valuing existing positions (surgical circuit breaker for one feed).
    #[selector(name = "setAssetFrozen")]
    pub fn set_asset_frozen(&mut self, token: Address, frozen: bool) -> Result<(), VaultError> {
        self.only_owner()?;
        let mut p = self.config.asset_whitelist.setter(token);
        if p.decimals.get().is_zero() {
            return Err(VaultError::AssetNotEnabled(AssetNotEnabled { asset: token }));
        }
        p.frozen.set(frozen);
        Ok(())
    }

    /// Record an asset's price-feed decimals (for mainnet Chainlink feeds that
    /// aren't 8-decimal). Reads are normalised to 8dp; 0 means 8 (default).
    #[selector(name = "setFeedDecimals")]
    pub fn set_feed_decimals(&mut self, token: Address, feed_decimals: u8) -> Result<(), VaultError> {
        self.only_owner()?;
        if feed_decimals > 36 {
            return Err(VaultError::InvalidParameter(InvalidParameter {}));
        }
        let mut p = self.config.asset_whitelist.setter(token);
        if p.decimals.get().is_zero() {
            return Err(VaultError::AssetNotEnabled(AssetNotEnabled { asset: token }));
        }
        p.feed_decimals.set(alloy_primitives::U8::from(feed_decimals));
        Ok(())
    }

    /// Per-(user, day) cap on agent auto-repay, in USDC (6dp). 0 = unlimited.
    #[selector(name = "setMaxAgentRepayPerDay")]
    pub fn set_max_agent_repay_per_day(&mut self, amount: U256) -> Result<(), VaultError> {
        self.only_owner()?;
        self.config.max_agent_repay_per_day.set(amount);
        Ok(())
    }

    /// Agent liveness ping. Lets the agent prove it is alive on idle ticks (no
    /// liquidation to perform), so the permissionless backstop only opens on a
    /// REAL outage, not normal quiet. Agent-only.
    #[selector(name = "heartbeat")]
    pub fn heartbeat(&mut self) -> Result<(), VaultError> {
        self.only_agent()?;
        self.config.agent_last_heartbeat.set(U64::from(self.now_ts()));
        Ok(())
    }

    /// Owner: permissionless-liquidation backstop delay (seconds). 0 disables it
    /// (agent-only — the MVP/testnet default); turned on at the audited mainnet build.
    #[selector(name = "setBackstopDelay")]
    pub fn set_backstop_delay(&mut self, secs: U64) -> Result<(), VaultError> {
        self.only_owner()?;
        // Stamp the heartbeat when ENABLING the backstop (from disabled). Without
        // a prior agent tick `agent_last_heartbeat` can be 0, so `now - 0 > delay`
        // would be true immediately — opening every position to permissionless
        // liquidation the instant the delay is set. Stamping now gives the agent a
        // full `secs` grace window before the dead-man's switch can fire.
        let was_disabled = self.config.backstop_delay_secs.get().is_zero();
        if !secs.is_zero() && was_disabled {
            self.config.agent_last_heartbeat.set(U64::from(self.now_ts()));
        }
        self.config.backstop_delay_secs.set(secs);
        Ok(())
    }

    /// Owner: configure the dual-oracle deviation guard. `secondary == address(0)`
    /// or `max_deviation_bps == 0` disables it (the MVP/testnet default ⇒ no-op).
    #[selector(name = "setDeviationGuard")]
    pub fn set_deviation_guard(
        &mut self,
        secondary: Address,
        max_deviation_bps: u16,
    ) -> Result<(), VaultError> {
        self.only_owner()?;
        self.config.secondary_oracle.set(secondary);
        self.config
            .max_deviation_bps
            .set(alloy_primitives::U16::from(max_deviation_bps));
        Ok(())
    }


    pub fn pause(&mut self) -> Result<(), VaultError> {
        // Pause is the one INSTANT power, held by the owner (timelock) AND a
        // guardian whose ONLY ability is to pause — safety fast. Unpause and every
        // parameter change stay owner/timelock-gated — theft slow.
        let sender = self.vm().msg_sender();
        let guardian = self.config.guardian.get();
        let allowed =
            sender == self.config.owner.get() || (!guardian.is_zero() && sender == guardian);
        if !allowed {
            return Err(VaultError::NotOwner(NotOwner {}));
        }
        if self.pause.paused.get() {
            return Ok(());
        }
        self.pause.paused.set(true);
        self.vm().log(PausedSet { by: sender, paused: true });
        Ok(())
    }

    pub fn unpause(&mut self) -> Result<(), VaultError> {
        self.only_owner()?;
        if !self.pause.paused.get() {
            return Err(VaultError::NotPaused(NotPaused {}));
        }
        self.pause.paused.set(false);
        self.vm().log(PausedSet {
            by: self.vm().msg_sender(),
            paused: false,
        });
        Ok(())
    }

    // ===================== ERC-4626 (lender side, on USDC) =====================

    pub fn asset(&self) -> Address {
        self.config.usdc.get()
    }

    #[selector(name = "totalAssets")]
    pub fn total_assets(&self) -> U256 {
        self.total_assets_internal()
    }

    #[selector(name = "totalSupply")]
    pub fn total_supply(&self) -> U256 {
        self.lending.total_shares.get()
    }

    #[selector(name = "balanceOf")]
    pub fn balance_of(&self, owner: Address) -> U256 {
        self.lending.shares_of.get(owner)
    }

    #[selector(name = "convertToShares")]
    pub fn convert_to_shares(&self, assets: U256) -> U256 {
        self.convert_to_shares_round_down(assets)
    }

    #[selector(name = "convertToAssets")]
    pub fn convert_to_assets(&self, shares: U256) -> U256 {
        self.convert_to_assets_round_down(shares)
    }

    #[selector(name = "previewDeposit")]
    pub fn preview_deposit(&self, assets: U256) -> U256 {
        self.convert_to_shares_round_down(assets)
    }

    #[selector(name = "previewMint")]
    pub fn preview_mint(&self, shares: U256) -> U256 {
        self.convert_to_assets_round_up(shares)
    }

    #[selector(name = "previewWithdraw")]
    pub fn preview_withdraw(&self, assets: U256) -> U256 {
        self.convert_to_shares_round_up(assets)
    }

    #[selector(name = "previewRedeem")]
    pub fn preview_redeem(&self, shares: U256) -> U256 {
        self.convert_to_assets_round_down(shares)
    }

    pub fn deposit(&mut self, assets: U256, receiver: Address) -> Result<U256, VaultError> {
        self.check_not_paused()?;
        self.lock_reentrancy()?;
        let r = (|| -> Result<U256, VaultError> {
            if assets.is_zero() {
                return Err(VaultError::ZeroAmount(ZeroAmount {}));
            }
            if receiver.is_zero() {
                return Err(VaultError::ZeroAddress(ZeroAddress {}));
            }
            self.accrue();
            let shares = self.convert_to_shares_round_down(assets);
            if shares.is_zero() {
                return Err(VaultError::ZeroShares(ZeroShares {}));
            }

            // Effects
            let usdc = self.config.usdc.get();
            let sender = self.vm().msg_sender();
            self.lending
                .idle_assets
                .set(self.lending.idle_assets.get().saturating_add(assets));
            self.lending
                .total_shares
                .set(self.lending.total_shares.get().saturating_add(shares));
            let prev = self.lending.shares_of.get(receiver);
            self.lending
                .shares_of
                .setter(receiver)
                .set(prev.saturating_add(shares));

            // Interactions
            token::pull(self, usdc, sender, assets)?;

            self.vm().log(Deposit {
                sender,
                owner: receiver,
                assets,
                shares,
            });
            Ok(shares)
        })();
        self.unlock_reentrancy();
        r
    }

    pub fn mint(&mut self, shares: U256, receiver: Address) -> Result<U256, VaultError> {
        self.check_not_paused()?;
        self.lock_reentrancy()?;
        let r = (|| -> Result<U256, VaultError> {
            if shares.is_zero() {
                return Err(VaultError::ZeroAmount(ZeroAmount {}));
            }
            if receiver.is_zero() {
                return Err(VaultError::ZeroAddress(ZeroAddress {}));
            }
            self.accrue();
            let assets = self.convert_to_assets_round_up(shares);
            if assets.is_zero() {
                return Err(VaultError::ZeroAmount(ZeroAmount {}));
            }

            let usdc = self.config.usdc.get();
            let sender = self.vm().msg_sender();
            self.lending
                .idle_assets
                .set(self.lending.idle_assets.get().saturating_add(assets));
            self.lending
                .total_shares
                .set(self.lending.total_shares.get().saturating_add(shares));
            let prev = self.lending.shares_of.get(receiver);
            self.lending
                .shares_of
                .setter(receiver)
                .set(prev.saturating_add(shares));

            token::pull(self, usdc, sender, assets)?;

            self.vm().log(Deposit {
                sender,
                owner: receiver,
                assets,
                shares,
            });
            Ok(assets)
        })();
        self.unlock_reentrancy();
        r
    }

    pub fn withdraw(
        &mut self,
        assets: U256,
        receiver: Address,
        owner: Address,
    ) -> Result<U256, VaultError> {
        self.check_not_paused()?;
        self.lock_reentrancy()?;
        let r = (|| -> Result<U256, VaultError> {
            if assets.is_zero() {
                return Err(VaultError::ZeroAmount(ZeroAmount {}));
            }
            if receiver.is_zero() || owner.is_zero() {
                return Err(VaultError::ZeroAddress(ZeroAddress {}));
            }
            if self.vm().msg_sender() != owner {
                // No allowance system in MVP — only the share owner can withdraw.
                return Err(VaultError::NotOwner(NotOwner {}));
            }
            self.accrue();
            let shares = self.convert_to_shares_round_up(assets);
            let owner_shares = self.lending.shares_of.get(owner);
            if shares > owner_shares {
                return Err(VaultError::InsufficientBalance(InsufficientBalance {}));
            }
            let idle = self.lending.idle_assets.get();
            if assets > idle {
                return Err(VaultError::InsufficientLiquidity(InsufficientLiquidity {}));
            }

            self.lending.idle_assets.set(idle - assets);
            self.lending
                .total_shares
                .set(self.lending.total_shares.get() - shares);
            self.lending.shares_of.setter(owner).set(owner_shares - shares);

            let usdc = self.config.usdc.get();
            token::push(self, usdc, receiver, assets)?;

            self.vm().log(Withdraw {
                sender: self.vm().msg_sender(),
                receiver,
                owner,
                assets,
                shares,
            });
            Ok(shares)
        })();
        self.unlock_reentrancy();
        r
    }

    pub fn redeem(
        &mut self,
        shares: U256,
        receiver: Address,
        owner: Address,
    ) -> Result<U256, VaultError> {
        self.check_not_paused()?;
        self.lock_reentrancy()?;
        let r = (|| -> Result<U256, VaultError> {
            if shares.is_zero() {
                return Err(VaultError::ZeroAmount(ZeroAmount {}));
            }
            if receiver.is_zero() || owner.is_zero() {
                return Err(VaultError::ZeroAddress(ZeroAddress {}));
            }
            if self.vm().msg_sender() != owner {
                return Err(VaultError::NotOwner(NotOwner {}));
            }
            self.accrue();
            let owner_shares = self.lending.shares_of.get(owner);
            if shares > owner_shares {
                return Err(VaultError::InsufficientBalance(InsufficientBalance {}));
            }
            let assets = self.convert_to_assets_round_down(shares);
            if assets.is_zero() {
                return Err(VaultError::ZeroAmount(ZeroAmount {}));
            }
            let idle = self.lending.idle_assets.get();
            if assets > idle {
                return Err(VaultError::InsufficientLiquidity(InsufficientLiquidity {}));
            }

            self.lending.idle_assets.set(idle - assets);
            self.lending
                .total_shares
                .set(self.lending.total_shares.get() - shares);
            self.lending.shares_of.setter(owner).set(owner_shares - shares);

            let usdc = self.config.usdc.get();
            token::push(self, usdc, receiver, assets)?;

            self.vm().log(Withdraw {
                sender: self.vm().msg_sender(),
                receiver,
                owner,
                assets,
                shares,
            });
            Ok(assets)
        })();
        self.unlock_reentrancy();
        r
    }

    // ===================== Collateral side =====================

    pub fn deposit_collateral(
        &mut self,
        token: Address,
        amount: U256,
    ) -> Result<(), VaultError> {
        // Depositing collateral is de-risking — it can only raise your health
        // factor — so it is permitted even while paused. A borrower holding stocks
        // but no spare USDC must always be able to top up to save themselves in the
        // exact crisis that triggers a pause. (Pause still blocks the risk-ADDING
        // paths: borrow, withdraw_collateral, and lender deposit/withdraw. A frozen
        // asset still rejects new deposits below.)
        self.lock_reentrancy()?;
        let r = (|| -> Result<(), VaultError> {
            if amount.is_zero() {
                return Err(VaultError::ZeroAmount(ZeroAmount {}));
            }
            self.require_asset(token)?;
            // A frozen asset accepts no NEW collateral (existing positions keep
            // their value — see collateral_legs). Surgical alternative to a
            // global pause or a value-zeroing delist.
            if self.config.asset_whitelist.get(token).frozen.get() {
                return Err(VaultError::AssetNotEnabled(AssetNotEnabled { asset: token }));
            }
            self.accrue();
            let user = self.vm().msg_sender();

            // Per-asset supply cap (Phase 2.6), checked on the REQUESTED amount
            // BEFORE the pull (CEI): since `received <= amount` for any honest
            // token, this is a conservative bound on `total_collateral`.
            let supply_cap = self.config.asset_whitelist.get(token).supply_cap.get();
            if !supply_cap.is_zero()
                && self.collateral.total_collateral.get(token).saturating_add(amount) > supply_cap
            {
                return Err(VaultError::InvalidParameter(InvalidParameter {}));
            }

            // Pull, then credit the amount ACTUALLY received (Phase 6.2): a
            // fee-on-transfer / non-standard RWA token credits only what truly
            // arrived, so vault accounting can never be inflated.
            let received = self::token::pull_measured(self, token, user, amount)?;
            if received.is_zero() {
                return Err(VaultError::ZeroAmount(ZeroAmount {}));
            }
            let prev = self.collateral.deposits.get(user).get(token);
            self.collateral
                .deposits
                .setter(user)
                .setter(token)
                .set(prev.saturating_add(received));
            if !self.collateral.has_deposited.get(user).get(token) {
                self.collateral
                    .has_deposited
                    .setter(user)
                    .setter(token)
                    .set(true);
            }
            let new_total_coll = self.collateral.total_collateral.get(token).saturating_add(received);
            self.collateral.total_collateral.setter(token).set(new_total_coll);
            self.vm().log(CollateralDeposit {
                user,
                token,
                amount: received,
            });
            Ok(())
        })();
        self.unlock_reentrancy();
        r
    }

    pub fn withdraw_collateral(
        &mut self,
        token: Address,
        amount: U256,
    ) -> Result<(), VaultError> {
        self.check_not_paused()?;
        self.lock_reentrancy()?;
        let r = (|| -> Result<(), VaultError> {
            if amount.is_zero() {
                return Err(VaultError::ZeroAmount(ZeroAmount {}));
            }
            self.accrue();
            let user = self.vm().msg_sender();
            let prev = self.collateral.deposits.get(user).get(token);
            if amount > prev {
                return Err(VaultError::InsufficientBalance(InsufficientBalance {}));
            }
            self.collateral
                .deposits
                .setter(user)
                .setter(token)
                .set(prev - amount);
            let new_total_coll = self.collateral.total_collateral.get(token).saturating_sub(amount);
            self.collateral.total_collateral.setter(token).set(new_total_coll);

            // HF post-check (I1).
            let hf = self.hf(user)?;
            if hf < U256::from(WAD) {
                return Err(VaultError::HealthFactorTooLow(HealthFactorTooLow {}));
            }

            self::token::push(self, token, user, amount)?;
            self.vm().log(CollateralWithdraw {
                user,
                token,
                amount,
            });
            Ok(())
        })();
        self.unlock_reentrancy();
        r
    }

    // ===================== Borrow / repay =====================

    pub fn borrow(&mut self, amount: U256) -> Result<(), VaultError> {
        self.check_not_paused()?;
        self.lock_reentrancy()?;
        let r = (|| -> Result<(), VaultError> {
            if amount.is_zero() {
                return Err(VaultError::ZeroAmount(ZeroAmount {}));
            }
            self.accrue();
            let user = self.vm().msg_sender();

            let idle = self.lending.idle_assets.get();
            if amount > idle {
                return Err(VaultError::InsufficientLiquidity(InsufficientLiquidity {}));
            }

            // Bring user's principal up-to-date at the current index, then add `amount`.
            let cur_debt = self.user_debt(user);
            let new_principal = cur_debt.saturating_add(amount);
            let idx = interest::current_index(&self.interest);

            // Maintain raw `total_principal` and the scaled accumulator that
            // backs `total_assets`.
            let prev_principal = self.debt.principal.get(user);
            let prev_index = self.debt.user_index.get(user);
            let total = self.lending.total_principal.get();
            let total_after = total.saturating_sub(prev_principal).saturating_add(new_principal);

            // Min-debt floor + global borrow cap (Phase 2.4 / 2.6). A borrow always
            // increases debt, so the new position must clear the floor; total
            // protocol borrows may not exceed the cap. 0 = unset.
            let min_debt_floor = self.config.min_debt.get();
            if !min_debt_floor.is_zero() && new_principal < min_debt_floor {
                return Err(VaultError::InvalidParameter(InvalidParameter {}));
            }
            let borrow_cap = self.config.borrow_cap.get();
            if !borrow_cap.is_zero() && total_after > borrow_cap {
                return Err(VaultError::InvalidParameter(InvalidParameter {}));
            }
            // Bank-run buffer (Phase 6.5): the borrow may not push utilization past
            // MAX_UTIL_BPS, keeping an idle buffer for lender withdrawals.
            let idle_after = idle.saturating_sub(amount);
            let deposits_after = total_after.saturating_add(idle_after);
            if !deposits_after.is_zero() {
                let util = total_after.saturating_mul(U256::from(10_000u64)) / deposits_after;
                if util > U256::from(MAX_UTIL_BPS) {
                    return Err(VaultError::InsufficientLiquidity(InsufficientLiquidity {}));
                }
            }

            self.debt.principal.setter(user).set(new_principal);
            self.debt.user_index.setter(user).set(idx);
            self.lending.total_principal.set(total_after);
            self.apply_scaled_debt(prev_principal, prev_index, new_principal, idx);
            self.lending.idle_assets.set(idle - amount);

            // HF post-check (I1) — liquidation-threshold-weighted, must be >= 1.
            let hf = self.hf(user)?;
            if hf < U256::from(WAD) {
                return Err(VaultError::HealthFactorTooLow(HealthFactorTooLow {}));
            }
            // Stricter borrow-open gate (TDD §7.3): the loan must also fit within
            // each asset's MAX LTV, so a fresh position opens with a buffer below
            // the liquidation threshold — the time window the agent needs to act.
            // New-risk gating via PriceGuard (Phase 5). Halted (circuit breaker) =>
            // block the borrow; market closed (weekend/holiday) => haircut borrowing
            // power so 24/7 borrowing stays a feature with gap-risk priced in.
            if self.oracle_halted() {
                return Err(VaultError::OracleFailure(OracleFailure { asset: Address::ZERO }));
            }
            let haircut_bps: u64 = if self.oracle_market_closed() { MARKET_CLOSED_LTV_BPS } else { 10_000 };
            let ltv_coll_8 = self
                .collateral_legs_weighted(user, true)?
                .saturating_mul(U256::from(haircut_bps))
                / U256::from(10_000u64);
            let debt_usd_8 = self.user_debt(user).saturating_mul(U256::from(100u64));
            if health_factor(ltv_coll_8, debt_usd_8) < U256::from(WAD) {
                return Err(VaultError::HealthFactorTooLow(HealthFactorTooLow {}));
            }

            let usdc = self.config.usdc.get();
            self::token::push(self, usdc, user, amount)?;

            self.vm().log(Borrow {
                user,
                amount,
                new_principal,
                borrow_index: idx,
            });
            Ok(())
        })();
        self.unlock_reentrancy();
        r
    }

    pub fn repay(&mut self, amount: U256) -> Result<U256, VaultError> {
        // Repay is allowed even when paused (TDD §3.7 — pause stops new
        // borrows / withdrawals; users can always reduce debt).
        self.lock_reentrancy()?;
        let user = self.vm().msg_sender();
        let r = self.repay_internal(user, amount);
        self.unlock_reentrancy();
        r
    }

    /// Agent-triggered protective repay — auto-repay ("AI Protects") Layer 3.
    ///
    /// The agent reduces `user`'s debt using `user`'s OWN pre-approved USDC: the
    /// user's ERC-20 allowance to the vault is both the spending cap AND the
    /// kill switch (revoke the allowance to disable protection instantly).
    /// Agent-only, never custodial: this entrypoint can only *reduce* a user's
    /// debt with that user's approved funds — it can never extract value. The
    /// deterministic core (the agent's HF check + caps) decides *whether* to
    /// call this; the contract enforces *who* may call it and *whose* funds move.
    /// Allowed while paused, since reducing debt is always safe.
    pub fn agent_repay_for(&mut self, user: Address, amount: U256) -> Result<U256, VaultError> {
        self.lock_reentrancy()?;
        let r = (|| -> Result<U256, VaultError> {
            self.only_agent()?;
            self.config.agent_last_heartbeat.set(U64::from(self.now_ts()));
            // On-chain per-(user, day) cap so a compromised agent KEY — not just
            // compliant agent code — can't drain a user's full allowance at once.
            let capped = self.charge_daily_repay(user, amount)?;
            self.repay_internal(user, capped)
        })();
        self.unlock_reentrancy();
        r
    }

    // ===================== Liquidation =====================

    pub fn liquidate(
        &mut self,
        borrower: Address,
        repay_amount: U256,
        collateral_token: Address,
    ) -> Result<U256, VaultError> {
        // Liquidation is allowed when paused (it's the safety release valve).
        self.lock_reentrancy()?;
        let r = (|| -> Result<U256, VaultError> {
            // Permissionless heartbeat-gated backstop (mainnet gate #2, TDD §3.6/D3):
            // the agent may always liquidate; anyone else only once the agent has
            // gone silent past `backstop_delay_secs`. delay == 0 (testnet/MVP
            // default) keeps this strictly agent-only. A backstop liquidation runs
            // the identical close-factor / bonus / post-HF-improvement guards below,
            // so it is provably as safe as an agent liquidation.
            let sender = self.vm().msg_sender();
            let agent = self.config.agent.get();
            let is_agent = !agent.is_zero() && sender == agent;
            if !backstop_allows(
                is_agent,
                self.now_ts(),
                self.config.agent_last_heartbeat.get().to::<u64>(),
                self.config.backstop_delay_secs.get().to::<u64>(),
            ) {
                return Err(VaultError::NotAgent(NotAgent {}));
            }
            if is_agent {
                self.config.agent_last_heartbeat.set(U64::from(self.now_ts()));
            }
            if borrower.is_zero() {
                return Err(VaultError::ZeroAddress(ZeroAddress {}));
            }
            if repay_amount.is_zero() {
                return Err(VaultError::ZeroAmount(ZeroAmount {}));
            }
            self.require_asset(collateral_token)?;
            self.accrue();

            let hf = self.hf(borrower)?;
            if hf >= U256::from(WAD) {
                return Err(VaultError::PositionHealthy(PositionHealthy {}));
            }

            let debt = self.user_debt(borrower);
            if debt.is_zero() {
                return Err(VaultError::PositionHealthy(PositionHealthy {}));
            }
            let coll_bal = self.collateral.deposits.get(borrower).get(collateral_token);
            if coll_bal.is_zero() {
                return Err(VaultError::InsufficientBalance(InsufficientBalance {}));
            }
            let params = self.config.asset_whitelist.get(collateral_token);
            let coll_decimals = u32::from(params.decimals.get().to::<u8>());
            let base_bonus = u32::from(params.liq_bonus_bps.get().to::<u16>());
            // Depth-based Dutch-auction bonus (Phase 4): the per-asset bonus is the
            // floor; it ramps toward MAX_LIQ_BONUS_BPS as HF falls to 0.90, so even
            // thin-market collateral becomes profitable to liquidate eventually.
            let bonus = interest_model::liquidation_bonus_bps(hf, base_bonus, MAX_LIQ_BONUS_BPS);
            // Full-close path: a deeply underwater position (HF < 0.95) is not
            // viable — permit a 100% close so an honest liquidator can wind it
            // down in one shot (seize all collateral; any residual is absorbed by
            // the waterfall below), instead of the 50% close-factor leaving bad
            // debt frozen and unliquidatable. The post-state guard still blocks a
            // skim-and-leave (it requires new_debt == 0 OR new_coll == 0).
            let full_close_hf = U256::from(WAD).saturating_mul(U256::from(95u64)) / U256::from(100u64);
            let cf = if hf < full_close_hf {
                10_000u32
            } else {
                u32::from(self.config.close_factor_bps.get().to::<u16>())
            };
            let price = self.oracle_price(collateral_token)?;

            let res =
                compute_liquidation(debt, repay_amount, coll_bal, coll_decimals, price, cf, bonus);
            if res.repay_usdc.is_zero() || res.seize_collateral.is_zero() {
                return Err(VaultError::InvalidParameter(InvalidParameter {}));
            }

            // Effects: reduce debt by repay, reduce collateral by seize.
            let new_debt = debt - res.repay_usdc;
            let idx = interest::current_index(&self.interest);
            let prev_principal = self.debt.principal.get(borrower);
            let prev_index = self.debt.user_index.get(borrower);
            let total = self.lending.total_principal.get();
            let total_after = total.saturating_sub(prev_principal).saturating_add(new_debt);
            self.debt.principal.setter(borrower).set(new_debt);
            self.debt.user_index.setter(borrower).set(idx);
            self.lending.total_principal.set(total_after);
            self.apply_scaled_debt(prev_principal, prev_index, new_debt, idx);

            let new_coll = coll_bal - res.seize_collateral;
            self.collateral
                .deposits
                .setter(borrower)
                .setter(collateral_token)
                .set(new_coll);
            // Keep the per-asset concentration counter in sync with the seize.
            let coll_after_seize = self
                .collateral
                .total_collateral
                .get(collateral_token)
                .saturating_sub(res.seize_collateral);
            self.collateral
                .total_collateral
                .setter(collateral_token)
                .set(coll_after_seize);

            self.lending
                .idle_assets
                .set(self.lending.idle_assets.get().saturating_add(res.repay_usdc));

            // Post-state guard: a liquidation must IMPROVE health, fully repay the
            // debt, or exhaust the seized asset — never just skim the bonus and
            // leave the borrower more underwater than before.
            let new_hf = self.hf(borrower)?;
            if !(new_debt.is_zero() || new_coll.is_zero() || new_hf > hf) {
                return Err(VaultError::HealthFactorTooLow(HealthFactorTooLow {}));
            }

            // Insolvency waterfall (effects, before interactions): if this
            // liquidation exhausted the borrower's LAST collateral while debt
            // remains, the position is bad debt. Wind it down atomically — the
            // reserve absorbs first, only the uncovered remainder socializes to
            // lenders, and it is always visible in one BadDebtAbsorbed event.
            // Never a silent share-price poison; never a frozen, unliquidatable
            // position.
            if new_coll.is_zero() && new_debt > U256::ZERO {
                let coll_8 = self.collateral_legs(borrower)?;
                if coll_8.is_zero() {
                    let reserve = self.lending.reserve_assets.get();
                    let covered = if new_debt > reserve { reserve } else { new_debt };
                    let socialized = new_debt - covered;
                    self.lending.reserve_assets.set(reserve - covered);
                    if !socialized.is_zero() {
                        self.lending
                            .bad_debt
                            .set(self.lending.bad_debt.get().saturating_add(socialized));
                    }
                    // Wipe the residual debt: principal -> 0. total_debt falls by
                    // `new_debt`; reserve falls by `covered`; so lender-facing
                    // total_assets falls by exactly `socialized` (new_debt - covered).
                    self.debt.principal.setter(borrower).set(U256::ZERO);
                    self.lending
                        .total_principal
                        .set(self.lending.total_principal.get().saturating_sub(new_debt));
                    self.apply_scaled_debt(new_debt, idx, U256::ZERO, idx);
                    self.vm().log(BadDebtAbsorbed {
                        borrower,
                        covered,
                        socialized,
                    });
                }
            }

            // Interactions: pull repay USDC from liquidator, push collateral to liquidator.
            let usdc = self.config.usdc.get();
            let liquidator = self.vm().msg_sender();
            self::token::pull(self, usdc, liquidator, res.repay_usdc)?;
            self::token::push(self, collateral_token, liquidator, res.seize_collateral)?;

            self.vm().log(Liquidate {
                borrower,
                liquidator,
                collateral_token,
                repay_amount: res.repay_usdc,
                seize_amount: res.seize_collateral,
            });

            Ok(res.seize_collateral)
        })();
        self.unlock_reentrancy();
        r
    }

    // ===================== Views =====================

    #[selector(name = "getHealthFactor")]
    pub fn get_health_factor(&mut self, user: Address) -> Result<U256, VaultError> {
        self.hf(user)
    }

    /// Portfolio Safety Score 0..=100 (TDD §5.3). Convenience helper for the UI.
    #[selector(name = "getSafetyScore")]
    pub fn get_safety_score(&mut self, user: Address) -> Result<u8, VaultError> {
        let hf = self.hf(user)?;
        let two_wad = U256::from(WAD).saturating_mul(U256::from(2u64));
        let cap = if hf > two_wad { two_wad } else { hf };
        // score = cap * 100 / 2e18
        let numerator = cap.saturating_mul(U256::from(100u64));
        let score = numerator.checked_div(two_wad).unwrap_or(U256::ZERO);
        let s = score.to::<u64>();
        Ok(u8::try_from(s.min(100)).unwrap_or(100))
    }

    #[selector(name = "getAccountData")]
    pub fn get_account_data(
        &mut self,
        user: Address,
    ) -> Result<(U256, U256, U256), VaultError> {
        // (collateral_value_usd_8_weighted, debt_usdc, hf_1e18)
        let coll = self.collateral_legs(user)?;
        let debt = self.user_debt(user);
        let hf = self.hf(user)?;
        Ok((coll, debt, hf))
    }

    #[selector(name = "collateralOf")]
    pub fn collateral_of(&self, user: Address, token: Address) -> U256 {
        self.collateral.deposits.get(user).get(token)
    }

    #[selector(name = "debtOf")]
    pub fn debt_of(&self, user: Address) -> U256 {
        self.user_debt(user)
    }

    #[selector(name = "utilizationBps")]
    pub fn utilization_bps(&self) -> u32 {
        interest::utilization(&self.lending)
    }

    #[selector(name = "borrowRateBps")]
    pub fn borrow_rate_bps(&self) -> u32 {
        interest::current_borrow_rate(&self.interest, &self.lending)
    }

    #[selector(name = "supplyRateBps")]
    pub fn supply_rate_bps(&self) -> u32 {
        let br = interest::current_borrow_rate(&self.interest, &self.lending);
        let util = interest::utilization(&self.lending);
        let rf = u32::from(self.interest.reserve_factor_bps.get().to::<u16>());
        supply_rate_bps(br, util, rf)
    }

    #[selector(name = "borrowIndex")]
    pub fn borrow_index(&self) -> U256 {
        interest::current_index(&self.interest)
    }

    #[selector(name = "totalPrincipal")]
    pub fn total_principal(&self) -> U256 {
        self.lending.total_principal.get()
    }

    #[selector(name = "idleAssets")]
    pub fn idle_assets(&self) -> U256 {
        self.lending.idle_assets.get()
    }

    /// Accrued protocol reserve (USDC, 6dp) — first-loss capital + revenue.
    #[selector(name = "reserves")]
    pub fn reserves(&self) -> U256 {
        self.lending.reserve_assets.get()
    }

    /// Lifetime bad debt socialized to lenders (USDC, 6dp) after the reserve was
    /// exhausted. 0 = the reserve has covered every loss so far.
    #[selector(name = "badDebt")]
    pub fn bad_debt(&self) -> U256 {
        self.lending.bad_debt.get()
    }

    /// Minimum per-user debt floor (USDC, 6dp).
    #[selector(name = "minDebt")]
    pub fn min_debt(&self) -> U256 {
        self.config.min_debt.get()
    }

    /// Global borrow cap (USDC, 6dp). 0 = uncapped.
    #[selector(name = "borrowCap")]
    pub fn borrow_cap(&self) -> U256 {
        self.config.borrow_cap.get()
    }

    /// Per-asset supply cap (collateral units). 0 = uncapped.
    #[selector(name = "supplyCap")]
    pub fn supply_cap(&self, token: Address) -> U256 {
        self.config.asset_whitelist.get(token).supply_cap.get()
    }

    /// Total collateral currently deposited for a token (collateral units).
    #[selector(name = "totalCollateral")]
    pub fn total_collateral(&self, token: Address) -> U256 {
        self.collateral.total_collateral.get(token)
    }

    #[selector(name = "assetParams")]
    pub fn asset_params(&self, token: Address) -> (bool, u8, u16, u16, u16) {
        let p = self.config.asset_whitelist.get(token);
        (
            p.enabled.get(),
            p.decimals.get().to::<u8>(),
            p.max_ltv_bps.get().to::<u16>(),
            p.liq_threshold_bps.get().to::<u16>(),
            p.liq_bonus_bps.get().to::<u16>(),
        )
    }

    #[selector(name = "listedAssetCount")]
    pub fn listed_asset_count(&self) -> U256 {
        U256::from(self.config.listed_assets.len())
    }

    #[selector(name = "listedAssetAt")]
    pub fn listed_asset_at(&self, index: U256) -> Address {
        let i: usize = index.to::<u64>() as usize;
        self.config.listed_assets.get(i).unwrap_or(Address::ZERO)
    }
}

// ---------- Host-side tests ----------

/// Permissionless heartbeat-gated backstop (mainnet gate #2, TDD §3.6/D3). The
/// agent may always liquidate; anyone else only when the backstop is enabled
/// (`delay > 0`) AND the agent has been silent longer than `delay`. Pure, so the
/// gate is host-tested; the live path composes it with `msg.sender` + block time.
/// `delay == 0` (testnet/MVP default) ⇒ strictly agent-only.
pub(crate) fn backstop_allows(is_agent: bool, now_ts: u64, last_heartbeat: u64, delay: u64) -> bool {
    if is_agent {
        return true;
    }
    delay > 0 && now_ts.saturating_sub(last_heartbeat) > delay
}

// price_deviation_exceeds (dual-oracle guard) moved to PriceGuard (Phase 5).

#[cfg(test)]
mod tests;
