//! Utilization rate.
//!
//! `utilization = total_borrows / total_deposits`, expressed in basis points.

use alloy_primitives::U256;

use crate::BPS_DENOM;

/// Computes pool utilization in basis points.
///
/// ```text
/// utilization_bps = total_borrows * 10_000 / total_deposits
/// ```
///
/// Returns `0` when `total_deposits == 0` (an empty pool is, by convention,
/// 0% utilized — see `TDD.md` §3.4.3).
///
/// The result is clamped to `BPS_DENOM` (`10_000`). In normal operation
/// `total_borrows <= total_deposits` so the raw ratio never exceeds 100%, but
/// during a same-block snapshot taken mid-interest-accrual it is possible to
/// observe `total_borrows > total_deposits` by a few wei of accrued interest;
/// clamping keeps downstream rate-curve math well-defined without panicking.
///
/// # Overflow
///
/// `total_borrows * 10_000` is computed in `U256`, which has 256 bits of
/// headroom — a `total_borrows` of `2^236` USDC would still not overflow, so
/// this multiplication is safe for any realistic on-chain value.
#[must_use]
pub fn utilization_bps(total_borrows: U256, total_deposits: U256) -> u32 {
    if total_deposits.is_zero() {
        return 0;
    }
    let bps = total_borrows
        .saturating_mul(U256::from(BPS_DENOM))
        .checked_div(total_deposits)
        // `total_deposits` is non-zero here, so division can never fail; this
        // fallback exists purely to avoid `unwrap()` per the crate's lint
        // policy.
        .unwrap_or(U256::ZERO);

    let denom = U256::from(BPS_DENOM);
    let clamped = if bps > denom { denom } else { bps };
    // `clamped <= 10_000 < u32::MAX`, so this cast is lossless.
    clamped.to::<u64>() as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_pool_is_zero_util() {
        assert_eq!(utilization_bps(U256::ZERO, U256::ZERO), 0);
        assert_eq!(utilization_bps(U256::from(100u64), U256::ZERO), 0);
    }

    #[test]
    fn half_borrowed_is_5000_bps() {
        assert_eq!(
            utilization_bps(U256::from(500u64), U256::from(1_000u64)),
            5_000
        );
    }

    #[test]
    fn fully_borrowed_is_10000_bps() {
        assert_eq!(
            utilization_bps(U256::from(1_000u64), U256::from(1_000u64)),
            10_000
        );
    }

    #[test]
    fn over_borrowed_is_clamped() {
        // Mid-accrual snapshot: borrows slightly exceed deposits.
        assert_eq!(
            utilization_bps(U256::from(1_001u64), U256::from(1_000u64)),
            10_000
        );
    }

    #[test]
    fn rounds_down() {
        // 1/3 = 33.33...% → 3333 bps (floor, never round up).
        assert_eq!(utilization_bps(U256::from(1u64), U256::from(3u64)), 3_333);
    }

    #[test]
    fn large_values_do_not_overflow() {
        let big = U256::from(1u128) << 200;
        // borrows == deposits → exactly 10_000 bps regardless of magnitude.
        assert_eq!(utilization_bps(big, big), 10_000);
    }
}
