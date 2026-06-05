# Contributing to Tessera

Thanks for your interest. Tessera is an AI-protected lending protocol for tokenized
stocks — a Stylus (Rust) vault, a TypeScript risk agent, and a Next.js app. This guide
gets you from clone to a green test run on any OS.

## Prerequisites

- **Node.js ≥ 22** and **pnpm ≥ 10** (`npm i -g pnpm`)
- **Rust** (stable) + `rustup` — for the vault / interest-model crates
- **Foundry** (`forge`, `cast`) — for the Solidity mocks ([install](https://book.getfoundry.sh/getting-started/installation))

The Stylus **wasm build/deploy** has extra, platform-specific toolchain needs
(documented in the README). You do **not** need that toolchain to run the tests below —
only to produce a deployable `.wasm`.

## Setup

```bash
git clone https://github.com/Ritik200238/tessera.git
cd tessera
pnpm install          # installs the agent + web + shared workspace
```

## Running the test suites

```bash
# TypeScript
pnpm --filter @tessera/agent run test        # risk agent (vitest)
pnpm --filter @tessera/web   run test        # web (vitest)
pnpm --filter @tessera/agent run typecheck
pnpm --filter @tessera/web   run typecheck

# Rust (vault + interest-model host tests)
cargo test --workspace

# Solidity mocks
cd contracts/solidity
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts   # first time only
forge test
```

CI runs all four suites on every push and PR (`.github/workflows/ci.yml`).

## Running the app locally

```bash
# Web
cp web/.env.local.example web/.env.local       # set RPC + agent URL
pnpm --filter @tessera/web run dev

# Agent
cp agent/.env.example agent/.env                # set RPC, VAULT_ADDRESS, AGENT_PRIVATE_KEY
pnpm --filter @tessera/agent run dev
```

Both `.env` files are gitignored — **never commit keys.**

## Project principles

Tessera follows the standards in [`CLAUDE.md`](./CLAUDE.md): production-grade, no
placeholder logic, security first, docs-driven. The deterministic agent core must never
depend on the LLM, and the AI agent can only ever *reduce* a user's debt with funds they
pre-approved.

## Pull requests

1. Branch from `main`.
2. Keep the diff focused; match the surrounding code style.
3. Make sure all four test suites pass and `typecheck` is clean.
4. Describe **what** changed and **why** in the PR body.

## Security

This is testnet software and is **not audited**. Found a vulnerability? Please do not open
a public issue — see [`SECURITY.md`](./SECURITY.md) if present, or contact the maintainers
privately first.
