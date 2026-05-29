//! Oracle adapter.
//!
//! The vault reads USD prices via a single helper, [`price_usd_8`], that wraps
//! Chainlink's `AggregatorV3Interface`. The same interface is satisfied by the
//! testnet [`MockOracle`] (`contracts/solidity/src/MockOracle.sol`), so the
//! mock→prod swap is a single address change (TDD §3.5).
//!
//! Staleness rule (reverts with [`VaultError::StalePrice`]): if
//! `block.timestamp - updatedAt > max_price_age_secs` for the resolved feed.
//! `answer <= 0` reverts with [`VaultError::OracleFailure`].

extern crate alloc;
#[allow(unused_imports)]
use alloc::{vec, vec::Vec};

use alloy_primitives::{Address, I256, U256};
use stylus_sdk::prelude::*;

use crate::errors::{OracleFailure, StalePrice, VaultError};

sol_interface! {
    /// Subset of Chainlink AggregatorV3 the vault depends on. The Tessera
    /// MockOracle implements `latestRoundData(address)` as a per-token feed.
    interface IAggregatorV3 {
        function latestRoundData(address token)
            external view returns (uint80, int256, uint256, uint256, uint80);
    }
}

/// Reads the 8-decimal USD price for `asset` from `oracle`, enforcing the
/// `max_age_secs` staleness bound against `now_ts`.
pub fn price_usd_8<S>(
    storage: &mut S,
    oracle: Address,
    asset: Address,
    now_ts: u64,
    max_age_secs: u64,
) -> Result<U256, VaultError>
where
    S: TopLevelStorage + HostAccess,
{
    if oracle.is_zero() || asset.is_zero() {
        return Err(VaultError::OracleFailure(OracleFailure { asset }));
    }
    let feed = IAggregatorV3::new(oracle);
    let (_round_id, answer, _started_at, updated_at, _answered_in_round) = feed
        .latest_round_data(storage.vm(), Call::new(), asset)
        .map_err(|_| VaultError::OracleFailure(OracleFailure { asset }))?;

    if answer <= I256::ZERO {
        return Err(VaultError::OracleFailure(OracleFailure { asset }));
    }
    let now_u256 = U256::from(now_ts);
    if updated_at > now_u256 {
        // Future-dated timestamp; reject as malformed.
        return Err(VaultError::OracleFailure(OracleFailure { asset }));
    }
    let age = now_u256 - updated_at;
    if age > U256::from(max_age_secs) {
        return Err(VaultError::StalePrice(StalePrice { asset }));
    }

    // `answer > 0` ⇒ widening cast to U256 is lossless.
    let bytes: [u8; 32] = answer.to_be_bytes();
    Ok(U256::from_be_bytes(bytes))
}
