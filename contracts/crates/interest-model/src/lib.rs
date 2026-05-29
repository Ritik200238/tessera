#![no_std]
//! # interest-model
//!
//! Pure, `no_std`, host-testable math primitives for the Tessera lending
//! protocol. This crate intentionally has **no** dependency on `stylus-sdk`,
//! Stylus storage, or any on-chain runtime; every function is a deterministic
//! mapping from inputs to outputs over [`alloy_primitives::U256`] (and small
//! integers for basis-point quantities).
//!
//! The Phase 2 Stylus vault crate imports these functions verbatim, so any
//! property-test that holds here also holds on-chain.
//!
//! All ratios are expressed in **basis points** (`1 bp = 0.01%`, `10_000 bp =
//! 100%`). The borrow index and the health factor are scaled by [`WAD`]
//! (`1e18`), matching Compound's `borrowIndex` convention referenced in
//! `TDD.md` §3.4.2.

pub mod health;
pub mod index;
pub mod liquidate;
pub mod rate;
pub mod utilization;

pub use health::{collateral_value_usd_8, health_factor, CollateralLeg};
pub use index::{accrue_index, current_debt};
pub use liquidate::{compute_liquidation, LiquidationResult};
pub use rate::{borrow_rate_bps, supply_rate_bps};
pub use utilization::utilization_bps;

use alloy_primitives::U256;

/// Basis-point denominator. `10_000 bp == 100%`.
pub const BPS_DENOM: u32 = 10_000;

/// 1e18 — the fixed-point scale used for the borrow index and the health
/// factor. Conventionally called a "wad". Exposed as `WAD` (and aliased as
/// [`RAY`] / [`INDEX_SCALE`] for the names used in `TDD.md` §3.4.3).
pub const WAD: u128 = 1_000_000_000_000_000_000;

/// Alias for [`WAD`]. The TDD refers to the index scale as `RAY`; classic Aave
/// uses `1e27` for `RAY`, but Tessera follows Compound and uses `1e18` for the
/// borrow index, so this alias points at [`WAD`].
pub const RAY: u128 = WAD;

/// Alias for [`WAD`]. Used in code paths that read more naturally as "the
/// borrow-index scale".
pub const INDEX_SCALE: u128 = WAD;

/// Seconds per year used for interest accrual.
///
/// We deliberately use Aave's `365 * 24 * 3600 = 31_536_000`, **not** the
/// astronomical `365.25 * 86_400 = 31_557_600`. The .25-day discrepancy is
/// economically negligible (~0.07% APR drift) and using the same constant as
/// Aave/Compound keeps cross-protocol APR comparisons honest and indexer
/// math identical. See `TDD.md` §3.4.2.
pub const SECONDS_PER_YEAR: u64 = 31_536_000;

/// Returns [`WAD`] as a [`U256`]. Convenience for callers that want to compare
/// a health factor to `1.0`, `1.1`, etc., without re-deriving the constant.
#[inline]
#[must_use]
pub fn wad_u256() -> U256 {
    U256::from(WAD)
}
