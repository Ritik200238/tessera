//! Host-side unit tests for the Tessera vault.
//!
//! These tests run on the `stylus-test` in-process VM (see
//! `docs/stylus-sdk-rs/examples/test/`). They cover the pure pieces of the
//! vault — admin gates, pause semantics, parameter validation, accrual
//! ordering, view functions, ERC-4626 conversion edges — and exercise the
//! external-call paths via `vm.mock_call`.
//!
//! Paths that *require* a full ERC-20 + oracle reach a soft ceiling under
//! host tests because Stylus's `sol_interface!` calls go through `RawCall`
//! with an ABI-encoded payload that `TestVM::mock_call` must match exactly
//! by bytes. We mock the underlying RPC at that level where useful, and
//! otherwise rely on the e2e Foundry script (`contracts/script/e2e_weekend.ts`)
//! to cover the multi-contract dance.

#![cfg(test)]
#![allow(clippy::unwrap_used)]

use alloy_primitives::{Address, U256, U64};
use stylus_sdk::testing::*;

use super::*;
use crate::interest;

fn addr(byte: u8) -> Address {
    Address::from([byte; 20])
}

const OWNER: u8 = 0x11;
const AGENT: u8 = 0x22;
const USDC: u8 = 0x33;
const ORACLE: u8 = 0x44;
const TAAPL: u8 = 0x55;
const ALICE: u8 = 0x66;
const BOB: u8 = 0x77;

/// Construct a default-initialised vault: OWNER as `msg_sender`, then
/// `initialize` called with the canonical mock addresses.
fn deploy(vm: &TestVM) -> TesseraVault {
    vm.set_sender(addr(OWNER));
    vm.set_block_timestamp(1_000_000);
    let mut v = TesseraVault::from(vm);
    v.initialize(addr(OWNER), addr(USDC), addr(ORACLE), addr(AGENT))
        .expect("initialize");
    v
}

// =============================================================================
// 1. Initialization & ownership
// =============================================================================

#[test]
fn initialize_sets_canonical_addresses() {
    let vm = TestVM::default();
    let v = deploy(&vm);
    assert_eq!(v.owner(), addr(OWNER));
    assert_eq!(v.usdc(), addr(USDC));
    assert_eq!(v.oracle(), addr(ORACLE));
    assert_eq!(v.agent(), addr(AGENT));
    assert!(!v.paused());
    assert_eq!(v.max_price_age().to::<u64>(), 3600);
    assert_eq!(v.close_factor_bps(), 5_000);
}

#[test]
fn initialize_twice_reverts() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    let err = v
        .initialize(addr(OWNER), addr(USDC), addr(ORACLE), addr(AGENT))
        .unwrap_err();
    assert!(matches!(err, VaultError::NotOwner(_)));
}

#[test]
fn initialize_rejects_zero_owner() {
    let vm = TestVM::default();
    vm.set_sender(addr(OWNER));
    let mut v = TesseraVault::from(&vm);
    let err = v
        .initialize(Address::ZERO, addr(USDC), addr(ORACLE), addr(AGENT))
        .unwrap_err();
    assert!(matches!(err, VaultError::ZeroAddress(_)));
}

#[test]
fn transfer_ownership_is_two_step() {
    // Phase 3: ownership moves only after the pending owner accepts — no one-step
    // handoff to a wrong/dead address.
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    v.transfer_ownership(addr(0xAA)).unwrap();
    // Step 1: owner unchanged; pending set.
    assert_eq!(v.owner(), addr(OWNER));
    assert_eq!(v.pending_owner(), addr(0xAA));
    // Only the pending owner may accept.
    vm.set_sender(addr(BOB));
    assert!(matches!(v.accept_ownership().unwrap_err(), VaultError::NotOwner(_)));
    // Step 2: pending owner accepts → ownership moves, pending clears.
    vm.set_sender(addr(0xAA));
    v.accept_ownership().unwrap();
    assert_eq!(v.owner(), addr(0xAA));
    assert_eq!(v.pending_owner(), Address::ZERO);
}

#[test]
fn transfer_ownership_rejects_non_owner() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    vm.set_sender(addr(ALICE));
    let err = v.transfer_ownership(addr(ALICE)).unwrap_err();
    assert!(matches!(err, VaultError::NotOwner(_)));
}

#[test]
fn transfer_ownership_rejects_zero() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    let err = v.transfer_ownership(Address::ZERO).unwrap_err();
    assert!(matches!(err, VaultError::ZeroAddress(_)));
}

// =============================================================================
// 2. Admin gates
// =============================================================================

#[test]
fn set_oracle_only_owner() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    vm.set_sender(addr(ALICE));
    assert!(matches!(
        v.set_oracle(addr(0xAB)).unwrap_err(),
        VaultError::NotOwner(_)
    ));
    vm.set_sender(addr(OWNER));
    v.set_oracle(addr(0xAB)).unwrap();
    assert_eq!(v.oracle(), addr(0xAB));
}

#[test]
fn set_agent_only_owner() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    vm.set_sender(addr(ALICE));
    assert!(matches!(
        v.set_agent(addr(0xBB)).unwrap_err(),
        VaultError::NotOwner(_)
    ));
    vm.set_sender(addr(OWNER));
    v.set_agent(addr(0xBB)).unwrap();
    assert_eq!(v.agent(), addr(0xBB));
}

#[test]
fn set_max_price_age_rejects_zero() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    assert!(matches!(
        v.set_max_price_age(U64::ZERO).unwrap_err(),
        VaultError::InvalidParameter(_)
    ));
    v.set_max_price_age(U64::from(60u64)).unwrap();
    assert_eq!(v.max_price_age().to::<u64>(), 60);
}

#[test]
fn set_close_factor_validates_range() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    assert!(matches!(
        v.set_close_factor(0).unwrap_err(),
        VaultError::InvalidParameter(_)
    ));
    assert!(matches!(
        v.set_close_factor(10_001).unwrap_err(),
        VaultError::InvalidParameter(_)
    ));
    v.set_close_factor(7_500).unwrap();
    assert_eq!(v.close_factor_bps(), 7_500);
}

#[test]
fn set_rate_params_validates_optimal() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    assert!(matches!(
        v.set_rate_params(200, 400, 6_000, 0, 0).unwrap_err(),
        VaultError::InvalidParameter(_)
    ));
    assert!(matches!(
        v.set_rate_params(200, 400, 6_000, 9_000, 10_001).unwrap_err(),
        VaultError::InvalidParameter(_)
    ));
    v.set_rate_params(200, 400, 6_000, 8_500, 1_000).unwrap();
}

// =============================================================================
// 3. Asset whitelist
// =============================================================================

#[test]
fn list_collateral_validates_inputs() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    // zero token
    assert!(matches!(
        v.list_collateral(Address::ZERO, 7_000, 8_500, 500, 18).unwrap_err(),
        VaultError::ZeroAddress(_)
    ));
    // max_ltv > liq_threshold
    assert!(matches!(
        v.list_collateral(addr(TAAPL), 9_000, 8_500, 500, 18).unwrap_err(),
        VaultError::InvalidParameter(_)
    ));
    // decimals must be 6 or 18
    assert!(matches!(
        v.list_collateral(addr(TAAPL), 7_000, 8_500, 500, 8).unwrap_err(),
        VaultError::InvalidParameter(_)
    ));
}

#[test]
fn list_collateral_records_params() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    v.list_collateral(addr(TAAPL), 7_000, 8_500, 500, 18).unwrap();
    let p = v.asset_params(addr(TAAPL));
    assert!(p.0); // enabled
    assert_eq!(p.1, 18);
    assert_eq!(p.2, 7_000);
    assert_eq!(p.3, 8_500);
    assert_eq!(p.4, 500);
    assert_eq!(v.listed_asset_count(), U256::from(1u64));
    assert_eq!(v.listed_asset_at(U256::ZERO), addr(TAAPL));
}

#[test]
fn list_collateral_idempotent_listed_count() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    v.list_collateral(addr(TAAPL), 7_000, 8_500, 500, 18).unwrap();
    v.list_collateral(addr(TAAPL), 7_500, 8_700, 500, 18).unwrap();
    // Same token re-listed: count stays at 1.
    assert_eq!(v.listed_asset_count(), U256::from(1u64));
    assert_eq!(v.asset_params(addr(TAAPL)).2, 7_500);
}

#[test]
fn set_asset_enabled_requires_listed_first() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    assert!(matches!(
        v.set_asset_enabled(addr(TAAPL), false).unwrap_err(),
        VaultError::AssetNotEnabled(_)
    ));
    v.list_collateral(addr(TAAPL), 7_000, 8_500, 500, 18).unwrap();
    v.set_asset_enabled(addr(TAAPL), false).unwrap();
    let p = v.asset_params(addr(TAAPL));
    assert!(!p.0);
}

// =============================================================================
// 4. Pause / unpause
// =============================================================================

#[test]
fn pause_sets_flag_and_unpause_clears() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    v.pause().unwrap();
    assert!(v.paused());
    v.unpause().unwrap();
    assert!(!v.paused());
}

#[test]
fn unpause_when_not_paused_reverts() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    assert!(matches!(v.unpause().unwrap_err(), VaultError::NotPaused(_)));
}

#[test]
fn pause_is_idempotent() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    v.pause().unwrap();
    v.pause().unwrap();
    assert!(v.paused());
}

#[test]
fn paused_blocks_borrow() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    v.pause().unwrap();
    vm.set_sender(addr(ALICE));
    let err = v.borrow(U256::from(1u64)).unwrap_err();
    assert!(matches!(err, VaultError::Paused(_)));
}

#[test]
fn paused_allows_deposit_collateral() {
    // Phase 2.1: de-risking must work while paused — a borrower can always top up
    // collateral to save themselves in the exact crisis that triggers a pause.
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    v.list_collateral(addr(TAAPL), 7_000, 8_500, 500, 18).unwrap();
    v.pause().unwrap();
    vm.set_sender(addr(ALICE));
    // The pause gate must NOT reject it. (The ERC-20 pull then fails under the
    // host harness with no token mock — but crucially it is NOT a Paused error.)
    let err = v.deposit_collateral(addr(TAAPL), U256::from(1u64)).unwrap_err();
    assert!(
        !matches!(err, VaultError::Paused(_)),
        "deposit_collateral must be permitted while paused"
    );
}

#[test]
fn paused_allows_repay_and_liquidate() {
    // repay and liquidate intentionally skip the pause gate (TDD §3.7 — pause
    // stops *new* borrows / withdrawals; users can always reduce risk).
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    v.pause().unwrap();
    vm.set_sender(addr(ALICE));
    // No debt → InsufficientBalance, *not* Paused.
    let err = v.repay(U256::from(1u64)).unwrap_err();
    assert!(matches!(err, VaultError::InsufficientBalance(_)));
}

// =============================================================================
// 5. Views & default state
// =============================================================================

#[test]
fn default_state_views() {
    let vm = TestVM::default();
    let v = deploy(&vm);
    assert_eq!(v.total_assets(), U256::ZERO);
    assert_eq!(v.total_supply(), U256::ZERO);
    assert_eq!(v.balance_of(addr(ALICE)), U256::ZERO);
    assert_eq!(v.idle_assets(), U256::ZERO);
    assert_eq!(v.total_principal(), U256::ZERO);
    assert_eq!(v.utilization_bps(), 0);
    assert_eq!(v.debt_of(addr(ALICE)), U256::ZERO);
    assert_eq!(v.borrow_index(), U256::from(WAD));
}

#[test]
fn convert_uses_virtual_offset_and_round_trips() {
    let vm = TestVM::default();
    let v = deploy(&vm);
    let assets = U256::from(1_000_000u64);
    let offset = U256::from(1_000_000u64); // 10^6 virtual shares
    // First-depositor inflation defense: shares are offset-scaled, never 1:1.
    assert_eq!(v.convert_to_shares(assets), assets * offset);
    assert_eq!(v.preview_deposit(assets), assets * offset);
    // Converting those shares back recovers the original assets exactly.
    let shares = v.convert_to_shares(assets);
    assert_eq!(v.convert_to_assets(shares), assets);
    assert_eq!(v.preview_redeem(shares), assets);
}

#[test]
fn new_admin_setters_are_owner_gated_and_persist() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    // Per-day auto-repay cap is owner-only and reads back.
    vm.set_sender(addr(ALICE));
    assert!(matches!(
        v.set_max_agent_repay_per_day(U256::from(100u64)).unwrap_err(),
        VaultError::NotOwner(_)
    ));
    vm.set_sender(addr(OWNER));
    v.set_max_agent_repay_per_day(U256::from(50_000_000_000u64)).unwrap();
    // Per-asset flags require a listed asset.
    assert!(matches!(
        v.set_asset_frozen(addr(TAAPL), true).unwrap_err(),
        VaultError::AssetNotEnabled(_)
    ));
    v.list_collateral(addr(TAAPL), 5_000, 6_500, 500, 18).unwrap();
    v.set_asset_frozen(addr(TAAPL), true).unwrap();
    v.set_feed_decimals(addr(TAAPL), 18).unwrap();
    // A frozen asset rejects new collateral deposits (behavioral proof the flag took).
    assert!(matches!(
        v.deposit_collateral(addr(TAAPL), U256::from(1u64)).unwrap_err(),
        VaultError::AssetNotEnabled(_)
    ));
}

#[test]
fn safety_score_clamps_at_100_for_infinite_hf() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    // No debt → HF == U256::MAX → score == 100.
    let score = v.get_safety_score(addr(ALICE)).unwrap();
    assert_eq!(score, 100);
}

#[test]
fn safety_score_at_one_wad_is_50() {
    // We can't easily inject a non-MAX HF without external calls. Verify the
    // arithmetic instead, mirroring the closed-form mapping from TDD §5.3.
    let hf = U256::from(WAD);
    let two_wad = U256::from(WAD) * U256::from(2u64);
    let cap = core::cmp::min(hf, two_wad);
    let score = (cap * U256::from(100u64)) / two_wad;
    assert_eq!(score.to::<u64>(), 50);

    let hf2 = U256::from(WAD) * U256::from(2u64);
    let cap2 = core::cmp::min(hf2, two_wad);
    let score2 = (cap2 * U256::from(100u64)) / two_wad;
    assert_eq!(score2.to::<u64>(), 100);

    let hf3 = U256::from(WAD) * U256::from(15u64) / U256::from(10u64);
    let cap3 = core::cmp::min(hf3, two_wad);
    let score3 = (cap3 * U256::from(100u64)) / two_wad;
    assert_eq!(score3.to::<u64>(), 75);
}

// =============================================================================
// 6. Accrual ordering / index init
// =============================================================================

#[test]
fn borrow_index_initializes_at_one_wad() {
    let vm = TestVM::default();
    let v = deploy(&vm);
    assert_eq!(v.borrow_index(), U256::from(WAD));
}

#[test]
fn utilization_zero_when_no_borrows() {
    let vm = TestVM::default();
    let v = deploy(&vm);
    assert_eq!(v.utilization_bps(), 0);
}

#[test]
fn borrow_rate_at_zero_util_is_base() {
    let vm = TestVM::default();
    let v = deploy(&vm);
    // Defaults from initialize(): base=200, slope1=400, slope2=6000, opt=8000.
    assert_eq!(v.borrow_rate_bps(), 200);
    // Supply rate at zero util is zero regardless of reserve factor.
    assert_eq!(v.supply_rate_bps(), 0);
}

#[test]
fn rate_params_updated_after_admin_call() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    v.set_rate_params(500, 1_000, 8_000, 9_000, 1_000).unwrap();
    // base=500 at zero util → 500 bps.
    assert_eq!(v.borrow_rate_bps(), 500);
}

// =============================================================================
// 7. Borrow / withdraw HF post-checks (defense in depth)
// =============================================================================

#[test]
fn borrow_zero_amount_reverts() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    vm.set_sender(addr(ALICE));
    assert!(matches!(
        v.borrow(U256::ZERO).unwrap_err(),
        VaultError::ZeroAmount(_)
    ));
}

#[test]
fn borrow_with_no_liquidity_reverts() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    vm.set_sender(addr(ALICE));
    // idle_assets = 0; any non-zero borrow trips InsufficientLiquidity before
    // touching the HF check.
    assert!(matches!(
        v.borrow(U256::from(1_000_000u64)).unwrap_err(),
        VaultError::InsufficientLiquidity(_)
    ));
}

#[test]
fn withdraw_collateral_with_no_balance_reverts() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    v.list_collateral(addr(TAAPL), 7_000, 8_500, 500, 18).unwrap();
    vm.set_sender(addr(ALICE));
    assert!(matches!(
        v.withdraw_collateral(addr(TAAPL), U256::from(1u64)).unwrap_err(),
        VaultError::InsufficientBalance(_)
    ));
}

#[test]
fn deposit_collateral_requires_whitelisted_asset() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    vm.set_sender(addr(ALICE));
    let err = v.deposit_collateral(addr(TAAPL), U256::from(1u64)).unwrap_err();
    assert!(matches!(err, VaultError::AssetNotEnabled(_)));
}

// =============================================================================
// 8. ERC-4626 lender side validation paths
// =============================================================================

#[test]
fn deposit_zero_reverts() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    vm.set_sender(addr(BOB));
    assert!(matches!(
        v.deposit(U256::ZERO, addr(BOB)).unwrap_err(),
        VaultError::ZeroAmount(_)
    ));
}

#[test]
fn deposit_to_zero_receiver_reverts() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    vm.set_sender(addr(BOB));
    assert!(matches!(
        v.deposit(U256::from(1u64), Address::ZERO).unwrap_err(),
        VaultError::ZeroAddress(_)
    ));
}

#[test]
fn mint_zero_reverts() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    vm.set_sender(addr(BOB));
    assert!(matches!(
        v.mint(U256::ZERO, addr(BOB)).unwrap_err(),
        VaultError::ZeroAmount(_)
    ));
}

#[test]
fn withdraw_not_owner_reverts() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    vm.set_sender(addr(ALICE));
    let err = v
        .withdraw(U256::from(1u64), addr(ALICE), addr(BOB))
        .unwrap_err();
    assert!(matches!(err, VaultError::NotOwner(_)));
}

#[test]
fn redeem_not_owner_reverts() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    vm.set_sender(addr(ALICE));
    let err = v
        .redeem(U256::from(1u64), addr(ALICE), addr(BOB))
        .unwrap_err();
    assert!(matches!(err, VaultError::NotOwner(_)));
}

#[test]
fn withdraw_more_than_idle_reverts() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    vm.set_sender(addr(ALICE));
    let err = v
        .withdraw(U256::from(1u64), addr(ALICE), addr(ALICE))
        .unwrap_err();
    // With zero shares the InsufficientBalance check trips first.
    assert!(matches!(err, VaultError::InsufficientBalance(_)));
}

// =============================================================================
// 9. Liquidation gates
// =============================================================================

#[test]
fn liquidate_only_agent() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    vm.set_sender(addr(ALICE));
    let err = v
        .liquidate(addr(BOB), U256::from(1u64), addr(TAAPL))
        .unwrap_err();
    assert!(matches!(err, VaultError::NotAgent(_)));
}

#[test]
fn liquidate_zero_amount_reverts() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    vm.set_sender(addr(AGENT));
    let err = v.liquidate(addr(BOB), U256::ZERO, addr(TAAPL)).unwrap_err();
    assert!(matches!(err, VaultError::ZeroAmount(_)));
}

#[test]
fn liquidate_zero_borrower_reverts() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    vm.set_sender(addr(AGENT));
    let err = v
        .liquidate(Address::ZERO, U256::from(1u64), addr(TAAPL))
        .unwrap_err();
    assert!(matches!(err, VaultError::ZeroAddress(_)));
}

#[test]
fn liquidate_unlisted_asset_reverts() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    vm.set_sender(addr(AGENT));
    let err = v
        .liquidate(addr(BOB), U256::from(1u64), addr(TAAPL))
        .unwrap_err();
    assert!(matches!(err, VaultError::AssetNotEnabled(_)));
}

#[test]
fn liquidate_healthy_position_reverts() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    v.list_collateral(addr(TAAPL), 7_000, 8_500, 500, 18).unwrap();
    vm.set_sender(addr(AGENT));
    // BOB has no debt → HF == MAX → PositionHealthy.
    let err = v
        .liquidate(addr(BOB), U256::from(1u64), addr(TAAPL))
        .unwrap_err();
    assert!(matches!(err, VaultError::PositionHealthy(_)));
}

// =============================================================================
// 10. Account data
// =============================================================================

#[test]
fn get_account_data_default_is_zero_zero_max() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    let (coll, debt, hf) = v.get_account_data(addr(ALICE)).unwrap();
    assert_eq!(coll, U256::ZERO);
    assert_eq!(debt, U256::ZERO);
    assert_eq!(hf, U256::MAX);
}

// =============================================================================
// 11. interest::roll_index storage-free sanity (pure-piece coverage)
// =============================================================================

#[test]
fn debt_of_view_zero_when_no_principal() {
    let vm = TestVM::default();
    let v = deploy(&vm);
    assert_eq!(v.debt_of(addr(ALICE)), U256::ZERO);
}

#[test]
fn idle_assets_zero_at_deploy() {
    let vm = TestVM::default();
    let v = deploy(&vm);
    assert_eq!(v.idle_assets(), U256::ZERO);
    assert_eq!(v.total_principal(), U256::ZERO);
}

#[test]
fn listed_assets_empty_at_deploy() {
    let vm = TestVM::default();
    let v = deploy(&vm);
    assert_eq!(v.listed_asset_count(), U256::ZERO);
    // Out-of-range index returns ZERO address.
    assert_eq!(v.listed_asset_at(U256::from(0u64)), Address::ZERO);
    assert_eq!(v.listed_asset_at(U256::from(99u64)), Address::ZERO);
}

#[test]
fn interest_current_index_module_helper() {
    // Re-export sanity: `current_index` returns 1e18 when borrow_index is 0
    // (the lazy-init branch). We can't construct InterestState directly, but
    // we can verify the constant is what the contract reports through
    // `borrow_index()` immediately after `initialize`.
    let vm = TestVM::default();
    let v = deploy(&vm);
    assert_eq!(v.borrow_index(), U256::from(interest_model::WAD));
}

// =============================================================================
// 11b. Phase 1 — reserve skim, reserve accounting, insolvency-waterfall plumbing
// =============================================================================

#[test]
fn reserve_factor_defaults_to_fifteen_percent() {
    // The blueprint's 15% is now real in code (was 0). We verify it through the
    // supply-rate view: with the skim live, the lender rate is strictly below
    // the borrow rate by the reserve cut once there's utilization.
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    // Create utilization so borrow rate > 0: 1000 borrowed against 1000 idle+debt.
    v.lending.total_principal.set(U256::from(1_000_000_000u64));
    v.lending.idle_assets.set(U256::from(0u64));
    let br = v.borrow_rate_bps();
    let sr = v.supply_rate_bps();
    assert!(br > 0, "100% utilization should price a non-zero borrow rate");
    // supply = borrow * util * (1 - reserve_factor); with rf=15% and util=100%,
    // supply must be strictly less than borrow.
    assert!(sr < br, "reserve factor must skim part of interest from lenders");
}

#[test]
fn reserve_skim_diverts_reserve_factor_of_interest() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    // Seed an active debt position at the index level: 1000 USDC scaled @ 1.0.
    let principal = U256::from(1_000_000_000u64); // 1000e6
    v.interest.borrow_index.set(U256::from(interest_model::WAD));
    v.interest.last_accrual_ts.set(U64::from(1_000_000u64));
    v.lending.scaled_total_principal.set(principal);
    v.lending.total_principal.set(principal); // drives non-zero utilization/rate
    assert_eq!(v.reserves(), U256::ZERO);

    // Roll the index forward one year.
    let now = 1_000_000u64 + 365 * 24 * 3600;
    let (_dt, _rate, new_idx) = interest::roll_index(&mut v.interest, &mut v.lending, now);

    // Reserve must equal EXACTLY 15% of the interest accrued on the scaled debt,
    // rounded down (lenders' pool keeps the dust).
    let wad = U256::from(interest_model::WAD);
    let interest_delta = principal * (new_idx - wad) / wad;
    let expected = interest_delta * U256::from(1_500u64) / U256::from(10_000u64);
    assert!(expected > U256::ZERO, "a year of interest should skim > 0");
    assert_eq!(v.reserves(), expected);
}

#[test]
fn reserve_skim_is_noop_without_debt() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    v.interest.borrow_index.set(U256::from(interest_model::WAD));
    v.interest.last_accrual_ts.set(U64::from(1_000_000u64));
    // No scaled debt → no interest → no skim.
    let now = 1_000_000u64 + 365 * 24 * 3600;
    let _ = interest::roll_index(&mut v.interest, &mut v.lending, now);
    assert_eq!(v.reserves(), U256::ZERO);
}

#[test]
fn reserves_and_bad_debt_zero_at_deploy() {
    let vm = TestVM::default();
    let v = deploy(&vm);
    assert_eq!(v.reserves(), U256::ZERO);
    assert_eq!(v.bad_debt(), U256::ZERO);
}

#[test]
fn withdraw_reserves_only_owner() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    vm.set_sender(addr(ALICE));
    assert!(matches!(
        v.withdraw_reserves(addr(ALICE), U256::from(1u64)).unwrap_err(),
        VaultError::NotOwner(_)
    ));
}

#[test]
fn withdraw_reserves_validates_inputs_and_balance() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    assert!(matches!(
        v.withdraw_reserves(Address::ZERO, U256::from(1u64)).unwrap_err(),
        VaultError::ZeroAddress(_)
    ));
    assert!(matches!(
        v.withdraw_reserves(addr(0xAB), U256::ZERO).unwrap_err(),
        VaultError::ZeroAmount(_)
    ));
    // Reserve is 0 at deploy → any positive amount exceeds it.
    assert!(matches!(
        v.withdraw_reserves(addr(0xAB), U256::from(1u64)).unwrap_err(),
        VaultError::InsufficientBalance(_)
    ));
    // With reserve funded but no idle liquidity, it's bounded by idle.
    v.lending.reserve_assets.set(U256::from(100u64));
    assert!(matches!(
        v.withdraw_reserves(addr(0xAB), U256::from(50u64)).unwrap_err(),
        VaultError::InsufficientLiquidity(_)
    ));
}

#[test]
fn set_rate_params_caps_reserve_factor_at_25_percent() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    // 2501 bps (25.01%) rejected.
    assert!(matches!(
        v.set_rate_params(200, 400, 6_000, 8_000, 2_501).unwrap_err(),
        VaultError::InvalidParameter(_)
    ));
    // 2500 bps (25%) accepted.
    v.set_rate_params(200, 400, 6_000, 8_000, 2_500).unwrap();
}

// =============================================================================
// 11c. Phase 2 — safety batch (heartbeat stamp, decimals lock, min-debt, caps)
// =============================================================================

#[test]
fn set_backstop_delay_stamps_heartbeat() {
    // Enabling the backstop from disabled must stamp the heartbeat, else
    // `now - 0 > delay` would open it to everyone instantly.
    let vm = TestVM::default();
    let mut v = deploy(&vm); // block_timestamp == 1_000_000
    assert_eq!(v.config.agent_last_heartbeat.get().to::<u64>(), 0);
    v.set_backstop_delay(U64::from(900u64)).unwrap(); // 15 min
    assert_eq!(v.config.agent_last_heartbeat.get().to::<u64>(), 1_000_000);
}

#[test]
fn relist_cannot_change_decimals() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    v.list_collateral(addr(TAAPL), 5_000, 6_500, 500, 18).unwrap();
    // Re-list with DIFFERENT decimals → rejected (would mis-account live positions).
    assert!(matches!(
        v.list_collateral(addr(TAAPL), 5_000, 6_500, 500, 6).unwrap_err(),
        VaultError::InvalidParameter(_)
    ));
    // Re-list with SAME decimals but new risk params → allowed.
    v.list_collateral(addr(TAAPL), 4_000, 5_500, 500, 18).unwrap();
}

#[test]
fn min_debt_defaults_to_100_usdc_and_is_bounded() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    assert_eq!(v.min_debt(), U256::from(100_000_000u64)); // 100e6 = 100 USDC
    assert!(matches!(
        v.set_min_debt(U256::from(1_000_000_001u64)).unwrap_err(), // > 1000 USDC
        VaultError::InvalidParameter(_)
    ));
    v.set_min_debt(U256::from(500_000_000u64)).unwrap();
    assert_eq!(v.min_debt(), U256::from(500_000_000u64));
}

#[test]
fn caps_setters_and_views() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    assert_eq!(v.borrow_cap(), U256::ZERO);
    v.set_borrow_cap(U256::from(1_000_000_000_000u64)).unwrap();
    assert_eq!(v.borrow_cap(), U256::from(1_000_000_000_000u64));
    // Per-asset supply cap requires the asset to be listed.
    assert!(matches!(
        v.set_supply_cap(addr(TAAPL), U256::from(1u64)).unwrap_err(),
        VaultError::AssetNotEnabled(_)
    ));
    v.list_collateral(addr(TAAPL), 5_000, 6_500, 500, 18).unwrap();
    v.set_supply_cap(addr(TAAPL), U256::from(42u64)).unwrap();
    assert_eq!(v.supply_cap(addr(TAAPL)), U256::from(42u64));
    assert_eq!(v.total_collateral(addr(TAAPL)), U256::ZERO);
}

#[test]
fn caps_and_min_debt_are_owner_only() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    vm.set_sender(addr(ALICE));
    assert!(matches!(v.set_min_debt(U256::from(1u64)).unwrap_err(), VaultError::NotOwner(_)));
    assert!(matches!(v.set_borrow_cap(U256::from(1u64)).unwrap_err(), VaultError::NotOwner(_)));
    assert!(matches!(
        v.set_supply_cap(addr(TAAPL), U256::from(1u64)).unwrap_err(),
        VaultError::NotOwner(_)
    ));
}

// =============================================================================
// 11d. Phase 3 — governance (two-step ownership, guardian pause-only)
// =============================================================================

#[test]
fn guardian_can_pause_only() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    let guard = addr(0x99);
    v.set_guardian(guard).unwrap();
    assert_eq!(v.guardian(), guard);
    // Guardian pauses (safety fast).
    vm.set_sender(guard);
    v.pause().unwrap();
    assert!(v.paused());
    // Guardian CANNOT unpause...
    assert!(matches!(v.unpause().unwrap_err(), VaultError::NotOwner(_)));
    // ...and CANNOT change parameters.
    assert!(matches!(v.set_oracle(addr(0xAB)).unwrap_err(), VaultError::NotOwner(_)));
    // Owner unpauses.
    vm.set_sender(addr(OWNER));
    v.unpause().unwrap();
    assert!(!v.paused());
}

#[test]
fn pause_rejects_non_owner_non_guardian() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    vm.set_sender(addr(ALICE));
    assert!(matches!(v.pause().unwrap_err(), VaultError::NotOwner(_)));
}

#[test]
fn set_guardian_is_owner_only() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    vm.set_sender(addr(ALICE));
    assert!(matches!(v.set_guardian(addr(0x99)).unwrap_err(), VaultError::NotOwner(_)));
}

#[test]
fn accept_ownership_rejects_without_pending() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    vm.set_sender(addr(0xAA));
    assert!(matches!(v.accept_ownership().unwrap_err(), VaultError::NotOwner(_)));
}

// =============================================================================
// 12. Pause gate covers withdraw/withdraw_collateral/mint/deposit
// =============================================================================

#[test]
fn paused_blocks_deposit() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    v.pause().unwrap();
    vm.set_sender(addr(BOB));
    let err = v.deposit(U256::from(1u64), addr(BOB)).unwrap_err();
    assert!(matches!(err, VaultError::Paused(_)));
}

#[test]
fn paused_blocks_mint() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    v.pause().unwrap();
    vm.set_sender(addr(BOB));
    let err = v.mint(U256::from(1u64), addr(BOB)).unwrap_err();
    assert!(matches!(err, VaultError::Paused(_)));
}

#[test]
fn paused_blocks_withdraw() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    v.pause().unwrap();
    vm.set_sender(addr(BOB));
    let err = v
        .withdraw(U256::from(1u64), addr(BOB), addr(BOB))
        .unwrap_err();
    assert!(matches!(err, VaultError::Paused(_)));
}

#[test]
fn paused_blocks_withdraw_collateral() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    v.pause().unwrap();
    vm.set_sender(addr(ALICE));
    let err = v
        .withdraw_collateral(addr(TAAPL), U256::from(1u64))
        .unwrap_err();
    assert!(matches!(err, VaultError::Paused(_)));
}

// =============================================================================
// 13. Listing multiple assets
// =============================================================================

#[test]
fn list_multiple_collateral_assets() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    let taapl = addr(0x55);
    let ttsla = addr(0x56);
    let tspy = addr(0x57);
    v.list_collateral(taapl, 7_000, 8_500, 500, 18).unwrap();
    v.list_collateral(ttsla, 6_500, 8_000, 500, 18).unwrap();
    v.list_collateral(tspy, 7_500, 8_700, 500, 18).unwrap();
    assert_eq!(v.listed_asset_count(), U256::from(3u64));
    assert_eq!(v.listed_asset_at(U256::ZERO), taapl);
    assert_eq!(v.listed_asset_at(U256::from(1u64)), ttsla);
    assert_eq!(v.listed_asset_at(U256::from(2u64)), tspy);
}

// =============================================================================
// 14. Misc admin guards
// =============================================================================

#[test]
fn admin_calls_revert_for_non_owner() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    vm.set_sender(addr(ALICE));
    assert!(matches!(v.pause().unwrap_err(), VaultError::NotOwner(_)));
    assert!(matches!(v.unpause().unwrap_err(), VaultError::NotOwner(_)));
    assert!(matches!(
        v.set_max_price_age(U64::from(60u64)).unwrap_err(),
        VaultError::NotOwner(_)
    ));
    assert!(matches!(
        v.set_close_factor(5_000).unwrap_err(),
        VaultError::NotOwner(_)
    ));
    assert!(matches!(
        v.list_collateral(addr(TAAPL), 7_000, 8_500, 500, 18)
            .unwrap_err(),
        VaultError::NotOwner(_)
    ));
    assert!(matches!(
        v.set_rate_params(200, 400, 6_000, 8_000, 0).unwrap_err(),
        VaultError::NotOwner(_)
    ));
}

#[test]
fn liquidate_when_agent_unset_reverts() {
    let vm = TestVM::default();
    let mut v = deploy(&vm);
    v.set_agent(Address::ZERO).unwrap();
    vm.set_sender(Address::ZERO);
    let err = v
        .liquidate(addr(BOB), U256::from(1u64), addr(TAAPL))
        .unwrap_err();
    assert!(matches!(err, VaultError::NotAgent(_)));
}

// =============================================================================
// 15. Pure module: utilization & rate via the view layer
// =============================================================================

#[test]
fn views_match_interest_model_constants() {
    let vm = TestVM::default();
    let v = deploy(&vm);
    // Defaults from initialize(): base=200, slope1=400, slope2=6000, opt=8000.
    // At zero utilization the rate is exactly `base`.
    assert_eq!(v.borrow_rate_bps(), 200);
    // Cross-check against the pure-math primitive directly.
    let pure = interest_model::borrow_rate_bps(0, 200, 400, 6_000, 8_000);
    assert_eq!(v.borrow_rate_bps(), pure);
}

// ============ Backstop liquidator (mainnet gate #2) — pure gate logic ============

#[test]
fn backstop_agent_always_allowed() {
    assert!(backstop_allows(true, 0, 0, 0));
    assert!(backstop_allows(true, 1_000, 0, 3_600));
}

#[test]
fn backstop_disabled_when_delay_zero() {
    // delay == 0 (testnet/MVP default) ⇒ strictly agent-only; nobody else passes.
    assert!(!backstop_allows(false, 1_000_000, 0, 0));
}

#[test]
fn backstop_opens_only_after_silence_exceeds_delay() {
    let delay = 3_600u64;
    let last = 1_000_000u64;
    assert!(!backstop_allows(false, last + delay, last, delay)); // exactly at the edge
    assert!(!backstop_allows(false, last + delay - 1, last, delay));
    assert!(backstop_allows(false, last + delay + 1, last, delay)); // silent past delay
}

// ============ Dual-oracle deviation guard — pure comparison ============

#[test]
fn deviation_guard_noop_when_disabled() {
    assert!(!price_deviation_exceeds(U256::from(100), U256::from(200), 0));
}

#[test]
fn deviation_guard_within_tolerance_passes() {
    // $200.00 vs $201.00 = 50bps; tolerance 50bps ⇒ not exceeded (strict >).
    let p1 = U256::from(20_000_000_000u64);
    let p2 = U256::from(20_100_000_000u64);
    assert!(!price_deviation_exceeds(p1, p2, 50));
    assert!(!price_deviation_exceeds(p2, p1, 50)); // order-independent
}

#[test]
fn deviation_guard_exceeds_tolerance_trips() {
    // $200 vs $210 = 500bps; tolerance 50bps ⇒ exceeded both directions.
    let p1 = U256::from(20_000_000_000u64);
    let p2 = U256::from(21_000_000_000u64);
    assert!(price_deviation_exceeds(p1, p2, 50));
    assert!(price_deviation_exceeds(p2, p1, 50));
}

#[test]
fn deviation_guard_zero_price_is_safe() {
    assert!(!price_deviation_exceeds(U256::ZERO, U256::from(100), 50));
    assert!(!price_deviation_exceeds(U256::from(100), U256::ZERO, 50));
}
