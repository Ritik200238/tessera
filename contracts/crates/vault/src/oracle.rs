//! Oracle adapter — now a thin client of the PriceGuard router (Phase 5).
//!
//! All price policy — staleness, dual-feed deviation, decimal normalization,
//! market-hours, and the circuit breaker — lives in the separate `PriceGuard`
//! contract (`contracts/crates/priceguard`). The vault reads prices and the
//! market/halt state through this interface, which keeps the vault's own code
//! under the 24KB ceiling and lets the oracle policy evolve behind the timelock
//! without ever touching the funds-holding vault. `config.oracle` holds the
//! PriceGuard address.

extern crate alloc;
#[allow(unused_imports)]
use alloc::{vec, vec::Vec};

use stylus_sdk::prelude::*;

sol_interface! {
    interface IPriceGuard {
        /// Validated 8-decimal USD price (reverts on stale / bad / deviating feed).
        function getPrice(address token) external returns (uint256);
        /// Circuit breaker: vault blocks NEW risk (borrow/withdraw) when true.
        function halted() external view returns (bool);
        /// Underlying market closed: vault haircuts new borrows when true.
        function marketClosed() external view returns (bool);
    }
}
