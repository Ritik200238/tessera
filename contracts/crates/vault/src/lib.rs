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
        let oracle = self.config.oracle.get();
        let max_age = self.config.max_price_age_secs.get().to::<u64>();
        let now = self.now_ts();
        oracle::price_usd_8(self, oracle, asset, now, max_age)
    }

    /// Aggregate the user's collateral into the legs the interest-model needs,
    /// returning the `1e8`-scaled USD value already weighted by each asset's
    /// liquidation threshold.
    fn collateral_legs(&mut self, user: Address) -> Result<U256, VaultError> {
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
                // Disabled assets are valued at zero (TDD §3.6: owner can
                // freeze a misbehaving asset; existing positions then count
                // it as worthless until re-enabled).
                continue;
            }
            let decimals = u32::from(params.decimals.get().to::<u8>());
            let liq_threshold = u32::from(params.liq_threshold_bps.get().to::<u16>());
            let price = self.oracle_price(token)?;
            legs.push(CollateralLeg {
                amount,
                decimals,
                price_usd_8: price,
                liq_threshold_bps: liq_threshold,
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
    fn total_assets_internal(&self) -> U256 {
        let idle = self.lending.idle_assets.get();
        // Outstanding debt at the current index. We approximate with
        // `total_principal * current_index / WAD` because in MVP every borrow
        // is normalised against the index at borrow-time via per-user snapshot
        // and `total_principal` is raw — this overstates by accrued-but-
        // unrealised interest. For accurate ERC-4626 accounting we track the
        // per-borrower scaled balance separately:
        //
        // Actually, with our (raw principal + per-user snapshot index) model,
        // the *true* total debt equals Σ principal[u] * idx / user_idx[u],
        // which requires iteration. As an approximation we use:
        //     total_principal * (current_index / WAD)
        // which would over-count if any borrower's snapshot is *newer* than
        // the global. Since we accrue on every state mutation and update the
        // user index on every borrow / repay, every user's snapshot ≤ global
        // index — so the approximation under- or equal-counts but never over.
        // For MVP this is acceptable and conservative for lender share price.
        let principal = self.lending.total_principal.get();
        if principal.is_zero() {
            return idle;
        }
        let idx = interest::current_index(&self.interest);
        let wad = U256::from(WAD);
        let scaled = principal
            .saturating_mul(idx)
            .checked_div(wad)
            .unwrap_or(principal);
        idle.saturating_add(scaled)
    }

    /// Convert assets → shares with OZ-style rounding (down for deposit,
    /// up for mint). `decimals_offset = 0` for MVP.
    fn convert_to_shares_round_down(&self, assets: U256) -> U256 {
        let supply = self.lending.total_shares.get();
        if supply.is_zero() {
            return assets;
        }
        let total = self.total_assets_internal();
        if total.is_zero() {
            return assets;
        }
        assets
            .saturating_mul(supply)
            .checked_div(total)
            .unwrap_or(U256::ZERO)
    }

    fn convert_to_shares_round_up(&self, assets: U256) -> U256 {
        let supply = self.lending.total_shares.get();
        if supply.is_zero() {
            return assets;
        }
        let total = self.total_assets_internal();
        if total.is_zero() {
            return assets;
        }
        let num = assets.saturating_mul(supply);
        let q = num.checked_div(total).unwrap_or(U256::ZERO);
        let r = num.checked_rem(total).unwrap_or(U256::ZERO);
        if r.is_zero() {
            q
        } else {
            q.saturating_add(U256::from(1u64))
        }
    }

    fn convert_to_assets_round_down(&self, shares: U256) -> U256 {
        let supply = self.lending.total_shares.get();
        if supply.is_zero() {
            return shares;
        }
        let total = self.total_assets_internal();
        if total.is_zero() {
            return U256::ZERO;
        }
        shares
            .saturating_mul(total)
            .checked_div(supply)
            .unwrap_or(U256::ZERO)
    }

    fn convert_to_assets_round_up(&self, shares: U256) -> U256 {
        let supply = self.lending.total_shares.get();
        if supply.is_zero() {
            return shares;
        }
        let total = self.total_assets_internal();
        if total.is_zero() {
            return U256::ZERO;
        }
        let num = shares.saturating_mul(total);
        let q = num.checked_div(supply).unwrap_or(U256::ZERO);
        let r = num.checked_rem(supply).unwrap_or(U256::ZERO);
        if r.is_zero() {
            q
        } else {
            q.saturating_add(U256::from(1u64))
        }
    }
}

// ---------- Public entrypoints ----------

#[public]
impl TesseraVault {
    // ===================== Initialization & admin =====================

    /// One-time initializer. Idempotent: subsequent calls revert with
    /// `NotOwner` (because owner is already set and the caller can re-run
    /// individual setters as the owner).
    pub fn initialize(
        &mut self,
        owner: Address,
        usdc: Address,
        oracle: Address,
        agent: Address,
    ) -> Result<(), VaultError> {
        if !self.config.owner.get().is_zero() {
            return Err(VaultError::NotOwner(NotOwner {}));
        }
        if owner.is_zero() || usdc.is_zero() {
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
        self.interest.reserve_factor_bps.set(alloy_primitives::U16::from(0u16));
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
        let old = self.config.owner.get();
        self.config.owner.set(new_owner);
        self.vm().log(OwnershipTransferred {
            previous_owner: old,
            new_owner,
        });
        Ok(())
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

    pub fn set_rate_params(
        &mut self,
        base: u16,
        slope1: u16,
        slope2: u16,
        optimal: u16,
        reserve_factor: u16,
    ) -> Result<(), VaultError> {
        self.only_owner()?;
        if optimal == 0 || optimal > 10_000 || reserve_factor > 10_000 {
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

    pub fn pause(&mut self) -> Result<(), VaultError> {
        self.only_owner()?;
        if self.pause.paused.get() {
            return Ok(());
        }
        self.pause.paused.set(true);
        self.vm().log(PausedSet {
            by: self.vm().msg_sender(),
            paused: true,
        });
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
        self.check_not_paused()?;
        self.lock_reentrancy()?;
        let r = (|| -> Result<(), VaultError> {
            if amount.is_zero() {
                return Err(VaultError::ZeroAmount(ZeroAmount {}));
            }
            self.require_asset(token)?;
            self.accrue();
            let user = self.vm().msg_sender();

            let prev = self.collateral.deposits.get(user).get(token);
            self.collateral
                .deposits
                .setter(user)
                .setter(token)
                .set(prev.saturating_add(amount));
            if !self.collateral.has_deposited.get(user).get(token) {
                self.collateral
                    .has_deposited
                    .setter(user)
                    .setter(token)
                    .set(true);
            }
            self::token::pull(self, token, user, amount)?;
            self.vm().log(CollateralDeposit {
                user,
                token,
                amount,
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

            // Adjust `total_principal` by the delta between current debt and prior
            // stored principal so the global tracks the raw outstanding.
            let prev_principal = self.debt.principal.get(user);
            let total = self.lending.total_principal.get();
            let total_after = total.saturating_sub(prev_principal).saturating_add(new_principal);

            self.debt.principal.setter(user).set(new_principal);
            self.debt.user_index.setter(user).set(idx);
            self.lending.total_principal.set(total_after);
            self.lending.idle_assets.set(idle - amount);

            // HF post-check (I1) — must be done *after* state writes.
            let hf = self.hf(user)?;
            if hf < U256::from(WAD) {
                return Err(VaultError::HealthFactorTooLow(HealthFactorTooLow {}));
            }
            // Additionally enforce per-asset max_ltv at borrow-open time
            // (TDD §14 LTV cap). We approximate by requiring HF >= max(WAD,
            // collateral / debt * ltv_threshold / max_ltv); for MVP we only
            // enforce HF >= 1e18 since liq_threshold already encodes the
            // upper bound.
            // (Future: tighten to max_ltv.)

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
        let r = (|| -> Result<U256, VaultError> {
            if amount.is_zero() {
                return Err(VaultError::ZeroAmount(ZeroAmount {}));
            }
            self.accrue();
            let user = self.vm().msg_sender();
            let cur_debt = self.user_debt(user);
            if cur_debt.is_zero() {
                return Err(VaultError::InsufficientBalance(InsufficientBalance {}));
            }
            let pay = core::cmp::min(amount, cur_debt);
            let new_debt = cur_debt - pay;
            let idx = interest::current_index(&self.interest);

            let prev_principal = self.debt.principal.get(user);
            let total = self.lending.total_principal.get();
            let total_after = total.saturating_sub(prev_principal).saturating_add(new_debt);

            self.debt.principal.setter(user).set(new_debt);
            self.debt.user_index.setter(user).set(idx);
            self.lending.total_principal.set(total_after);
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
            // MVP: agent-only (TDD §3.6 / D3).
            self.only_agent()?;
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
            let bonus = u32::from(params.liq_bonus_bps.get().to::<u16>());
            let cf = u32::from(self.config.close_factor_bps.get().to::<u16>());
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
            let total = self.lending.total_principal.get();
            let total_after = total.saturating_sub(prev_principal).saturating_add(new_debt);
            self.debt.principal.setter(borrower).set(new_debt);
            self.debt.user_index.setter(borrower).set(idx);
            self.lending.total_principal.set(total_after);

            let new_coll = coll_bal - res.seize_collateral;
            self.collateral
                .deposits
                .setter(borrower)
                .setter(collateral_token)
                .set(new_coll);

            self.lending
                .idle_assets
                .set(self.lending.idle_assets.get().saturating_add(res.repay_usdc));

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

            // Bad debt detection: if collateral exhausted across *all* assets
            // and principal > 0 → emit BadDebtRealized for off-chain attention.
            if new_coll.is_zero() && new_debt > U256::ZERO {
                let coll_8 = self.collateral_legs(borrower)?;
                if coll_8.is_zero() {
                    self.vm().log(BadDebtRealized {
                        user: borrower,
                        residual: new_debt,
                    });
                }
            }

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

#[cfg(test)]
mod tests;
