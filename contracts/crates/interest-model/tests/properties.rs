//! Property tests for the `interest-model` crate.
//!
//! These tests are the host-side proof of the invariants `TDD.md` §8.3
//! (`I1`–`I5`) that touch the math layer. They are run via plain
//! `cargo test -p interest-model`; no Stylus harness required.

use alloy_primitives::U256;
use interest_model::{
    accrue_index, borrow_rate_bps, collateral_value_usd_8, compute_liquidation, current_debt,
    health_factor, supply_rate_bps, utilization_bps, CollateralLeg, BPS_DENOM, SECONDS_PER_YEAR,
};
use proptest::prelude::*;

// Aave-style MVP defaults from TDD §3.4.3.
const BASE: u32 = 200;
const SLOPE1: u32 = 400;
const SLOPE2: u32 = 6_000;
const OPTIMAL: u32 = 8_000;

// Slightly relaxed proptest config: 256 cases per property gives a tighter
// search than the default 100 without slowing CI noticeably.
fn cfg() -> ProptestConfig {
    ProptestConfig {
        cases: 256,
        max_shrink_iters: 4_096,
        ..ProptestConfig::default()
    }
}

// ---------------------------------------------------------------------------
// Utilization
// ---------------------------------------------------------------------------

proptest! {
    #![proptest_config(cfg())]

    /// More borrows ⇒ utilization rises (or stays equal once saturated).
    #[test]
    fn prop_utilization_monotonic_in_borrows(
        deposits in 1u128..=u128::MAX / 2,
        b0 in 0u128..=u128::MAX / 4,
        delta in 0u128..=u128::MAX / 4,
    ) {
        let d = U256::from(deposits);
        let u0 = utilization_bps(U256::from(b0), d);
        let u1 = utilization_bps(U256::from(b0).saturating_add(U256::from(delta)), d);
        prop_assert!(u1 >= u0);
    }

    /// Utilization is always in `[0, 10_000]`.
    #[test]
    fn prop_utilization_in_range(
        b in 0u128..=u128::MAX,
        d in 0u128..=u128::MAX,
    ) {
        let u = utilization_bps(U256::from(b), U256::from(d));
        prop_assert!(u <= BPS_DENOM);
    }
}

// ---------------------------------------------------------------------------
// Borrow rate curve
// ---------------------------------------------------------------------------

proptest! {
    #![proptest_config(cfg())]

    /// Higher utilization ⇒ higher (or equal) borrow rate.
    #[test]
    fn prop_borrow_rate_monotonic_in_util(
        u0 in 0u32..=10_000,
        bump in 0u32..=10_000,
    ) {
        let u1 = u0.saturating_add(bump).min(10_000);
        let r0 = borrow_rate_bps(u0, BASE, SLOPE1, SLOPE2, OPTIMAL);
        let r1 = borrow_rate_bps(u1, BASE, SLOPE1, SLOPE2, OPTIMAL);
        prop_assert!(r1 >= r0, "r0={r0}, r1={r1}, u0={u0}, u1={u1}");
    }

    /// Curve is continuous at the kink: at `util == optimal` and one bp
    /// either side, the rate jumps by at most slope2/max_excess bps.
    #[test]
    fn prop_borrow_rate_continuous_at_kink(
        optimal in 1u32..=9_999,
    ) {
        let at  = borrow_rate_bps(optimal, BASE, SLOPE1, SLOPE2, optimal);
        let one_below = borrow_rate_bps(optimal.saturating_sub(1), BASE, SLOPE1, SLOPE2, optimal);
        let one_above = borrow_rate_bps(optimal.saturating_add(1).min(10_000), BASE, SLOPE1, SLOPE2, optimal);

        let max_excess = 10_000 - optimal;
        let slope2_step = if max_excess > 0 { SLOPE2 / max_excess + 1 } else { SLOPE2 };
        let slope1_step = SLOPE1 / optimal + 1;
        let tol = slope1_step.max(slope2_step).max(1);

        prop_assert!(at.abs_diff(one_below) <= tol);
        prop_assert!(at.abs_diff(one_above) <= tol);
    }

    /// Supply rate ≤ borrow rate (lenders never earn more than borrowers pay).
    #[test]
    fn prop_supply_rate_le_borrow_rate(
        u in 0u32..=10_000,
        rf in 0u32..=10_000,
    ) {
        let b = borrow_rate_bps(u, BASE, SLOPE1, SLOPE2, OPTIMAL);
        let s = supply_rate_bps(b, u, rf);
        prop_assert!(s <= b);
    }
}

// ---------------------------------------------------------------------------
// Health factor
// ---------------------------------------------------------------------------

proptest! {
    #![proptest_config(cfg())]

    /// More collateral ⇒ higher health factor.
    #[test]
    fn prop_hf_monotonic_in_collateral(
        coll0 in 0u128..=(u128::MAX / 2),
        bump in 0u128..=(u128::MAX / 4),
        debt in 1u128..=(u128::MAX / 4),
    ) {
        let hf0 = health_factor(U256::from(coll0), U256::from(debt));
        let hf1 = health_factor(
            U256::from(coll0).saturating_add(U256::from(bump)),
            U256::from(debt),
        );
        prop_assert!(hf1 >= hf0);
    }

    /// More debt ⇒ lower (or equal) health factor.
    #[test]
    fn prop_hf_monotonic_in_debt(
        coll in 0u128..=(u128::MAX / 2),
        d0 in 1u128..=(u128::MAX / 4),
        bump in 0u128..=(u128::MAX / 4),
    ) {
        let hf0 = health_factor(U256::from(coll), U256::from(d0));
        let hf1 = health_factor(
            U256::from(coll),
            U256::from(d0).saturating_add(U256::from(bump)),
        );
        prop_assert!(hf1 <= hf0);
    }

    /// Zero debt always yields U256::MAX (infinitely healthy).
    #[test]
    fn prop_hf_zero_debt_is_max(coll in 0u128..=u128::MAX) {
        prop_assert_eq!(health_factor(U256::from(coll), U256::ZERO), U256::MAX);
    }

    /// `collateral_value_usd_8` does not panic on arbitrary leg vectors and
    /// stays at zero when every leg has zero threshold.
    #[test]
    fn prop_collateral_value_zero_threshold(
        amounts in proptest::collection::vec(0u128..=(u128::MAX / 2), 0..8),
    ) {
        let legs: alloc::vec::Vec<CollateralLeg> = amounts
            .into_iter()
            .map(|a| CollateralLeg {
                amount: U256::from(a),
                decimals: 18,
                price_usd_8: U256::from(10_000_000_000_u128),
                liq_threshold_bps: 0,
            })
            .collect();
        prop_assert_eq!(collateral_value_usd_8(&legs), U256::ZERO);
    }
}

// ---------------------------------------------------------------------------
// Borrow index (Invariant I5: monotonic non-decreasing)
// ---------------------------------------------------------------------------

proptest! {
    #![proptest_config(cfg())]

    /// `accrue_index` never decreases the index.
    #[test]
    fn prop_index_monotonic_non_decreasing(
        old_idx in 1u128..=(u128::MAX / 2),
        rate in 0u32..=60_000,
        dt   in 0u64..=(SECONDS_PER_YEAR * 10),
    ) {
        let old = U256::from(old_idx);
        let new = accrue_index(old, rate, dt);
        prop_assert!(new >= old);
    }

    /// Composition: accruing twice gives the same as accruing once over the
    /// summed dt (within a 1-wei rounding tolerance per step). We only assert
    /// non-decreasing here since the algebra is multiply-then-divide.
    #[test]
    fn prop_index_composes_monotonically(
        old_idx in 1u128..=(u128::MAX / 4),
        rate in 0u32..=60_000,
        dt1  in 0u64..=SECONDS_PER_YEAR,
        dt2  in 0u64..=SECONDS_PER_YEAR,
    ) {
        let old = U256::from(old_idx);
        let mid = accrue_index(old, rate, dt1);
        let end = accrue_index(mid, rate, dt2);
        prop_assert!(end >= mid);
        prop_assert!(mid >= old);
    }

    /// `current_debt` is monotonic in the current index.
    #[test]
    fn prop_current_debt_monotonic_in_index(
        principal in 0u128..=(u128::MAX / 4),
        user_idx in 1u128..=(u128::MAX / 4),
        cur_idx in 1u128..=(u128::MAX / 4),
    ) {
        let d0 = current_debt(
            U256::from(principal),
            U256::from(cur_idx),
            U256::from(user_idx),
        );
        let d1 = current_debt(
            U256::from(principal),
            U256::from(cur_idx).saturating_add(U256::from(1u64)),
            U256::from(user_idx),
        );
        prop_assert!(d1 >= d0);
    }
}

// ---------------------------------------------------------------------------
// Liquidation
// ---------------------------------------------------------------------------

proptest! {
    #![proptest_config(cfg())]

    /// Close-factor enforced: actual repay never exceeds `debt * cf / BPS`.
    #[test]
    fn prop_liquidation_respects_close_factor(
        debt_usdc in 1u128..=(u128::MAX / 4),
        requested in 0u128..=(u128::MAX / 4),
        cf in 0u32..=10_000,
    ) {
        let res = compute_liquidation(
            U256::from(debt_usdc),
            U256::from(requested),
            U256::from(u128::MAX / 2),
            18,
            U256::from(10_000_000_000_u128),
            cf,
            500,
        );
        let max_repay = U256::from(debt_usdc)
            .saturating_mul(U256::from(cf))
            / U256::from(10_000u64);
        prop_assert!(res.repay_usdc <= max_repay);
        prop_assert!(res.repay_usdc <= U256::from(requested));
    }

    /// With cf = 5000 (default), repay ≤ debt/2.
    #[test]
    fn prop_default_close_factor_is_half(
        debt_usdc in 1u128..=(u128::MAX / 4),
        requested in 0u128..=(u128::MAX / 4),
    ) {
        let res = compute_liquidation(
            U256::from(debt_usdc),
            U256::from(requested),
            U256::from(u128::MAX / 2),
            18,
            U256::from(10_000_000_000_u128),
            5_000,
            500,
        );
        prop_assert!(res.repay_usdc <= U256::from(debt_usdc) / U256::from(2u64));
    }

    /// Seize is always ≤ collateral balance.
    #[test]
    fn prop_seize_le_balance(
        debt_usdc in 1u128..=u64::MAX as u128,
        requested in 0u128..=u64::MAX as u128,
        bal in 0u128..=u64::MAX as u128,
        decimals in 0u32..=24,
        price in 1u128..=u64::MAX as u128,
        bonus in 0u32..=5_000,
    ) {
        let res = compute_liquidation(
            U256::from(debt_usdc),
            U256::from(requested),
            U256::from(bal),
            decimals,
            U256::from(price),
            5_000,
            bonus,
        );
        prop_assert!(res.seize_collateral <= U256::from(bal));
    }

    /// Liquidator-profitability: when seize is NOT clamped, the USD value of
    /// seized collateral is at least the USD value of the repay (the bonus
    /// makes it strictly greater, modulo rounding).
    #[test]
    fn prop_seize_value_ge_repay_value_when_unclamped(
        debt_usdc in 1_000_000u128..=(u128::MAX / 8),
        requested in 1u128..=(u128::MAX / 8),
        price_usd in 1u128..=1_000_000u128,  // $0.01..$10_000
        bonus in 0u32..=2_000,
    ) {
        let price = U256::from(price_usd) * U256::from(100_000_000u64); // 1e8
        let huge_bal = U256::from(u128::MAX); // ensure no clamping
        let res = compute_liquidation(
            U256::from(debt_usdc),
            U256::from(requested),
            huge_bal,
            18,
            price,
            5_000,
            bonus,
        );
        // seize_value_usd_8 = seize_collateral * price / 10^18
        // repay_value_usd_8 = repay_usdc * 100  (USDC 6dp → USD 8dp)
        let seize_value_usd_8 = res
            .seize_collateral
            .saturating_mul(price)
            / (U256::from(10u64).pow(U256::from(18u64)));
        let repay_value_usd_8 = res.repay_usdc.saturating_mul(U256::from(100u64));
        // Allow a small absolute slack for integer-division rounding (1 wei
        // of collateral at 1e18 decimals is dust).
        let slack = U256::from(10u64); // 1e-7 USD ≈ negligible
        // Only meaningful when seize wasn't clamped by collateral balance.
        // With tiny prices and huge repays, even u128::MAX collateral can
        // be insufficient — that case is correctly handled by the clamp
        // path and is exercised by other properties.
        if res.seize_collateral < huge_bal {
            prop_assert!(
                seize_value_usd_8.saturating_add(slack) >= repay_value_usd_8,
                "seize_value={seize_value_usd_8}, repay_value={repay_value_usd_8}"
            );
        }
    }
}

// ---------------------------------------------------------------------------
// Overflow safety: extreme inputs must not panic.
// ---------------------------------------------------------------------------

proptest! {
    #![proptest_config(ProptestConfig { cases: 64, ..cfg() })]

    /// Every public function survives `U256::MAX`-ish inputs without
    /// panicking. This is the "no overflow" guarantee from the task spec.
    #[test]
    fn prop_no_overflow_on_max_inputs(
        scratch in any::<u64>(),
    ) {
        // Use the scratch byte to perturb one input so proptest treats each
        // case as distinct (otherwise it would constant-fold to one case).
        let big = U256::MAX - U256::from(scratch);

        let _ = utilization_bps(big, big);
        let _ = borrow_rate_bps(u32::MAX, u32::MAX, u32::MAX, u32::MAX, u32::MAX);
        let _ = supply_rate_bps(u32::MAX, u32::MAX, u32::MAX);
        let _ = health_factor(big, big);
        let _ = accrue_index(big, u32::MAX, u64::MAX);
        let _ = current_debt(big, big, big);
        let _ = compute_liquidation(big, big, big, 30, big, u32::MAX, u32::MAX);
    }
}

// `alloc` is needed in test scope for the `Vec` used above; tests link std,
// so this is fine.
extern crate alloc;
