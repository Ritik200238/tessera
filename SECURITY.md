# Security Policy

Tessera is **testnet software and has not been audited.** Do not use it with real funds.
See the mainnet gates at the bottom — they are hard requirements before any mainnet deploy.

## Reporting a vulnerability

Please **do not open a public issue** for a security vulnerability. Contact the maintainers
privately first (the founder's email / X DM in the repo profile) with a description and, ideally,
a reproduction. We aim to acknowledge within 72 hours and will publish a postmortem after a fix
ships, per the radical-transparency commitment.

## Trust boundaries (by design)

- **Non-custodial.** The protocol never holds user funds beyond the vault's accounting. The AI
  agent never holds user funds.
- **The agent can only *reduce* debt.** `agentRepayFor` is agent-only, pulls **only** from a
  user's own pre-approved USDC allowance, and can never withdraw or move user funds. The user's
  ERC-20 allowance to the vault is both the spending cap and the kill switch (revoke = disable).
- **Deterministic core, advisory LLM.** The agent's decisions (whether/how much to act) are
  deterministic. The LLM only writes alert copy; it never moves money. Natural-language config is
  re-validated against a strict schema, so an injected prompt cannot push an out-of-range value.

## The agent hot key — blast radius & rotation runbook

The agent signs from a single hot key (`AGENT_PRIVATE_KEY`) and is the only address the vault's
`only_agent` gate accepts (`liquidate`, `agentRepayFor`). Treat it as a hot wallet.

**Blast radius if the key leaks.** The attacker becomes "the agent." They **cannot extract value**
(the vault bounds `agentRepayFor` to debt reduction from the user's own allowance, and `liquidate`
to the permissioned partial-liquidation path). They **can** grief: force-repay opted-in users'
approved USDC at adversarial moments, and time liquidations. A per-`(user, day)` repay ceiling is
enforced **on-chain** in `agent_repay_for` so a leaked key cannot drain a user's full allowance in
one block.

**Detection signals (page on any of these):**
- Agent `/health` down > 2 minutes (uptime monitor).
- Repeated tick errors / a `BadDebtRealized` event / liquidations skipped on low float
  (Discord/incident webhook).
- Any `agentRepayFor` / `liquidate` tx the operator's own agent did not originate.

**Rotation steps:**
1. **Stop the bleed:** call `setAgent(0x0)` from the owner/multisig to revoke the compromised
   agent immediately (the vault then rejects all agent actions).
2. Provision a fresh key in your KMS / host secret store; never reuse the leaked key.
3. `setAgent(<new agent address>)`; restart the agent pointed at the new key.
4. Rotate `AGENT_ADMIN_SECRET` (it gates `/config`, `/metrics`, `/alerts`).
5. Publish a postmortem within 72 hours.

**Hardening already in place:** the public HTTP surface (`/actions`, `/health`) is rate-limited and
CORS-scoped; `/alerts` and `/metrics` are bearer-gated (the float/distressed-user data is an
operational-security side channel); the public action log truncates addresses and rounds amounts;
and the process fails fast in production if `AGENT_ADMIN_SECRET` is left at its insecure default.
Run the signing process isolated from the public HTTP server where possible.

## Operational secrets

- `.env*` files are gitignored and must never be committed (CI/secret scans enforce this).
- `AGENT_ADMIN_SECRET` has **no safe default in production** — the agent refuses to boot with the
  dev default when `NODE_ENV=production`.

## Mainnet gates (hard requirements, non-negotiable)

1. Independent audit complete (Arbitrum Foundation grant-funded preferred).
2. Permissionless, heartbeat-gated liquidation backstop merged + tested (so a down agent can't
   strand lenders).
3. Immunefi bug bounty live.
4. Insurance / safety reserve seeded (the on-chain reserve-factor skim funds this).
5. Legal review of ToS + risk disclosure; US + sanctioned-jurisdiction geo-block at the frontend.
6. Conservative initial TVL caps per asset.
