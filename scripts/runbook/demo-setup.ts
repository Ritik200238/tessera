#!/usr/bin/env tsx
/**
 * Runbook: prepare the weekend-liquidation demo (TDD §16.1, step 2).
 *
 * ⚠️ PHASE 2 — DEFERRED.
 *
 * This script requires the Stylus `TesseraVault` contract to exist (Agent B / Phase 2).
 * The full implementation must:
 *   1. Mint 10 tAAPL to the `alice` demo wallet.
 *   2. From alice: approve the vault and call `deposit_collateral(tAAPL, 10e18)`.
 *   3. From alice: call `borrow(1200e6)` USDC.
 *   4. Mint 5,000 USDC to the `bob` demo wallet.
 *   5. From bob: approve the vault and call ERC-4626 `deposit(5000e6, bob)` into the lender pool.
 *   6. Top up the agent's USDC float (see runbook:agent:topup, also Phase 2).
 *
 * Until the vault is deployed, this script exits with a clear message rather
 * than pretending to do anything. Deliberate stub — see CLAUDE.md §1.
 */
console.error(
  "[runbook:demo:setup] not yet implemented — the Stylus vault is a Phase 2 deliverable.\n" +
    "  Re-run this script once `shared/addresses/local.json` contains a non-zero TesseraVault address.",
);
process.exit(2);
