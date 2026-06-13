//! # tessera-lens
//!
//! A read-only data provider for the Tessera vault (rulbookImprvmnts.md §2.2).
//!
//! The funds-holding vault is right at Arbitrum's 24KB code-size ceiling, so the
//! derivable read surface — ERC-4626 quoting (`convert*` / `preview*`) and the
//! aggregate account views (`getHealthFactor` / `getSafetyScore` /
//! `getAccountData`) — lives here instead. This is the Aave "UiPoolDataProvider"
//! pattern: a separate, stateless contract the UI and agent call for derived
//! numbers, leaving the vault to hold only funds, risk-bearing logic, and the
//! raw getters those numbers are derived from.
//!
//! ## Why the numbers are guaranteed to match the vault
//!
//! The Lens does NOT re-derive any formula. It reads the vault's raw getters
//! (`totalAssets`, `totalSupply`, `debtOf`, `collateralOf`, `assetParams`, the
//! listed-asset enumeration, and the PriceGuard address via `oracle()`) and
//! feeds them into the SAME `interest-model` functions the vault uses
//! (`collateral_value_usd_8`, `health_factor`) and the SAME virtual-share
//! conversion math. Single source of truth, zero duplicated policy.
//!
//! Holds no funds and bears no risk. A wrong answer here can never move money;
//! the vault re-checks health authoritatively inside every mutating entrypoint.

#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]
#![allow(unexpected_cfgs)]
#![allow(clippy::wildcard_imports)]

extern crate alloc;
#[allow(unused_imports)]
use alloc::{vec, vec::Vec};

use alloy_primitives::{Address, U256};
use alloy_sol_types::sol;
use stylus_sdk::prelude::*;

use interest_model::{collateral_value_usd_8, health_factor, CollateralLeg};

/// Virtual offset mirroring the vault's OZ-style inflation-attack guard:
/// `virtual_supply = totalSupply + 1e6`, `virtual_total_assets = totalAssets + 1`.
const VIRTUAL_SHARES: u64 = 1_000_000;
/// WAD (1e18) — health-factor and safety-score scale, mirroring the vault.
const WAD: u128 = 1_000_000_000_000_000_000;

sol_storage! {
    #[entrypoint]
    pub struct TesseraLens {
        address owner;
        /// The TesseraVault this Lens reads from.
        address vault;
    }
}

sol! {
    error Unauthorized();
    error ZeroAddress();
    error VaultCall();
}

#[derive(SolidityError)]
pub enum LensError {
    Unauthorized(Unauthorized),
    ZeroAddress(ZeroAddress),
    VaultCall(VaultCall),
}

sol_interface! {
    /// Raw getters the Lens reads from the vault. All are `view`; the Lens never
    /// mutates the vault.
    interface IVault {
        function totalAssets() external view returns (uint256);
        function totalSupply() external view returns (uint256);
        function debtOf(address user) external view returns (uint256);
        function collateralOf(address user, address token) external view returns (uint256);
        function assetParams(address token) external view returns (bool, uint8, uint16, uint16, uint16);
        function listedAssetCount() external view returns (uint256);
        function listedAssetAt(uint256 index) external view returns (address);
        function oracle() external view returns (address);
    }

    /// PriceGuard validated price (8dp USD). Non-view by signature (matches the
    /// vault's own usage) but performs no state writes, so it is safe under
    /// `eth_call`.
    interface ILensPriceGuard {
        function getPrice(address token) external returns (uint256);
    }
}

#[public]
impl TesseraLens {
    /// One-time initializer (guarded by `owner.is_zero()`). The Lens holds no
    /// funds, so a guarded init is sufficient.
    pub fn initialize(&mut self, owner: Address, vault: Address) -> Result<(), LensError> {
        if !self.owner.get().is_zero() {
            return Err(LensError::Unauthorized(Unauthorized {}));
        }
        if owner.is_zero() || vault.is_zero() {
            return Err(LensError::ZeroAddress(ZeroAddress {}));
        }
        self.owner.set(owner);
        self.vault.set(vault);
        Ok(())
    }

    pub fn owner(&self) -> Address {
        self.owner.get()
    }

    pub fn vault(&self) -> Address {
        self.vault.get()
    }

    /// Repoint the Lens at a new vault (e.g. after a vault redeploy). Owner-gated;
    /// owner is the timelock at mainnet.
    #[selector(name = "setVault")]
    pub fn set_vault(&mut self, vault: Address) -> Result<(), LensError> {
        if self.vm().msg_sender() != self.owner.get() {
            return Err(LensError::Unauthorized(Unauthorized {}));
        }
        if vault.is_zero() {
            return Err(LensError::ZeroAddress(ZeroAddress {}));
        }
        self.vault.set(vault);
        Ok(())
    }

    // ---- ERC-4626 quoting (reads vault.totalAssets + totalSupply) ----

    #[selector(name = "convertToShares")]
    pub fn convert_to_shares(&mut self, assets: U256) -> Result<U256, LensError> {
        let (ts, vs) = self.virtual_supply_and_assets()?;
        Ok(mul_div_down(assets.saturating_mul(vs), ts))
    }

    #[selector(name = "convertToAssets")]
    pub fn convert_to_assets(&mut self, shares: U256) -> Result<U256, LensError> {
        let (ts, vs) = self.virtual_supply_and_assets()?;
        Ok(mul_div_down(shares.saturating_mul(ts), vs))
    }

    #[selector(name = "previewDeposit")]
    pub fn preview_deposit(&mut self, assets: U256) -> Result<U256, LensError> {
        self.convert_to_shares(assets)
    }

    #[selector(name = "previewMint")]
    pub fn preview_mint(&mut self, shares: U256) -> Result<U256, LensError> {
        let (ts, vs) = self.virtual_supply_and_assets()?;
        Ok(mul_div_up(shares.saturating_mul(ts), vs))
    }

    #[selector(name = "previewWithdraw")]
    pub fn preview_withdraw(&mut self, assets: U256) -> Result<U256, LensError> {
        let (ts, vs) = self.virtual_supply_and_assets()?;
        Ok(mul_div_up(assets.saturating_mul(vs), ts))
    }

    #[selector(name = "previewRedeem")]
    pub fn preview_redeem(&mut self, shares: U256) -> Result<U256, LensError> {
        self.convert_to_assets(shares)
    }

    // ---- account views (reads collateral + debt + PriceGuard) ----

    /// Health factor scaled by 1e18. Reproduces the vault's `hf` exactly.
    #[selector(name = "getHealthFactor")]
    pub fn get_health_factor(&mut self, user: Address) -> Result<U256, LensError> {
        let debt = self.vault_debt(user)?;
        if debt.is_zero() {
            return Ok(U256::MAX);
        }
        let coll = self.collateral_usd_8(user)?;
        let debt_usd_8 = debt.saturating_mul(U256::from(100u64));
        Ok(health_factor(coll, debt_usd_8))
    }

    /// Portfolio Safety Score 0..=100 (TDD §5.3). Reproduces the vault's mapping.
    #[selector(name = "getSafetyScore")]
    pub fn get_safety_score(&mut self, user: Address) -> Result<u8, LensError> {
        let hf = self.get_health_factor(user)?;
        let two_wad = U256::from(WAD).saturating_mul(U256::from(2u64));
        let cap = if hf > two_wad { two_wad } else { hf };
        let numerator = cap.saturating_mul(U256::from(100u64));
        let score = numerator.checked_div(two_wad).unwrap_or(U256::ZERO);
        let s = score.to::<u64>();
        Ok(u8::try_from(s.min(100)).unwrap_or(100))
    }

    /// `(collateral_value_usd_8_liq_weighted, debt_usdc, health_factor_1e18)` —
    /// the aggregate the dashboard reads. Identical tuple to the vault's old
    /// `getAccountData`.
    #[selector(name = "getAccountData")]
    pub fn get_account_data(&mut self, user: Address) -> Result<(U256, U256, U256), LensError> {
        let debt = self.vault_debt(user)?;
        let coll = self.collateral_usd_8(user)?;
        let hf = if debt.is_zero() {
            U256::MAX
        } else {
            health_factor(coll, debt.saturating_mul(U256::from(100u64)))
        };
        Ok((coll, debt, hf))
    }
}

impl TesseraLens {
    fn vault_iface(&self) -> IVault {
        IVault::new(self.vault.get())
    }

    /// `(virtual_total_assets, virtual_supply)` from the vault's live numbers.
    fn virtual_supply_and_assets(&mut self) -> Result<(U256, U256), LensError> {
        let v = self.vault_iface();
        let total_assets = v
            .total_assets(self.vm(), Call::new())
            .map_err(|_| LensError::VaultCall(VaultCall {}))?;
        let total_supply = v
            .total_supply(self.vm(), Call::new())
            .map_err(|_| LensError::VaultCall(VaultCall {}))?;
        let virtual_total_assets = total_assets.saturating_add(U256::from(1u64));
        let virtual_supply = total_supply.saturating_add(U256::from(VIRTUAL_SHARES));
        Ok((virtual_total_assets, virtual_supply))
    }

    fn vault_debt(&mut self, user: Address) -> Result<U256, LensError> {
        self.vault_iface()
            .debt_of(self.vm(), Call::new(), user)
            .map_err(|_| LensError::VaultCall(VaultCall {}))
    }

    /// Liquidation-threshold-weighted collateral value (8dp USD), reproducing the
    /// vault's `collateral_legs` exactly: skip empty / disabled assets, weight by
    /// each asset's `liq_threshold_bps`, price through the same PriceGuard.
    fn collateral_usd_8(&mut self, user: Address) -> Result<U256, LensError> {
        let v = self.vault_iface();
        let n = v
            .listed_asset_count(self.vm(), Call::new())
            .map_err(|_| LensError::VaultCall(VaultCall {}))?
            .to::<u64>();
        let guard = v
            .oracle(self.vm(), Call::new())
            .map_err(|_| LensError::VaultCall(VaultCall {}))?;
        let pg = ILensPriceGuard::new(guard);

        let mut legs: Vec<CollateralLeg> = Vec::new();
        for i in 0..n {
            let token = v
                .listed_asset_at(self.vm(), Call::new(), U256::from(i))
                .map_err(|_| LensError::VaultCall(VaultCall {}))?;
            if token.is_zero() {
                continue;
            }
            let amount = v
                .collateral_of(self.vm(), Call::new(), user, token)
                .map_err(|_| LensError::VaultCall(VaultCall {}))?;
            if amount.is_zero() {
                continue;
            }
            let (enabled, decimals, _max_ltv, liq_threshold, _bonus) = v
                .asset_params(self.vm(), Call::new(), token)
                .map_err(|_| LensError::VaultCall(VaultCall {}))?;
            if !enabled {
                continue;
            }
            // getPrice is non-view by signature but writes no state; safe under
            // eth_call. Build the mutating call context BEFORE taking `self.vm()`
            // so the mutable borrow is released first (mirrors the vault).
            let cfg = Call::new_mutating(self);
            let price = pg
                .get_price(self.vm(), cfg, token)
                .map_err(|_| LensError::VaultCall(VaultCall {}))?;
            legs.push(CollateralLeg {
                amount,
                decimals: u32::from(decimals),
                price_usd_8: price,
                liq_threshold_bps: u32::from(liq_threshold),
            });
        }
        Ok(collateral_value_usd_8(&legs))
    }
}

/// `num / den`, rounding down. Mirrors the vault's `mul_div_down`.
fn mul_div_down(num: U256, den: U256) -> U256 {
    if den.is_zero() {
        return U256::ZERO;
    }
    num / den
}

/// `num / den`, rounding up. Mirrors the vault's `mul_div_up`.
fn mul_div_up(num: U256, den: U256) -> U256 {
    if den.is_zero() {
        return U256::ZERO;
    }
    (num + den - U256::from(1u64)) / den
}

#[cfg(test)]
mod tests {
    use super::{mul_div_down, mul_div_up};
    use alloy_primitives::U256;

    #[test]
    fn mul_div_down_floors() {
        assert_eq!(mul_div_down(U256::from(7u64), U256::from(2u64)), U256::from(3u64));
        assert_eq!(mul_div_down(U256::from(6u64), U256::from(2u64)), U256::from(3u64));
    }

    #[test]
    fn mul_div_up_ceils() {
        assert_eq!(mul_div_up(U256::from(7u64), U256::from(2u64)), U256::from(4u64));
        assert_eq!(mul_div_up(U256::from(6u64), U256::from(2u64)), U256::from(3u64));
    }

    #[test]
    fn div_by_zero_is_zero_not_panic() {
        assert_eq!(mul_div_down(U256::from(7u64), U256::ZERO), U256::ZERO);
        assert_eq!(mul_div_up(U256::from(7u64), U256::ZERO), U256::ZERO);
    }
}
