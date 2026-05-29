# Operator Runbook

Version-controlled operator scripts referenced by TDD §16 and §21.

Each script is a thin, well-logged TypeScript wrapper invoked via `pnpm runbook:*`. They are intentionally idempotent where possible and exit non-zero on any failure so they can be chained in CI or demo scripts.

## Index

| Command | TDD | Status | Description |
|---|---|---|---|
| `pnpm runbook:price --token=<SYMBOL> --usd=<DECIMAL>` | §16.1 | ✅ Phase 1 | Set a `MockOracle` price for a token. Reads addresses from `shared/addresses/local.json`. |
| `pnpm runbook:demo:setup` | §16.1 step 2 | ⏳ Phase 2 | Mint demo tokens and open alice's collateral + borrow position. Blocked on Stylus `TesseraVault`. |
| `pnpm runbook:vault:pause` | §16.3 | ⏳ Phase 2 | Owner-only emergency `pause()`. Blocked on Stylus `TesseraVault`. |
| `pnpm runbook:vault:unpause` | §16.3 | ⏳ Phase 2 | Owner-only `unpause()`. Blocked on Stylus `TesseraVault`. |

## Phase 2 surface (not yet shipped)

The following commands are documented in TDD §16 but require the Stylus vault and the agent process, both of which are owned by other agents in this Phase. They will live alongside this README once Phase 2 lands:

- `pnpm runbook:demo:reset`
- `pnpm runbook:agent:topup --usdc=<AMOUNT>`
- `pnpm runbook:agent:start`
- `pnpm runbook:deploy --env=<ENV>`

## Prerequisites

- `.env` populated from `.env.example` — at minimum `RPC_URL_LOCAL` and `DEPLOYER_PRIVATE_KEY`.
- A local anvil (or testnet) running at `RPC_URL_LOCAL`.
- Mocks deployed via `pnpm contracts:deploy:local` (populates `shared/addresses/local.json`).

## Failure modes

All scripts exit `1` on hard errors (RPC unreachable, tx revert, missing address) and `2` for "not yet implemented" stubs. The exit code is meaningful — wrap calls in shell with `set -e`.
