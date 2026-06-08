//! Typed revert errors.
//!
//! Every variant has a stable Solidity-style selector that off-chain clients
//! (the Vibekit agent + the Next.js UI) can decode without ambiguity. The set
//! and naming mirror `TDD.md` §7 (errors) and §8.3 (security invariants).
//!
//! Stylus's `SolidityError` derive emits the four-byte selector + ABI encoding
//! for each variant automatically; we just have to declare them in `sol!`.

use alloy_sol_types::sol;
use stylus_sdk::prelude::SolidityError;

sol! {
    /// Caller is not the configured `owner`.
    error NotOwner();
    /// Caller is not the configured liquidation agent.
    error NotAgent();
    /// Vault is paused; all user-facing state mutations are rejected.
    error Paused();
    /// Vault is not paused (used by `unpause`).
    error NotPaused();
    /// A reentrant entry was attempted.
    error Reentrancy();
    /// Asset is not on the collateral whitelist.
    error AssetNotEnabled(address asset);
    /// Asset was already listed.
    error AssetAlreadyListed(address asset);
    /// A user-supplied parameter is outside its allowed range.
    error InvalidParameter();
    /// Zero address supplied where a real address is required.
    error ZeroAddress();
    /// Zero amount supplied where a positive amount is required.
    error ZeroAmount();
    /// User does not have enough collateral / share / debt balance to satisfy the call.
    error InsufficientBalance();
    /// Lender pool does not have enough idle USDC to satisfy the request.
    error InsufficientLiquidity();
    /// ERC-20 transfer (or transferFrom) returned `false` or reverted.
    error TokenTransferFailed();
    /// Oracle returned a price older than the configured staleness window.
    error StalePrice(address asset);
    /// Oracle reverted, returned 0, or returned a malformed payload.
    error OracleFailure(address asset);
    /// Post-action health factor would be below `1e18`.
    error HealthFactorTooLow();
    /// Target user is not eligible for liquidation (HF >= 1e18).
    error PositionHealthy();
    /// ERC-4626 mint produced zero shares (deposit too small relative to total assets).
    error ZeroShares();
    /// Numeric overflow during share/asset conversion.
    error Overflow();
}

/// Single error type returned by every public entrypoint.
#[derive(SolidityError)]
pub enum VaultError {
    NotOwner(NotOwner),
    NotAgent(NotAgent),
    Paused(Paused),
    NotPaused(NotPaused),
    Reentrancy(Reentrancy),
    AssetNotEnabled(AssetNotEnabled),
    AssetAlreadyListed(AssetAlreadyListed),
    InvalidParameter(InvalidParameter),
    ZeroAddress(ZeroAddress),
    ZeroAmount(ZeroAmount),
    InsufficientBalance(InsufficientBalance),
    InsufficientLiquidity(InsufficientLiquidity),
    TokenTransferFailed(TokenTransferFailed),
    StalePrice(StalePrice),
    OracleFailure(OracleFailure),
    HealthFactorTooLow(HealthFactorTooLow),
    PositionHealthy(PositionHealthy),
    ZeroShares(ZeroShares),
    Overflow(Overflow),
}

// Manual `Debug` (the `sol!`-generated variant structs don't derive it). Only
// the host tests need it (`.unwrap()` / `.expect()` / `.unwrap_err()`), so it is
// `#[cfg(test)]`-gated to keep the deployed wasm under the 24KB code-size limit.
#[cfg(test)]
impl core::fmt::Debug for VaultError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str(match self {
            VaultError::NotOwner(_) => "NotOwner",
            VaultError::NotAgent(_) => "NotAgent",
            VaultError::Paused(_) => "Paused",
            VaultError::NotPaused(_) => "NotPaused",
            VaultError::Reentrancy(_) => "Reentrancy",
            VaultError::AssetNotEnabled(_) => "AssetNotEnabled",
            VaultError::AssetAlreadyListed(_) => "AssetAlreadyListed",
            VaultError::InvalidParameter(_) => "InvalidParameter",
            VaultError::ZeroAddress(_) => "ZeroAddress",
            VaultError::ZeroAmount(_) => "ZeroAmount",
            VaultError::InsufficientBalance(_) => "InsufficientBalance",
            VaultError::InsufficientLiquidity(_) => "InsufficientLiquidity",
            VaultError::TokenTransferFailed(_) => "TokenTransferFailed",
            VaultError::StalePrice(_) => "StalePrice",
            VaultError::OracleFailure(_) => "OracleFailure",
            VaultError::HealthFactorTooLow(_) => "HealthFactorTooLow",
            VaultError::PositionHealthy(_) => "PositionHealthy",
            VaultError::ZeroShares(_) => "ZeroShares",
            VaultError::Overflow(_) => "Overflow",
        })
    }
}
