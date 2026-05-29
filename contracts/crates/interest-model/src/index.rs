//! Borrow index accrual and per-user debt rehydration.
//!
//! Implements `TDD.md` §3.4.2. The borrow index is a monotonically
//! non-decreasing accumulator scaled by [`WAD`] (`1e18`). At protocol genesis
//! it is initialised to `WAD` and ticks forward on every state-changing call.

use alloy_primitives::U256;

#[cfg(test)]
use crate::WAD;
use crate::{BPS_DENOM, SECONDS_PER_YEAR};

/// Advances the borrow index by `dt_seconds` at the given APR.
///
/// ```text
/// rate_per_sec = borrow_rate_bps * 1e18 / (10_000 * SECONDS_PER_YEAR)
/// new_index    = old_index * (1e18 + rate_per_sec * dt) / 1e18
/// ```
///
/// Algebraically simplified (and computed) as:
///
/// ```text
/// numerator   = 10_000 * SECONDS_PER_YEAR + borrow_rate_bps * dt
/// new_index   = old_index * numerator / (10_000 * SECONDS_PER_YEAR)
/// ```
///
/// Both forms are identical, but the simplified form avoids a 1e18 round-trip
/// and the precision loss that comes with it. We keep multiply-before-divide
/// so a small `old_index` is never zeroed by an intermediate truncation.
///
/// # Properties
/// - `borrow_rate_bps == 0` ⇒ `new_index == old_index` (no interest).
/// - `dt_seconds == 0`     ⇒ `new_index == old_index` (no time passed).
/// - `new_index >= old_index` always (invariant I5 from `TDD.md` §8.3).
///
/// # Overflow
///
/// The factor `numerator / denominator` is bounded above by
/// `1 + borrow_rate * dt / (10_000 * SECONDS_PER_YEAR)`. For a 60_000 bp
/// (600% APR) rate sustained over 100 years, the factor is ~601. Even
/// multiplying a `U256::MAX / 1024` index by 601 stays inside `U256`; we use
/// [`U256::saturating_mul`] as belt-and-braces against absurd `dt` inputs.
#[must_use]
pub fn accrue_index(old_index: U256, borrow_rate_bps: u32, dt_seconds: u64) -> U256 {
    if borrow_rate_bps == 0 || dt_seconds == 0 {
        return old_index;
    }
    // denominator = 10_000 * SECONDS_PER_YEAR; fits in u64 (~3.15e11).
    let denom_u64 = u64::from(BPS_DENOM) * SECONDS_PER_YEAR;
    // numerator = denom + borrow_rate_bps * dt; fits in u128 worst case
    // (60_000 * 2^64 ~ 2^80), use u128 to be safe.
    let rate_times_dt = u128::from(borrow_rate_bps) * u128::from(dt_seconds);
    let numerator_u128 = u128::from(denom_u64).saturating_add(rate_times_dt);

    let numerator = U256::from(numerator_u128);
    let denominator = U256::from(denom_u64);

    old_index
        .saturating_mul(numerator)
        .checked_div(denominator)
        // denominator is a non-zero compile-time constant; fallback solely to
        // avoid `unwrap()`.
        .unwrap_or(old_index)
}

/// Current debt for a single borrower given their snapshot index.
///
/// ```text
/// debt = principal * current_index / user_index
/// ```
///
/// Returns `0` when `user_index == 0` (the user has never borrowed; their
/// principal must also be 0 in that case — see invariant I3) or when
/// `principal == 0`.
///
/// Multiplies before dividing so a `principal` near the index scale does not
/// lose precision.
///
/// # Overflow
///
/// `principal * current_index` fits in `U256` for any realistic input: even a
/// `principal` of `2^192` (vastly more than the total USDC supply) multiplied
/// by an index of `2^64 * WAD ≈ 2^124` stays inside `U256`. Saturation
/// applies a defensive cap.
#[must_use]
pub fn current_debt(principal: U256, current_index: U256, user_index: U256) -> U256 {
    if principal.is_zero() || user_index.is_zero() {
        return U256::ZERO;
    }
    principal
        .saturating_mul(current_index)
        .checked_div(user_index)
        .unwrap_or(U256::ZERO)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn zero_rate_is_identity() {
        let idx = U256::from(WAD);
        assert_eq!(accrue_index(idx, 0, 60), idx);
    }

    #[test]
    fn zero_dt_is_identity() {
        let idx = U256::from(WAD);
        assert_eq!(accrue_index(idx, 1_000, 0), idx);
    }

    /// `TDD.md` baseline: index=1e18, rate=1000 bps (10% APY), dt=1 year
    /// ≈ 1.1e18.
    #[test]
    fn one_year_at_10_percent_is_about_one_point_one_wad() {
        let idx = U256::from(WAD);
        let new_idx = accrue_index(idx, 1_000, SECONDS_PER_YEAR);
        // Simple-interest formula (no compounding mid-year): 1.10e18 exact.
        assert_eq!(new_idx, U256::from(1_100_000_000_000_000_000u128));
    }

    #[test]
    fn monotonic_non_decreasing() {
        let idx = U256::from(WAD);
        let a = accrue_index(idx, 500, 60);
        let b = accrue_index(a, 500, 60);
        assert!(a >= idx);
        assert!(b >= a);
    }

    #[test]
    fn current_debt_zero_principal_is_zero() {
        assert_eq!(
            current_debt(U256::ZERO, U256::from(WAD), U256::from(WAD)),
            U256::ZERO
        );
    }

    #[test]
    fn current_debt_zero_user_index_is_zero() {
        assert_eq!(
            current_debt(U256::from(100u64), U256::from(WAD), U256::ZERO),
            U256::ZERO
        );
    }

    #[test]
    fn current_debt_grows_with_index() {
        // user_index = 1e18, current_index = 1.1e18, principal = 1000
        // → debt = 1100
        assert_eq!(
            current_debt(
                U256::from(1_000u64),
                U256::from(1_100_000_000_000_000_000u128),
                U256::from(WAD),
            ),
            U256::from(1_100u64)
        );
    }
}
