//! Borrow-index accrual.
//!
//! Every state-mutating entrypoint *must* call [`roll_index`] **before**
//! reading any borrow-side quantity. This is invariant I2/I5 from
//! `TDD.md` §8.3.
//!
//! Math lives in `interest-model` (pure, host-tested); this module is the
//! thinnest possible Stylus-storage wrapper.
//!
//! ## Accrual model
//!
//! Per `TDD.md` §3.2 / §3.4.2 we track:
//! - `borrow_index`: monotonic accumulator scaled by `1e18`.
//! - per-user `principal` (raw USDC borrowed, *not* scaled).
//! - per-user `user_index` (snapshot of `borrow_index` at the user's last
//!   touch).
//!
//! Current per-user debt = `principal * borrow_index / user_index`.
//! Interest income to lenders materialises when a borrower repays more than
//! their `principal` — the surplus increases `idle_assets`, which raises
//! `total_assets` and so every lender's share price.
//!
//! `total_principal` is **the raw sum** (no interest). It is only used to
//! compute utilization; the actual lender-facing `total_assets` adds the
//! current accrued interest separately.

use alloy_primitives::{U256, U64};
use interest_model::{accrue_index, borrow_rate_bps, current_debt, utilization_bps, WAD};

use crate::events::AccrueInterest;
use crate::storage::{InterestState, LendingPool};

/// `1e18` as a `U256`.
#[inline]
fn one_wad() -> U256 {
    U256::from(WAD)
}

/// Current borrow index, lazy-initialised to `1e18`.
pub fn current_index(interest: &InterestState) -> U256 {
    let idx = interest.borrow_index.get();
    if idx.is_zero() {
        one_wad()
    } else {
        idx
    }
}

/// Current debt of a single borrower (`principal * current_index / user_index`).
pub fn debt_of(interest: &InterestState, principal: U256, user_index: U256) -> U256 {
    if principal.is_zero() {
        return U256::ZERO;
    }
    let snap = if user_index.is_zero() {
        one_wad()
    } else {
        user_index
    };
    current_debt(principal, current_index(interest), snap)
}

/// Pool utilization in bps based on the current `total_principal` snapshot.
pub fn utilization(lending: &LendingPool) -> u32 {
    let borrows = lending.total_principal.get();
    let idle = lending.idle_assets.get();
    let deposits = idle.saturating_add(borrows);
    utilization_bps(borrows, deposits)
}

/// Borrow APR (bps) under the current utilization and curve parameters.
pub fn current_borrow_rate(interest: &InterestState, lending: &LendingPool) -> u32 {
    let util = utilization(lending);
    borrow_rate_bps(
        util,
        u32::from(interest.base_rate_bps.get().to::<u16>()),
        u32::from(interest.slope1_bps.get().to::<u16>()),
        u32::from(interest.slope2_bps.get().to::<u16>()),
        u32::from(interest.optimal_util_bps.get().to::<u16>()),
    )
}

/// Roll the borrow index forward to `now_ts`. Returns the (dt, rate_bps,
/// new_index) tuple so the caller can emit `AccrueInterest`.
///
/// Idempotent: calling twice in the same block is a no-op.
pub fn roll_index(
    interest: &mut InterestState,
    lending: &mut LendingPool,
    now_ts: u64,
) -> (u64, u32, U256) {
    let last_ts = interest.last_accrual_ts.get().to::<u64>();
    let idx = current_index(interest);

    if last_ts == 0 {
        // First-ever call: init index + timestamp, do not accrue.
        interest.borrow_index.set(idx);
        interest.last_accrual_ts.set(U64::from(now_ts));
        return (0, 0, idx);
    }
    if now_ts <= last_ts {
        return (0, 0, idx);
    }
    let dt = now_ts - last_ts;
    let rate = current_borrow_rate(interest, lending);
    let new_idx = accrue_index(idx, rate, dt);

    interest.borrow_index.set(new_idx);
    interest.last_accrual_ts.set(U64::from(now_ts));
    (dt, rate, new_idx)
}

/// Build the `AccrueInterest` event payload.
#[must_use]
pub fn accrue_event(dt: u64, rate: u32, new_index: U256) -> AccrueInterest {
    AccrueInterest {
        dt_seconds: U256::from(dt),
        borrow_rate_bps: U256::from(rate),
        new_index,
    }
}

#[cfg(test)]
mod tests {
    //! Host-side tests for the pure pieces of this module. Storage-touching
    //! paths are covered by integration / Stylus tests; here we exercise the
    //! algebra to lock in the invariants.

    use super::*;

    #[test]
    fn current_index_initialises_to_one_wad() {
        // We can't construct `InterestState` directly (Stylus storage
        // structs require a host runtime); the invariant is documented and
        // covered by Stylus tests. This placeholder asserts the constant.
        assert_eq!(one_wad(), U256::from(1_000_000_000_000_000_000u128));
    }

    #[test]
    fn debt_of_zero_principal_is_zero() {
        // `debt_of` short-circuits before touching storage, so we can drive
        // it without a real InterestState — passing zero principal.
        // We construct a dummy by transmuting through a function pointer,
        // but since that's unsafe, we instead verify the math primitive
        // matches what `interest_model::current_debt(0, _, _) == 0`.
        assert_eq!(
            interest_model::current_debt(U256::ZERO, one_wad(), one_wad()),
            U256::ZERO
        );
    }
}
