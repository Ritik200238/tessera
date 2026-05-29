//! Two-slope borrow rate curve and the derived supply rate.
//!
//! Implements `TDD.md` §3.4.3 exactly. All inputs and outputs are in basis
//! points (`u32`), so the entire curve fits in machine integers — no `U256`
//! arithmetic is required.

use crate::BPS_DENOM;

/// Two-slope (kinked) borrow rate curve.
///
/// ```text
/// if util <= optimal:
///     rate = base + (util * slope1) / optimal
/// else:
///     excess     = util - optimal
///     max_excess = 10_000 - optimal
///     rate       = base + slope1 + (excess * slope2) / max_excess
/// ```
///
/// At `util == optimal`, both branches yield `base + slope1`, so the curve is
/// continuous (this is asserted by a property test).
///
/// # Edge cases
/// - `optimal_util_bps == 0` is treated as "always on the steep slope": we
///   fall straight into the post-kink branch with `max_excess = 10_000`.
/// - `optimal_util_bps >= 10_000` is treated as "always on the gentle slope"
///   with `optimal = 10_000`, which keeps the curve well-defined.
/// - `util_bps > 10_000` is clamped to `10_000`. The vault should never pass
///   such a value (utilization is itself clamped — see [`crate::utilization_bps`])
///   but defensive clamping here means an out-of-band caller cannot trigger
///   pathological rates.
///
/// # Overflow
///
/// All multiplications are bounded by `10_000 * 60_000 = 6e8`, which fits in
/// `u32` (`~4.29e9`). We still use `u64` intermediates as belt-and-braces.
#[must_use]
pub fn borrow_rate_bps(
    util_bps: u32,
    base_bps: u32,
    slope1_bps: u32,
    slope2_bps: u32,
    optimal_util_bps: u32,
) -> u32 {
    let util = util_bps.min(BPS_DENOM);
    let optimal = optimal_util_bps.min(BPS_DENOM);

    if util <= optimal {
        if optimal == 0 {
            // Degenerate config: no gentle slope. The whole range is "post-kink".
            // Fall through to the else-branch logic by treating util as excess.
            return saturating_post_kink(base_bps, slope1_bps, slope2_bps, util, BPS_DENOM);
        }
        let bump = (u64::from(util) * u64::from(slope1_bps)) / u64::from(optimal);
        u32::try_from(u64::from(base_bps).saturating_add(bump)).unwrap_or(u32::MAX)
    } else {
        let max_excess = BPS_DENOM - optimal;
        if max_excess == 0 {
            // optimal == 10_000 → curve has no steep section; cap at base+slope1.
            return base_bps.saturating_add(slope1_bps);
        }
        let excess = util - optimal;
        saturating_post_kink(base_bps, slope1_bps, slope2_bps, excess, max_excess)
    }
}

#[inline]
fn saturating_post_kink(base: u32, slope1: u32, slope2: u32, excess: u32, max_excess: u32) -> u32 {
    // `max_excess` is guaranteed non-zero by the caller.
    let bump = (u64::from(excess) * u64::from(slope2)) / u64::from(max_excess);
    let total = u64::from(base)
        .saturating_add(u64::from(slope1))
        .saturating_add(bump);
    u32::try_from(total).unwrap_or(u32::MAX)
}

/// Supply (lender) APR in basis points.
///
/// ```text
/// supply = borrow_rate * util * (10_000 - reserve_factor) / 10_000^2
/// ```
///
/// Equivalent to "the slice of borrower interest that flows to lenders after
/// the protocol reserve is taken off the top".
///
/// `reserve_factor_bps` is clamped to `10_000` — a 100% reserve factor means
/// lenders earn nothing, which is valid (if unusual) configuration.
#[must_use]
pub fn supply_rate_bps(borrow_rate: u32, util_bps: u32, reserve_factor_bps: u32) -> u32 {
    let util = util_bps.min(BPS_DENOM);
    let rf = reserve_factor_bps.min(BPS_DENOM);
    let net = u64::from(BPS_DENOM - rf);
    // borrow_rate * util * net fits in u64: 60_000 * 10_000 * 10_000 = 6e12 ≪ 2^64.
    let numerator = u64::from(borrow_rate) * u64::from(util) * net;
    let denom = u64::from(BPS_DENOM) * u64::from(BPS_DENOM);
    u32::try_from(numerator / denom).unwrap_or(u32::MAX)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Aave-style MVP defaults from TDD §3.4.3.
    const BASE: u32 = 200;
    const SLOPE1: u32 = 400;
    const SLOPE2: u32 = 6_000;
    const OPTIMAL: u32 = 8_000;

    #[test]
    fn at_zero_util_is_base() {
        assert_eq!(borrow_rate_bps(0, BASE, SLOPE1, SLOPE2, OPTIMAL), BASE);
    }

    #[test]
    fn at_optimal_util_is_base_plus_slope1() {
        // TDD §3.4.3: "~6% borrow at 80% utilization" → 600 bps.
        assert_eq!(borrow_rate_bps(8_000, BASE, SLOPE1, SLOPE2, OPTIMAL), 600);
    }

    #[test]
    fn at_full_util_is_base_plus_slope1_plus_slope2() {
        // TDD §3.4.3: "~62% at 100%" → 6600 bps.
        assert_eq!(
            borrow_rate_bps(10_000, BASE, SLOPE1, SLOPE2, OPTIMAL),
            6_600
        );
    }

    #[test]
    fn continuous_at_kink() {
        let left = borrow_rate_bps(8_000, BASE, SLOPE1, SLOPE2, OPTIMAL);
        let right = borrow_rate_bps(8_001, BASE, SLOPE1, SLOPE2, OPTIMAL);
        // Slope2 is much steeper than slope1, so right > left, but by a small
        // amount (slope2 / max_excess = 6000/2000 = 3 bps per 1 bp of util).
        assert!(right > left);
        assert!(right - left <= 3 + 1);
    }

    #[test]
    fn util_above_10000_is_clamped() {
        assert_eq!(
            borrow_rate_bps(20_000, BASE, SLOPE1, SLOPE2, OPTIMAL),
            borrow_rate_bps(10_000, BASE, SLOPE1, SLOPE2, OPTIMAL)
        );
    }

    #[test]
    fn supply_rate_zero_util_is_zero() {
        assert_eq!(supply_rate_bps(600, 0, 0), 0);
    }

    #[test]
    fn supply_rate_no_reserve_factor() {
        // borrow=600 bps, util=80%, rf=0 → 600 * 0.8 = 480 bps
        assert_eq!(supply_rate_bps(600, 8_000, 0), 480);
    }

    #[test]
    fn supply_rate_with_10pct_reserve() {
        // 600 * 0.8 * 0.9 = 432 bps
        assert_eq!(supply_rate_bps(600, 8_000, 1_000), 432);
    }

    #[test]
    fn optimal_at_10000_caps_at_base_plus_slope1() {
        assert_eq!(
            borrow_rate_bps(10_000, BASE, SLOPE1, SLOPE2, 10_000),
            BASE + SLOPE1
        );
    }

    #[test]
    fn optimal_at_zero_uses_steep_slope() {
        // Should not panic; should monotonically increase in util.
        let r0 = borrow_rate_bps(0, BASE, SLOPE1, SLOPE2, 0);
        let r1 = borrow_rate_bps(5_000, BASE, SLOPE1, SLOPE2, 0);
        let r2 = borrow_rate_bps(10_000, BASE, SLOPE1, SLOPE2, 0);
        assert!(r0 <= r1 && r1 <= r2);
    }
}
