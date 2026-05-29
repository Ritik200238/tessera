# Tessera

**AI-protected yield and lending for tokenized stocks on Robinhood Chain.**

Tokenized equities (tAAPL, tTSLA, tSPY) deposited into Tessera's Stylus-powered vault earn passive yield through peer-to-peer USDC lending — the same mechanism that generates billions for prime brokers in TradFi. An AI risk agent built on Vibekit monitors collateral 24/7 and reacts within seconds to weekend price moves and overnight earnings shocks, when traditional markets are closed.

Deposit → Earn → AI Protects.

---

## Quickstart

```bash
# 1. install JS + Rust deps
pnpm install

# 2. build and test the Solidity mocks
pnpm contracts:test

# 3. deploy mocks to a local anvil
anvil &                                # in one terminal
pnpm contracts:deploy:local            # in another
```

After step 3, the deployed addresses are written to `shared/addresses/local.json`. The Stylus vault (Phase 2), the agent, and the UI consume that file.

---

## Repository map

```
tessera/
├── contracts/
│   ├── solidity/          # Foundry sub-project — mocks (USDC, tStock, oracle)
│   └── crates/            # Stylus / Rust contracts (vault, interest-model)
├── agent/                 # Vibekit risk agent (TypeScript)
├── web/                   # Next.js UI
├── shared/
│   ├── abis/              # generated ABIs consumed by agent + web
│   └── addresses/         # per-network deployed addresses
├── scripts/runbook/       # operator runbook scripts (see TDD §16)
├── docs/                  # cloned reference repos (Arbitrum, Stylus, OZ)
├── PRD/PRD.md             # product scope
└── TDD/TDD.md             # technical design
```

The PRD and TDD are the source of truth for what we build and how.

---

## Status

| Phase | Scope | Status |
|---|---|---|
| 1 | Monorepo + Solidity mocks (this commit) | shipped |
| 2 | Stylus vault + interest-model crate | in progress |
| 3 | Vibekit agent | in progress |
| 4 | Next.js UI | in progress |

See `TDD/TDD.md §12` for the full week-by-week plan.
