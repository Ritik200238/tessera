//! On-chain storage layout.
//!
//! Layout is structured per `TDD.md` §3.2 — a single root struct on the
//! entrypoint with nested `#[storage]` substructs so each module touches a
//! disjoint slice. Field order is treated as a stable ABI (proxy-upgrade
//! compatible — see TDD D11): **never reorder, never delete; append only**.
//!
//! Two design notes:
//!
//! 1. `Config::asset_whitelist` is a flat `StorageMap<Address, AssetParams>`,
//!    plus a parallel `StorageVec<Address>` of *listed* tokens so health-factor
//!    aggregation can iterate them without an off-chain index. Removing an
//!    asset is intentionally not supported in the MVP (`AssetParams.enabled`
//!    flips to `false` instead — see `admin.rs`).
//! 2. `CollateralBook::tokens_of` tracks the set of tokens each user has *ever*
//!    deposited. We never shrink it; iteration during health-factor checks
//!    skips zero balances. Per TDD §3.2 this avoids a reentrancy surface and
//!    keeps deposits O(1).

extern crate alloc;
#[allow(unused_imports)]
use alloc::{vec, vec::Vec};

use alloy_primitives::Address;
use stylus_sdk::prelude::*;
use stylus_sdk::storage::*;

#[storage]
pub struct AssetParams {
    pub enabled: StorageBool,
    /// Token decimals captured at listing time (we assert 6 or 18 in admin).
    pub decimals: StorageU8,
    /// Max loan-to-value for *opening* a position, in bps.
    pub max_ltv_bps: StorageU16,
    /// LTV at which liquidation becomes legal, in bps.
    pub liq_threshold_bps: StorageU16,
    /// Bonus paid to the liquidator, in bps (e.g. 500 = 5%).
    pub liq_bonus_bps: StorageU16,
}

#[storage]
pub struct Config {
    pub owner: StorageAddress,
    pub agent: StorageAddress,
    pub usdc: StorageAddress,
    pub oracle: StorageAddress,
    /// Maximum age in seconds before an oracle round is considered stale.
    pub max_price_age_secs: StorageU64,
    /// Close factor (per TDD §3.4.4 default 5_000 = 50%).
    pub close_factor_bps: StorageU16,
    pub asset_whitelist: StorageMap<Address, AssetParams>,
    /// Parallel list of every token ever passed to `list_collateral`. Iteration
    /// target for HF aggregation.
    pub listed_assets: StorageVec<StorageAddress>,
}

#[storage]
pub struct LendingPool {
    /// Idle USDC sitting in the vault (i.e. `usdc.balanceOf(self) ==
    /// idle_assets + 0`). We track it in storage instead of querying because
    /// the external balance call is gas-heavy and `idle_assets` is mutated on
    /// every lender / borrower call anyway.
    pub idle_assets: StorageU256,
    /// USDC principal currently owed by borrowers (no accrued interest).
    pub total_principal: StorageU256,
    /// ERC-4626 share supply (USDC vault).
    pub total_shares: StorageU256,
    pub shares_of: StorageMap<Address, StorageU256>,
}

#[storage]
pub struct CollateralBook {
    /// user → token → amount.
    pub deposits: StorageMap<Address, StorageMap<Address, StorageU256>>,
    /// Set bit for each (user, token) so iteration skips never-deposited rows.
    pub has_deposited: StorageMap<Address, StorageMap<Address, StorageBool>>,
}

#[storage]
pub struct DebtBook {
    pub principal: StorageMap<Address, StorageU256>,
    pub user_index: StorageMap<Address, StorageU256>,
}

#[storage]
pub struct InterestState {
    /// Monotonic accumulator (1e18-scaled). Initialised to 1e18 on first
    /// `accrue_interest`; remains 0 until then so the lazy-init branch fires
    /// once.
    pub borrow_index: StorageU256,
    pub last_accrual_ts: StorageU64,
    pub base_rate_bps: StorageU16,
    pub slope1_bps: StorageU16,
    pub slope2_bps: StorageU16,
    pub optimal_util_bps: StorageU16,
    /// Reserve factor (defaults to 0 in MVP, see TDD §3.4.2).
    pub reserve_factor_bps: StorageU16,
}

#[storage]
pub struct PauseState {
    pub paused: StorageBool,
    /// Reentrancy lock — set during every state-mutating entrypoint.
    pub entered: StorageBool,
}
