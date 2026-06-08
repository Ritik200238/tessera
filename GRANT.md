# Tessera — Arbitrum / Stylus Grant Brief

> **One line:** Tessera is the safest place on-chain to lend and borrow against
> tokenized equities — a Rust (Stylus) lending vault with an autonomous AI agent
> that watches every position 24/7 and prevents catastrophic liquidations before
> they happen.

This brief is for the **Arbitrum Foundation Stylus Incubation / ecosystem grant**.
The ask is **audit funding** (the single hard gate before we deploy with real
funds) and Stylus ecosystem support. We have no token and never will — this is a
pure protocol-revenue business, so a grant funds public-good security work, not a
speculative launch.

## Why this is a flagship Stylus use case

- **Real Rust-on-Arbitrum DeFi, not a toy.** The vault is a from-scratch Stylus
  contract: an ERC-4626 USDC lender surface, a Compound-style borrow index, an
  Aave-style two-slope rate model, per-asset risk params, and a permissioned
  partial-liquidation engine — all in `no_std` Rust compiled to WASM and
  **deployed live on Arbitrum Sepolia** (`0x72adaa…57ba7`).
- **Stylus-specific engineering depth.** We solved the things grant reviewers
  care about: a stable append-only storage layout, the 24KB compressed
  code-size budget (we trim and measure every deploy), the Windows/`no-admin`
  build recipe (`build-std` + `panic=immediate-abort` + `wasm-opt -Oz`), and a
  pure, host-tested `interest-model` crate so the money-math is verified
  independently of the chain.
- **Novel composition Arbitrum doesn't have yet.** Tokenized-equity lending +
  an AI risk layer. Stocks gap over weekends; the agent's auto-repay (from a
  user's *own* pre-approved USDC) and protective liquidation are the structural
  answer. This is a category, not a fork.

## Technical credibility (all in the public repo)

- **Tested + CI-green.** Pure interest/liquidation math is host-tested in Rust;
  the agent has 88 tests; the web has a typed test suite; GitHub Actions runs
  Rust, Solidity (forge), agent, and web on every push.
- **Security-first.** Accrue-before-read, HF post-checks on borrow/withdraw,
  oracle staleness reverts, no `unwrap` in contract paths, conservative LTVs
  (40–60%), a documented agent-key blast-radius + rotation runbook
  (`SECURITY.md`), and an on-chain `setAgent(0x0)` kill switch.
- **Recent correctness hardening (this milestone).** A multi-lens audit drove
  fixes now live on-chain: max-LTV enforced at borrow, exact (scaled)
  `totalAssets`, oracle feed-decimals normalization, ERC-4626 virtual shares
  against the first-depositor inflation attack, debt rounding in the protocol's
  favor, a liquidation post-HF guard, per-asset freeze, and an on-chain
  per-(user, day) agent-repay cap.
- **Radical transparency.** Open-source from day one, a public action/alert
  feed, a `/transparency` page, and a public-postmortem commitment.

## Ecosystem value to Arbitrum

- Brings the **tokenized-RWA + AI-risk** narrative to Arbitrum with a real
  product, not a deck.
- A **canonical DeFi venue** for tokenized-stock issuers (Backed, Dinari, Ondo,
  …) to point liquidity at — a partnership/distribution surface for the chain.
- A reusable **AI risk engine** (deterministic core + advisory LLM) that other
  Arbitrum protocols could adopt as infrastructure over time.

## What the grant funds (mainnet gates)

1. **Independent audit** of the Stylus vault — the primary ask.
2. Permissionless, heartbeat-gated **liquidation backstop** (already storage-wired; lands in the audited build).
3. **Immunefi** bug bounty.
4. **Insurance / safety reserve** seeded (the on-chain reserve-factor skim funds it).
5. Legal review (ToS + risk disclosure) and conservative per-asset TVL caps.

## Status & links

- **Live testnet:** Arbitrum Sepolia — vault, mock USDC + tokenized-stock
  faucet, Chainlink-compatible oracle adapter.
- **Web app:** deposit → earn, borrow → AI-protected, transparency + risk pages.
- **Repo:** the contracts, the agent, the web app, the docs, and this brief are
  all public. CI is green.

We are not asking for runway. We are asking for the one thing a no-token,
security-first protocol can't bootstrap alone: a credible audit before real
funds touch the vault.
