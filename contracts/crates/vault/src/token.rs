//! ERC-20 adapter used to pull collateral / USDC in and push USDC / collateral
//! out. We support the canonical *non-returning* and *boolean-returning*
//! variants by using `transferFrom` / `transfer` through a `sol_interface!`,
//! and treating a *revert* as failure (the boolean-returning case where the
//! callee returns `false` will also surface as an error through `?`).
//!
//! `MockUSDC` and `MockStock` (OZ ERC-20) both return `bool`, so this works
//! for the MVP. For prod USDC (which also returns bool) the same path applies.

extern crate alloc;
#[allow(unused_imports)]
use alloc::{vec, vec::Vec};

use alloy_primitives::{Address, U256};
use stylus_sdk::prelude::*;

use crate::errors::{TokenTransferFailed, VaultError};

sol_interface! {
    interface IErc20 {
        function transfer(address to, uint256 amount) external returns (bool);
        function transferFrom(address from, address to, uint256 amount) external returns (bool);
        function decimals() external view returns (uint8);
        function balanceOf(address account) external view returns (uint256);
    }
}

/// Pull `amount` tokens of `token` from `from` into the vault.
pub fn pull<S: TopLevelStorage + HostAccess>(
    storage: &mut S,
    token: Address,
    from: Address,
    amount: U256,
) -> Result<(), VaultError> {
    if amount.is_zero() {
        return Ok(());
    }
    let erc20 = IErc20::new(token);
    let to = storage.vm().contract_address();
    let cfg = Call::new_mutating(storage);
    let ok = erc20
        .transfer_from(storage.vm(), cfg, from, to, amount)
        .map_err(|_| VaultError::TokenTransferFailed(TokenTransferFailed {}))?;
    if !ok {
        return Err(VaultError::TokenTransferFailed(TokenTransferFailed {}));
    }
    Ok(())
}

/// Pull tokens and return the amount ACTUALLY received, measured by the vault's
/// own balance delta (Phase 6.2). A fee-on-transfer / non-standard RWA token then
/// credits only what truly arrived, never the requested amount — so vault
/// accounting can never be inflated by a token that takes a cut on transfer.
pub fn pull_measured<S: TopLevelStorage + HostAccess>(
    storage: &mut S,
    token: Address,
    from: Address,
    amount: U256,
) -> Result<U256, VaultError> {
    if amount.is_zero() {
        return Ok(U256::ZERO);
    }
    let erc20 = IErc20::new(token);
    let vault = storage.vm().contract_address();
    let before = erc20
        .balance_of(storage.vm(), Call::new(), vault)
        .map_err(|_| VaultError::TokenTransferFailed(TokenTransferFailed {}))?;
    let cfg = Call::new_mutating(storage);
    let ok = erc20
        .transfer_from(storage.vm(), cfg, from, vault, amount)
        .map_err(|_| VaultError::TokenTransferFailed(TokenTransferFailed {}))?;
    if !ok {
        return Err(VaultError::TokenTransferFailed(TokenTransferFailed {}));
    }
    let after = erc20
        .balance_of(storage.vm(), Call::new(), vault)
        .map_err(|_| VaultError::TokenTransferFailed(TokenTransferFailed {}))?;
    Ok(after.saturating_sub(before))
}

/// Push `amount` tokens of `token` from the vault to `to`.
pub fn push<S: TopLevelStorage + HostAccess>(
    storage: &mut S,
    token: Address,
    to: Address,
    amount: U256,
) -> Result<(), VaultError> {
    if amount.is_zero() {
        return Ok(());
    }
    let erc20 = IErc20::new(token);
    let cfg = Call::new_mutating(storage);
    let ok = erc20
        .transfer(storage.vm(), cfg, to, amount)
        .map_err(|_| VaultError::TokenTransferFailed(TokenTransferFailed {}))?;
    if !ok {
        return Err(VaultError::TokenTransferFailed(TokenTransferFailed {}));
    }
    Ok(())
}

/// Read the decimals view from an ERC-20 token. Errors if the call reverts.
pub fn decimals<S: TopLevelStorage + HostAccess>(storage: &mut S, token: Address) -> Result<u8, VaultError> {
    let erc20 = IErc20::new(token);
    erc20
        .decimals(storage.vm(), Call::new())
        .map_err(|_| VaultError::TokenTransferFailed(TokenTransferFailed {}))
}
