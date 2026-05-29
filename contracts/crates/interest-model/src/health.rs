//! Collateral valuation and health factor.
//!
//! Implements `TDD.md` §3.4.1.

use alloy_primitives::U256;

use crate::{BPS_DENOM, WAD};

/// One row of a user's collateral table: an amount of some token, its decimals,
/// the current 8-decimal USD price (Chainlink convention), and that token's
/// liquidation threshold in basis points.
///
/// Decoupling the math from any specific storage layout keeps this crate
/// host-testable; the Stylus vault constructs a slice of these from its own
/// `StorageMap`s before calling [`collateral_value_usd_8`].
#[derive(Clone, Copy, Debug)]
pub struct CollateralLeg {
    /// Amount in the token's own units (i.e. raw on-chain balance).
    pub amount: U256,
    /// Decimals of the underlying token (e.g. 18 for tStock, 6 for USDC).
    pub decimals: u32,
    /// USD price scaled by `1e8`, per Chainlink's `AggregatorV3.latestAnswer`.
    pub price_usd_8: U256,
    /// Liquidation threshold in basis points (e.g. `8_500` for 85%).
    pub liq_threshold_bps: u32,
}

/// Sums each leg's `amount * price * threshold / 10000`, normalising to an
/// 8-decimal USD value (the same scale as Chainlink prices, so downstream
/// comparisons against the debt do not need a re-scale).
///
/// ```text
/// collateral_value_usd_8 = Σ  amount * price_usd_8 * liq_threshold_bps
///                            / (10^decimals * 10_000)
/// ```
///
/// Multiplication is performed **before** division on every leg to preserve
/// precision (the `mulDiv` discipline from `TDD.md` §7).
///
/// # Overflow
///
/// Every intermediate product is bounded by `amount * price * 10_000`. For a
/// realistic supply (`amount < 2^128`, `price < 2^64`, `bps <= 10_000 < 2^14`)
/// the product fits comfortably inside `U256`'s 256 bits. We use
/// [`U256::saturating_mul`] anyway so a malicious mock oracle cannot panic the
/// vault.
#[must_use]
pub fn collateral_value_usd_8(legs: &[CollateralLeg]) -> U256 {
    let mut acc = U256::ZERO;
    let bps_denom = U256::from(BPS_DENOM);
    for leg in legs {
        if leg.amount.is_zero() || leg.price_usd_8.is_zero() || leg.liq_threshold_bps == 0 {
            continue;
        }
        let scale = pow10(leg.decimals);
        // numerator = amount * price * threshold
        let numerator = leg
            .amount
            .saturating_mul(leg.price_usd_8)
            .saturating_mul(U256::from(leg.liq_threshold_bps));
        // denominator = 10^decimals * 10_000
        let denominator = scale.saturating_mul(bps_denom);
        if denominator.is_zero() {
            continue;
        }
        let leg_value = numerator.checked_div(denominator).unwrap_or(U256::ZERO);
        acc = acc.saturating_add(leg_value);
    }
    acc
}

/// Health factor scaled by [`WAD`] (`1e18`).
///
/// ```text
/// HF = collateral_value_usd_8 * 1e18 / debt_usd_8
/// ```
///
/// Returns [`U256::MAX`] when `debt_usd_8 == 0`, i.e. a position with no debt
/// is "infinitely healthy" (per `TDD.md` §3.4.1).
///
/// Because the numerator and denominator share the same 8-decimal USD scale,
/// the result is a dimensionless ratio scaled by `1e18` — directly comparable
/// to thresholds like `1.0e18`, `1.05e18`, `1.1e18`.
#[must_use]
pub fn health_factor(collateral_value_usd_8: U256, debt_usd_8: U256) -> U256 {
    if debt_usd_8.is_zero() {
        return U256::MAX;
    }
    collateral_value_usd_8
        .saturating_mul(U256::from(WAD))
        .checked_div(debt_usd_8)
        .unwrap_or(U256::ZERO)
}

/// `10^n` as a [`U256`]. Saturates to [`U256::MAX`] for absurd exponents; in
/// practice `n <= 30` for any real-world ERC-20.
#[inline]
fn pow10(n: u32) -> U256 {
    let mut acc = U256::from(1u64);
    let ten = U256::from(10u64);
    for _ in 0..n {
        acc = acc.saturating_mul(ten);
    }
    acc
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn zero_debt_is_max_hf() {
        assert_eq!(health_factor(U256::from(1_000u64), U256::ZERO), U256::MAX);
        assert_eq!(health_factor(U256::ZERO, U256::ZERO), U256::MAX);
    }

    #[test]
    fn zero_collateral_is_zero_hf() {
        assert_eq!(health_factor(U256::ZERO, U256::from(1_000u64)), U256::ZERO);
    }

    #[test]
    fn equal_collateral_and_debt_is_one_wad() {
        assert_eq!(
            health_factor(U256::from(1_000u64), U256::from(1_000u64)),
            U256::from(WAD)
        );
    }

    /// Demo scenario from `TDD.md` §8.3:
    ///
    /// $1600 collateral with 85% liquidation threshold, $1200 debt
    /// → HF = 1600 * 0.85 * 1e18 / 1200 = 1_133_333_333_333_333_333 ≈ 1.13e18
    #[test]
    fn tdd_demo_scenario_hf_is_one_point_one_three() {
        // One leg: 10 tStock @ $160, 18 decimals, threshold 85%
        let leg = CollateralLeg {
            amount: U256::from(10u64) * pow10(18),
            decimals: 18,
            price_usd_8: U256::from(16_000_000_000_u128), // $160.00 @ 1e8
            liq_threshold_bps: 8_500,
        };
        let coll_8 = collateral_value_usd_8(&[leg]);
        // $1600 * 0.85 = $1360, scaled by 1e8 → 1_360 * 1e8.
        assert_eq!(coll_8, U256::from(1_360u128) * pow10(8));

        // Debt: $1200 @ 8 decimals.
        let debt_8 = U256::from(1_200u128) * pow10(8);
        let hf = health_factor(coll_8, debt_8);

        // 1360 / 1200 = 1.13333... → HF = 1_133_333_333_333_333_333
        let expected = U256::from(1_133_333_333_333_333_333u128);
        assert_eq!(hf, expected);
    }

    #[test]
    fn multi_leg_sums_correctly() {
        let a = CollateralLeg {
            amount: U256::from(1u64) * pow10(18),
            decimals: 18,
            price_usd_8: U256::from(10_000_000_000_u128),
            liq_threshold_bps: 10_000,
        };
        let b = CollateralLeg {
            amount: U256::from(2u64) * pow10(18),
            decimals: 18,
            price_usd_8: U256::from(5_000_000_000_u128),
            liq_threshold_bps: 10_000,
        };
        // Both legs: $100 and $100 → $200 @ 1e8.
        assert_eq!(
            collateral_value_usd_8(&[a, b]),
            U256::from(200u128) * pow10(8)
        );
    }

    #[test]
    fn empty_collateral_is_zero() {
        assert_eq!(collateral_value_usd_8(&[]), U256::ZERO);
    }

    #[test]
    fn zero_threshold_contributes_nothing() {
        let leg = CollateralLeg {
            amount: U256::from(1u64) * pow10(18),
            decimals: 18,
            price_usd_8: U256::from(10_000_000_000_u128),
            liq_threshold_bps: 0,
        };
        assert_eq!(collateral_value_usd_8(&[leg]), U256::ZERO);
    }
}
