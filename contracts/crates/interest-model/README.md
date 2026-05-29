# interest-model

Pure-Rust, `no_std`, host-testable math primitives for the Tessera lending
protocol. This crate is the single source of truth for:

- Pool **utilization** in basis points.
- The two-slope **borrow rate** curve (`TDD.md` §3.4.3) and the derived
  **supply rate**.
- **Collateral valuation** and **health factor** (`TDD.md` §3.4.1).
- The Compound-style **borrow index** accrual and per-user debt rehydration
  (`TDD.md` §3.4.2). Implements invariant **I5** (monotonic non-decreasing
  index).
- **Liquidation** amount math (`TDD.md` §3.4.4): close factor, bonus, seize
  amount, collateral clamping.

## Why a separate crate?

The Phase 2 Stylus vault crate (`contracts/crates/vault`) imports these
functions directly, but they have **no dependency on `stylus-sdk`**. Keeping
the math pure means:

- It compiles and tests on the host with plain `cargo test` — no WASM
  toolchain, no Stylus VM.
- The `proptest` property tests in `tests/properties.rs` can sweep 256 cases
  per invariant per CI run.
- Future ports (e.g. a TypeScript shadow implementation for the agent) have
  a precise, executable reference.

## Conventions

| Quantity | Units | Notes |
| --- | --- | --- |
| Ratios, rates | basis points (`u32`) | `10_000 bp = 100%` |
| Borrow index | `U256` scaled by `1e18` (`WAD`) | Compound convention, not Aave's 1e27 ray |
| Health factor | `U256` scaled by `1e18` | `1.1e18` = "healthy buffer", `<1e18` = liquidatable |
| Prices | `U256` scaled by `1e8` | Matches Chainlink `AggregatorV3.latestAnswer` |
| USDC amounts | `U256`, 6-decimal native units | Hard-coded; see [`liquidate`] for PHASE 2 note |
| `SECONDS_PER_YEAR` | `31_536_000` (`365 * 86_400`) | Same as Aave/Compound |

## Running tests

```bash
cargo test  -p interest-model
cargo clippy -p interest-model -- -D warnings
cargo fmt    -p interest-model -- --check
```

All three must pass on every commit that touches this crate.
