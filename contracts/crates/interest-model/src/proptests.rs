//! Property-based tests for the pure math primitives.
//!
//! Unit tests pin specific points; these assert the *invariants* that must hold
//! across the whole input space — the properties the Stylus vault relies on for
//! safety (utilization stays bounded, rates are monotone, the borrow index never
//! shrinks, more collateral never lowers a health factor, …). Because the vault
//! imports these functions verbatim, a property proven here holds on-chain.
//!
//! Run: `cargo test -p interest-model` (proptest shrinks any counterexample to
//! its minimal form).

use crate::{
    accrue_index, borrow_rate_bps, compute_liquidation, current_debt, health_factor,
    liquidation_bonus_bps, supply_rate_bps, utilization_bps, wad_u256, BPS_DENOM, WAD,
};
use alloy_primitives::U256;
use proptest::prelude::*;

// Reasonable on-chain bounds: amounts up to ~1e15 USDC (8-dec) fit in u128 and
// exercise the math without contriving overflow (U256 has 236 bits of headroom).
const MAX_AMT: u128 = 1_000_000_000_000_000_000_000_000; // 1e24
// Rate-curve params within their configured ranges (bps).
const MAX_BPS: u32 = BPS_DENOM; // 10_000

proptest! {
    // ---- utilization ----------------------------------------------------
    #[test]
    fn utilization_is_always_bounded(borrows in 0u128..=MAX_AMT, deposits in 0u128..=MAX_AMT) {
        let u = utilization_bps(U256::from(borrows), U256::from(deposits));
        prop_assert!(u <= BPS_DENOM, "utilization {u} exceeded 100%");
    }

    #[test]
    fn utilization_zero_borrows_is_zero(deposits in 1u128..=MAX_AMT) {
        prop_assert_eq!(utilization_bps(U256::ZERO, U256::from(deposits)), 0);
    }

    #[test]
    fn utilization_monotone_in_borrows(a in 0u128..=MAX_AMT, b in 0u128..=MAX_AMT, deposits in 1u128..=MAX_AMT) {
        let (lo, hi) = if a <= b { (a, b) } else { (b, a) };
        let u_lo = utilization_bps(U256::from(lo), U256::from(deposits));
        let u_hi = utilization_bps(U256::from(hi), U256::from(deposits));
        prop_assert!(u_hi >= u_lo, "more borrows lowered utilization: {u_lo} -> {u_hi}");
    }

    // ---- borrow rate curve ---------------------------------------------
    #[test]
    fn borrow_rate_monotone_in_utilization(
        ua in 0u32..=MAX_BPS, ub in 0u32..=MAX_BPS,
        base in 0u32..=2_000, slope1 in 0u32..=2_000, slope2 in 0u32..=60_000,
        optimal in 1u32..=MAX_BPS,
    ) {
        let (lo, hi) = if ua <= ub { (ua, ub) } else { (ub, ua) };
        let r_lo = borrow_rate_bps(lo, base, slope1, slope2, optimal);
        let r_hi = borrow_rate_bps(hi, base, slope1, slope2, optimal);
        prop_assert!(r_hi >= r_lo, "higher utilization lowered the borrow rate: {r_lo} -> {r_hi}");
    }

    #[test]
    fn borrow_rate_continuous_at_kink(
        base in 0u32..=2_000, slope1 in 0u32..=2_000, slope2 in 0u32..=60_000,
        optimal in 1u32..=MAX_BPS,
    ) {
        // At util == optimal both branches must yield base + slope1.
        prop_assert_eq!(borrow_rate_bps(optimal, base, slope1, slope2, optimal), base + slope1);
    }

    // ---- supply rate ----------------------------------------------------
    #[test]
    fn supply_rate_never_exceeds_borrow_rate(
        borrow in 0u32..=60_000, util in 0u32..=MAX_BPS, rf in 0u32..=MAX_BPS,
    ) {
        prop_assert!(supply_rate_bps(borrow, util, rf) <= borrow);
    }

    #[test]
    fn supply_rate_zero_when_no_utilization_or_full_reserve(borrow in 0u32..=60_000) {
        prop_assert_eq!(supply_rate_bps(borrow, 0, 1_000), 0);
        prop_assert_eq!(supply_rate_bps(borrow, 5_000, BPS_DENOM), 0);
    }

    // ---- health factor --------------------------------------------------
    #[test]
    fn health_factor_zero_debt_is_max(collateral in 0u128..=MAX_AMT) {
        prop_assert_eq!(health_factor(U256::from(collateral), U256::ZERO), U256::MAX);
    }

    #[test]
    fn health_factor_monotone_in_collateral(a in 0u128..=MAX_AMT, b in 0u128..=MAX_AMT, debt in 1u128..=MAX_AMT) {
        let (lo, hi) = if a <= b { (a, b) } else { (b, a) };
        let hf_lo = health_factor(U256::from(lo), U256::from(debt));
        let hf_hi = health_factor(U256::from(hi), U256::from(debt));
        prop_assert!(hf_hi >= hf_lo, "more collateral lowered the health factor");
    }

    #[test]
    fn health_factor_antitone_in_debt(collateral in 1u128..=MAX_AMT, a in 1u128..=MAX_AMT, b in 1u128..=MAX_AMT) {
        let (lo, hi) = if a <= b { (a, b) } else { (b, a) };
        let hf_less_debt = health_factor(U256::from(collateral), U256::from(lo));
        let hf_more_debt = health_factor(U256::from(collateral), U256::from(hi));
        prop_assert!(hf_more_debt <= hf_less_debt, "more debt raised the health factor");
    }

    // ---- borrow index ---------------------------------------------------
    #[test]
    fn index_never_shrinks(rate in 0u32..=60_000, dt in 0u64..=31_536_000u64) {
        let old = wad_u256();
        let next = accrue_index(old, rate, dt);
        prop_assert!(next >= old, "borrow index shrank");
    }

    #[test]
    fn index_identity_at_zero_time_or_rate(rate in 0u32..=60_000, dt in 0u64..=31_536_000u64) {
        let old = wad_u256();
        prop_assert_eq!(accrue_index(old, rate, 0), old);
        prop_assert_eq!(accrue_index(old, 0, dt), old);
    }

    // ---- current debt ---------------------------------------------------
    #[test]
    fn debt_grows_with_index(principal in 1u128..=MAX_AMT, growth in 0u64..=10_000u64) {
        // current_index >= user_index ⇒ debt >= principal (interest only accrues).
        let user_index = wad_u256();
        let current_index = user_index + U256::from(growth) * U256::from(1_000_000_000_000u64);
        let debt = current_debt(U256::from(principal), current_index, user_index);
        prop_assert!(debt >= U256::from(principal), "debt fell below principal as the index grew");
    }

    // ---- liquidation: seize never exceeds collateral balance (proof of N4) --
    #[test]
    fn liquidation_never_seizes_more_than_balance(
        debt in 1u128..=MAX_AMT,
        requested in 0u128..=MAX_AMT,
        bal in 0u128..=1_000_000_000_000_000_000_000u128,
        price in 1u128..=1_000_000_000_000u128,
        cf in 0u32..=20_000u32,
        bonus in 0u32..=5_000u32,
    ) {
        let res = compute_liquidation(
            U256::from(debt), U256::from(requested), U256::from(bal),
            18, U256::from(price), cf, bonus,
        );
        prop_assert!(res.seize_collateral <= U256::from(bal),
            "seized {} > balance {}", res.seize_collateral, bal);
    }

    // ---- liquidation bonus: bounded in [base, max], monotonic in depth ------
    #[test]
    fn bonus_within_bounds_and_monotonic(
        hf_num in 0u128..=2_000u128, base in 0u32..=2_000u32, extra in 0u32..=2_000u32,
    ) {
        let max = base + extra; // max >= base
        let hf = U256::from(WAD) * U256::from(hf_num) / U256::from(1_000u128); // hf in [0, 2.0]
        let b = liquidation_bonus_bps(hf, base, max);
        prop_assert!(b >= base && b <= max, "bonus {b} out of [{base},{max}]");
        // Deeper underwater (lower hf) never pays a smaller bonus.
        if hf_num > 0 {
            let deeper = U256::from(WAD) * U256::from(hf_num - 1) / U256::from(1_000u128);
            prop_assert!(liquidation_bonus_bps(deeper, base, max) >= b, "bonus fell as hf fell");
        }
    }
}
