//! Liquidation math.
//!
//! Implements `TDD.md` §3.4.4. A liquidator repays USDC on behalf of an
//! undercollateralised borrower and receives the borrower's collateral plus
//! a configurable bonus.
//!
//! This crate assumes the debt asset is **6-decimal USDC** (the only
//! borrowable in the Tessera MVP). If a future asset is added the
//! [`compute_liquidation`] signature will need to grow a `debt_decimals` field;
//! see the PHASE 2 comment below.

use alloy_primitives::U256;

use crate::BPS_DENOM;

/// Decimals of the debt asset (USDC). Hard-coded for the MVP — see module-
/// level doc.
///
/// PHASE 2: when adding a second borrowable asset, promote this to a function
/// parameter on [`compute_liquidation`] and update every call site.
const DEBT_DECIMALS: u32 = 6;

/// 8 — Chainlink price decimals.
const PRICE_DECIMALS: u32 = 8;

/// The output of [`compute_liquidation`]: how much USDC the liquidator
/// actually pays and how much collateral they actually receive after clamping
/// against the close factor and the borrower's collateral balance.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct LiquidationResult {
    /// USDC (in 6-decimal units) the liquidator must transfer in.
    pub repay_usdc: U256,
    /// Collateral (in its own decimals) the liquidator receives.
    pub seize_collateral: U256,
}

/// Computes the repay/seize pair for a partial liquidation.
///
/// Algorithm (from `TDD.md` §3.4.4):
///
/// ```text
/// max_repay        = debt * close_factor_bps / 10_000
/// repay            = min(requested, max_repay)
/// seize_value_usd8 = repay * (10_000 + bonus_bps) / 10_000  *  10^(8 - 6)
/// seize_collateral = seize_value_usd8 * 10^collateral_decimals / price_usd_8
/// seize_collateral = min(seize_collateral, collateral_balance)
/// ```
///
/// All multiplications happen before divisions, in `U256`. If the seize
/// amount is clamped against `collateral_balance`, the **repay is NOT
/// reduced** — the liquidator still pays the requested amount but receives
/// less collateral; the residual debt remains and the vault is expected to
/// emit `BadDebtRealized` (per `TDD.md` §3.4.4 bad-debt remediation).
/// The Phase 2 vault is free to layer its own "scale repay down to whatever
/// the collateral can cover" policy on top; this primitive is the
/// conservative shape for the bonus-honouring liquidator.
///
/// # Edge cases
/// - `debt_usdc == 0`: returns `{0, 0}` (nothing to liquidate).
/// - `requested_repay == 0`: returns `{0, 0}`.
/// - `collateral_balance == 0`: `seize_collateral == 0`. The liquidator's
///   requested repay is preserved so the caller can surface the "no
///   collateral left, write off the residual" condition.
/// - `collateral_price_usd_8 == 0`: returns `{0, 0}`. A zero price means the
///   oracle is misbehaving and we refuse to compute a seize amount.
/// - `close_factor_bps > 10_000`: clamped to `10_000` (100% — full
///   liquidation, intended for extreme bad-debt cleanup paths).
///
/// # Overflow
///
/// The intermediate `repay * (10_000 + bonus) * 10^(price_decimals -
/// debt_decimals) * 10^collateral_decimals` is bounded by roughly
/// `2^96 * 2^14 * 100 * 10^18 ≈ 2^180`, comfortably inside `U256`.
/// [`U256::saturating_mul`] applies a defensive cap.
#[must_use]
pub fn compute_liquidation(
    debt_usdc: U256,
    requested_repay: U256,
    collateral_balance: U256,
    collateral_decimals: u32,
    collateral_price_usd_8: U256,
    close_factor_bps: u32,
    bonus_bps: u32,
) -> LiquidationResult {
    if debt_usdc.is_zero() || requested_repay.is_zero() {
        return LiquidationResult {
            repay_usdc: U256::ZERO,
            seize_collateral: U256::ZERO,
        };
    }

    // 1. Enforce close factor.
    let cf = close_factor_bps.min(BPS_DENOM);
    let max_repay = debt_usdc
        .saturating_mul(U256::from(cf))
        .checked_div(U256::from(BPS_DENOM))
        .unwrap_or(U256::ZERO);
    let repay = core::cmp::min(requested_repay, max_repay);

    if repay.is_zero() || collateral_price_usd_8.is_zero() {
        return LiquidationResult {
            repay_usdc: repay,
            seize_collateral: U256::ZERO,
        };
    }

    // 2. Convert repay (USDC, 6dp) → seize value in 8dp USD with bonus.
    //
    //    seize_value_usd_8 = repay * (BPS + bonus) / BPS  *  10^(8-6)
    //
    // We fold the 10^(8-6) = 100 factor into the numerator to keep one
    // division.
    let bonus_factor = U256::from(BPS_DENOM.saturating_add(bonus_bps));
    let price_to_debt_scale = pow10(PRICE_DECIMALS.saturating_sub(DEBT_DECIMALS));
    let seize_value_usd_8 = repay
        .saturating_mul(bonus_factor)
        .saturating_mul(price_to_debt_scale)
        .checked_div(U256::from(BPS_DENOM))
        .unwrap_or(U256::ZERO);

    // 3. Convert USD-value → collateral units.
    let coll_scale = pow10(collateral_decimals);
    let seize_amount = seize_value_usd_8
        .saturating_mul(coll_scale)
        .checked_div(collateral_price_usd_8)
        .unwrap_or(U256::ZERO);

    // 4. Clamp to collateral balance.
    let seize = core::cmp::min(seize_amount, collateral_balance);

    LiquidationResult {
        repay_usdc: repay,
        seize_collateral: seize,
    }
}

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

    /// USDC: 6 decimals helper.
    fn usdc(n: u128) -> U256 {
        U256::from(n) * pow10(6)
    }
    /// tStock: 18 decimals helper.
    fn stock(n: u128) -> U256 {
        U256::from(n) * pow10(18)
    }
    /// Price in USD with 8 decimals.
    fn price(usd: u128) -> U256 {
        U256::from(usd) * pow10(8)
    }

    /// `TDD.md` §3.4.4 demo: $1200 debt, 50% close factor, $140 stock,
    /// 5% bonus, plenty of collateral.
    ///
    /// Expect: repay = $600 USDC = 600_000_000 units;
    ///         seize = 4.5 tStock = 4_500_000_000_000_000_000 units.
    #[test]
    fn tdd_demo_liquidation() {
        let res = compute_liquidation(
            usdc(1_200), // debt
            usdc(1_000), // requested (will be clamped to max_repay)
            stock(10),   // collateral_balance
            18,          // collateral_decimals
            price(140),  // collateral_price_usd_8
            5_000,       // close factor 50%
            500,         // 5% bonus
        );
        assert_eq!(res.repay_usdc, usdc(600));
        assert_eq!(
            res.seize_collateral,
            U256::from(4_500_000_000_000_000_000u128)
        );
    }

    #[test]
    fn close_factor_clamps_requested_repay() {
        let res = compute_liquidation(
            usdc(1_000),
            usdc(900),
            stock(100),
            18,
            price(100),
            5_000,
            500,
        );
        // max_repay = 500; requested was 900 → repay = 500.
        assert_eq!(res.repay_usdc, usdc(500));
    }

    #[test]
    fn under_max_repay_is_honored() {
        let res = compute_liquidation(
            usdc(1_000),
            usdc(100),
            stock(100),
            18,
            price(100),
            5_000,
            500,
        );
        assert_eq!(res.repay_usdc, usdc(100));
    }

    #[test]
    fn zero_debt_returns_zero() {
        let res = compute_liquidation(
            U256::ZERO,
            usdc(100),
            stock(100),
            18,
            price(100),
            5_000,
            500,
        );
        assert_eq!(res.repay_usdc, U256::ZERO);
        assert_eq!(res.seize_collateral, U256::ZERO);
    }

    #[test]
    fn zero_price_refuses_seize() {
        let res = compute_liquidation(
            usdc(1_000),
            usdc(100),
            stock(100),
            18,
            U256::ZERO,
            5_000,
            500,
        );
        assert_eq!(res.seize_collateral, U256::ZERO);
    }

    #[test]
    fn seize_clamped_to_collateral_balance() {
        // tiny collateral balance vs large repay
        let res = compute_liquidation(
            usdc(10_000),
            usdc(5_000),
            stock(1), // only 1 tStock left
            18,
            price(140),
            5_000,
            500,
        );
        assert_eq!(res.seize_collateral, stock(1));
        // repay is NOT clamped — bad-debt accounting handled by vault.
        assert_eq!(res.repay_usdc, usdc(5_000));
    }
}
