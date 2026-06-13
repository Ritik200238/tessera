//! # tessera-priceguard
//!
//! The oracle policy router (rulbookImprvmnts.md Phase 5).
//!
//! The vault reads every USD price through this contract instead of a raw
//! aggregator, so the oracle policy can evolve behind the timelock WITHOUT
//! touching the funds-holding vault, and so the vault's own code stays under the
//! 24KB ceiling.
//!
//! Policy enforced in `get_price` (reverts only on HARD price failure):
//!   - validity  — answer <= 0 or a future-dated update reverts;
//!   - staleness — a feed older than `max_price_age_secs` reverts;
//!   - deviation — a fresh secondary disagreeing beyond `max_deviation_bps` reverts;
//!   - normalize — non-8-decimal feeds normalised to 8dp.
//!
//! The market-hours / circuit-breaker state (`halted`, `market_closed`) are
//! separate views: the vault restricts NEW risk (borrow/withdraw) on them while
//! repay/liquidate always read the freshest defensible price. Principle: you can
//! always make yourself safer; you can never add risk on a price we can't defend.
//!
//! Holds no funds. Owner = the timelock at mainnet; the guardian may flip
//! `halted` / `market_closed` instantly (safety fast), nothing else.

#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]
#![allow(unexpected_cfgs)]
#![allow(clippy::wildcard_imports)]

extern crate alloc;
#[allow(unused_imports)]
use alloc::{vec, vec::Vec};

use alloy_primitives::{Address, I256, U256, U64};
use alloy_sol_types::sol;
use stylus_sdk::prelude::*;

sol_storage! {
    #[entrypoint]
    pub struct PriceGuard {
        address owner;
        address pending_owner;
        /// May ONLY flip halted / market_closed (safety-fast). No params.
        address guardian;
        /// Primary feed (Chainlink-style aggregator / testnet MockOracle).
        address primary_oracle;
        /// Optional secondary feed for the deviation guard. 0 = disabled.
        address secondary_oracle;
        uint64 max_price_age_secs;
        /// Max primary<->secondary deviation, bps. 0 = guard disabled.
        uint16 max_deviation_bps;
        /// Circuit breaker: when true, the vault blocks NEW risk (borrow/withdraw).
        bool halted;
        /// Underlying market closed (weekend/holiday): the vault haircuts new
        /// borrows rather than blocking them (24/7 borrowing stays a feature).
        bool market_closed;
        /// Per-token feed decimals. 0 => 8 (Chainlink/Mock default).
        mapping(address => uint8) feed_decimals;
    }
}

sol! {
    event OwnershipTransferStarted(address indexed previous_owner, address indexed new_owner);
    event OwnershipTransferred(address indexed previous_owner, address indexed new_owner);
    event GuardianSet(address indexed guardian);
    event OracleSet(address indexed primary, address indexed secondary);
    event HaltedSet(bool halted);
    event MarketClosedSet(bool closed);

    error Unauthorized();
    error ZeroAddress();
    error StalePrice(address asset);
    error OracleFailure(address asset);
}

#[derive(SolidityError)]
pub enum PgError {
    Unauthorized(Unauthorized),
    ZeroAddress(ZeroAddress),
    StalePrice(StalePrice),
    OracleFailure(OracleFailure),
}

sol_interface! {
    interface IAggregatorV3 {
        function latestRoundData(address token)
            external view returns (uint80, int256, uint256, uint256, uint80);
    }
}

#[public]
impl PriceGuard {
    /// One-time initializer (guarded by `owner.is_zero()`). PriceGuard holds no
    /// funds, so a guarded init is sufficient; the vault uses a constructor.
    pub fn initialize(
        &mut self,
        owner: Address,
        primary_oracle: Address,
        max_price_age_secs: U64,
    ) -> Result<(), PgError> {
        if !self.owner.get().is_zero() {
            return Err(PgError::Unauthorized(Unauthorized {}));
        }
        if owner.is_zero() || primary_oracle.is_zero() {
            return Err(PgError::ZeroAddress(ZeroAddress {}));
        }
        self.owner.set(owner);
        self.primary_oracle.set(primary_oracle);
        self.max_price_age_secs.set(max_price_age_secs);
        self.vm().log(OwnershipTransferred { previous_owner: Address::ZERO, new_owner: owner });
        self.vm().log(OracleSet { primary: primary_oracle, secondary: Address::ZERO });
        Ok(())
    }

    /// Validated 8-decimal USD price for `token`. Reverts ONLY on hard price
    /// failure (stale / non-positive / future-dated / dual-feed deviation). Does
    /// NOT consider halted/market_closed — those gate NEW risk in the vault.
    #[selector(name = "getPrice")]
    pub fn get_price(&mut self, token: Address) -> Result<U256, PgError> {
        let now = self.vm().block_timestamp();
        let max_age = self.max_price_age_secs.get().to::<u64>();
        let fd = self.feed_decimals.get(token).to::<u8>();
        let primary = self.primary_oracle.get();
        let p1 = normalize_price_8(read_feed(self, primary, token, now, max_age)?, fd);
        let secondary = self.secondary_oracle.get();
        let max_dev = u64::from(self.max_deviation_bps.get().to::<u16>());
        if !secondary.is_zero() && max_dev > 0 {
            if let Ok(raw2) = read_feed(self, secondary, token, now, max_age) {
                if price_deviation_exceeds(p1, normalize_price_8(raw2, fd), max_dev) {
                    return Err(PgError::OracleFailure(OracleFailure { asset: token }));
                }
            }
        }
        Ok(p1)
    }

    #[selector(name = "halted")]
    pub fn halted(&self) -> bool {
        self.halted.get()
    }

    #[selector(name = "marketClosed")]
    pub fn market_closed(&self) -> bool {
        self.market_closed.get()
    }

    pub fn owner(&self) -> Address {
        self.owner.get()
    }
    #[selector(name = "pendingOwner")]
    pub fn pending_owner(&self) -> Address {
        self.pending_owner.get()
    }
    pub fn guardian(&self) -> Address {
        self.guardian.get()
    }
    #[selector(name = "primaryOracle")]
    pub fn primary_oracle(&self) -> Address {
        self.primary_oracle.get()
    }
    #[selector(name = "secondaryOracle")]
    pub fn secondary_oracle(&self) -> Address {
        self.secondary_oracle.get()
    }
    #[selector(name = "maxPriceAge")]
    pub fn max_price_age(&self) -> U64 {
        self.max_price_age_secs.get()
    }

    // ---- guardian: instant safety flips ----
    #[selector(name = "setHalted")]
    pub fn set_halted(&mut self, value: bool) -> Result<(), PgError> {
        self.only_guardian_or_owner()?;
        self.halted.set(value);
        self.vm().log(HaltedSet { halted: value });
        Ok(())
    }
    #[selector(name = "setMarketClosed")]
    pub fn set_market_closed(&mut self, value: bool) -> Result<(), PgError> {
        self.only_guardian_or_owner()?;
        self.market_closed.set(value);
        self.vm().log(MarketClosedSet { closed: value });
        Ok(())
    }

    // ---- owner (timelock): parameters ----
    #[selector(name = "setGuardian")]
    pub fn set_guardian(&mut self, guardian: Address) -> Result<(), PgError> {
        self.only_owner()?;
        self.guardian.set(guardian);
        self.vm().log(GuardianSet { guardian });
        Ok(())
    }
    #[selector(name = "setOracles")]
    pub fn set_oracles(
        &mut self,
        primary: Address,
        secondary: Address,
        max_deviation_bps: u16,
    ) -> Result<(), PgError> {
        self.only_owner()?;
        if primary.is_zero() {
            return Err(PgError::ZeroAddress(ZeroAddress {}));
        }
        self.primary_oracle.set(primary);
        self.secondary_oracle.set(secondary);
        self.max_deviation_bps.set(alloy_primitives::U16::from(max_deviation_bps));
        self.vm().log(OracleSet { primary, secondary });
        Ok(())
    }
    #[selector(name = "setMaxPriceAge")]
    pub fn set_max_price_age(&mut self, secs: U64) -> Result<(), PgError> {
        self.only_owner()?;
        self.max_price_age_secs.set(secs);
        Ok(())
    }
    #[selector(name = "setFeedDecimals")]
    pub fn set_feed_decimals(&mut self, token: Address, decimals: u8) -> Result<(), PgError> {
        self.only_owner()?;
        self.feed_decimals.setter(token).set(alloy_primitives::U8::from(decimals));
        Ok(())
    }
    #[selector(name = "transferOwnership")]
    pub fn transfer_ownership(&mut self, new_owner: Address) -> Result<(), PgError> {
        self.only_owner()?;
        if new_owner.is_zero() {
            return Err(PgError::ZeroAddress(ZeroAddress {}));
        }
        self.pending_owner.set(new_owner);
        self.vm().log(OwnershipTransferStarted { previous_owner: self.owner.get(), new_owner });
        Ok(())
    }
    #[selector(name = "acceptOwnership")]
    pub fn accept_ownership(&mut self) -> Result<(), PgError> {
        let pending = self.pending_owner.get();
        if pending.is_zero() || self.vm().msg_sender() != pending {
            return Err(PgError::Unauthorized(Unauthorized {}));
        }
        let old = self.owner.get();
        self.owner.set(pending);
        self.pending_owner.set(Address::ZERO);
        self.vm().log(OwnershipTransferred { previous_owner: old, new_owner: pending });
        Ok(())
    }
}

impl PriceGuard {
    fn only_owner(&self) -> Result<(), PgError> {
        if self.vm().msg_sender() != self.owner.get() {
            return Err(PgError::Unauthorized(Unauthorized {}));
        }
        Ok(())
    }
    fn only_guardian_or_owner(&self) -> Result<(), PgError> {
        let s = self.vm().msg_sender();
        let g = self.guardian.get();
        if s == self.owner.get() || (!g.is_zero() && s == g) {
            return Ok(());
        }
        Err(PgError::Unauthorized(Unauthorized {}))
    }
}

/// Read an 8dp-raw answer from a Chainlink-style feed, enforcing staleness.
fn read_feed<S: TopLevelStorage + HostAccess>(
    storage: &mut S,
    oracle: Address,
    asset: Address,
    now_ts: u64,
    max_age_secs: u64,
) -> Result<U256, PgError> {
    if oracle.is_zero() || asset.is_zero() {
        return Err(PgError::OracleFailure(OracleFailure { asset }));
    }
    let feed = IAggregatorV3::new(oracle);
    let (_r, answer, _s, updated_at, _a) = feed
        .latest_round_data(storage.vm(), Call::new(), asset)
        .map_err(|_| PgError::OracleFailure(OracleFailure { asset }))?;
    if answer <= I256::ZERO {
        return Err(PgError::OracleFailure(OracleFailure { asset }));
    }
    let now = U256::from(now_ts);
    if updated_at > now {
        return Err(PgError::OracleFailure(OracleFailure { asset }));
    }
    if now - updated_at > U256::from(max_age_secs) {
        return Err(PgError::StalePrice(StalePrice { asset }));
    }
    let bytes: [u8; 32] = answer.to_be_bytes();
    Ok(U256::from_be_bytes(bytes))
}

fn normalize_price_8(price: U256, feed_decimals: u8) -> U256 {
    if feed_decimals == 0 || feed_decimals == 8 {
        price
    } else if feed_decimals < 8 {
        price.saturating_mul(pow10(8 - feed_decimals))
    } else {
        price.checked_div(pow10(feed_decimals - 8)).unwrap_or(U256::ZERO)
    }
}

fn price_deviation_exceeds(p1: U256, p2: U256, max_bps: u64) -> bool {
    if max_bps == 0 || p1.is_zero() || p2.is_zero() {
        return false;
    }
    let (lo, hi) = if p1 <= p2 { (p1, p2) } else { (p2, p1) };
    (hi - lo).saturating_mul(U256::from(10_000u64)) > lo.saturating_mul(U256::from(max_bps))
}

fn pow10(n: u8) -> U256 {
    let mut acc = U256::from(1u64);
    for _ in 0..n {
        acc = acc.saturating_mul(U256::from(10u64));
    }
    acc
}
