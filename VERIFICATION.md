# Verify Tessera yourself

Tessera's pitch is "don't trust us, verify." This is the one page that lets you
do exactly that — every claim, reproducible in about 60 seconds. Nothing here
needs our cooperation; it's all public chain data, public endpoints, and tests
you run locally.

Live app: **https://tessera-web-delta.vercel.app** · Chain: **Arbitrum Sepolia**

---

## 1. The protocol is really live on-chain

```bash
# Addresses are machine-readable (no address is hard-coded in the app):
cat shared/addresses/testnet.json

# The Stylus vault is deployed + activated — read live state straight off-chain:
cast call <vault> "maxPriceAge()(uint256)"           --rpc-url https://sepolia-rollup.arbitrum.io/rpc
cast call <vault> "getHealthFactor(address)(uint256)" 0xBd4956F88e7bC946F775a68080D7730186fAdc25 \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc
```

Or just open the vault on Arbiscan and read every lend / borrow / repay /
liquidate transaction.

## 2. The AI agent really acts — watch it, or replay it

- **Live Drill** (`/drill`): you pick the crash size; the agent rescues a real
  position on-chain, every step linking to an Arbiscan tx. The rescue is the
  production code path (`tick → tryAutoRepay → agentRepayFor`), not a script.
- **No wallet?** `/sandbox` runs the exact same decision logic in the browser.
- Every agent action (alert / auto-repay / liquidation) is logged with its tx
  hash on `/transparency`.

## 3. Reproduce every test suite (230+ tests across the suites)

```bash
# Rust math primitives — 67 tests (unit + property-based, proptest):
cargo test -p interest-model

# Stylus vault (host-tested logic):
cargo test -p tessera-vault

# TypeScript risk agent — 100 tests:
pnpm --filter @tessera/agent test

# Web — 41 tests (incl. the CI-locked backtest):
pnpm --filter @tessera/web test

# Solidity mocks (Foundry) — 30 tests:
cd contracts/solidity && forge test
```

CI runs all four on every push (`.github/workflows/ci.yml`).

## 4. The "75%" headline is CI-locked — it can't rot

```bash
pnpm --filter @tessera/web test gap-backtest
```

The reproducible gap backtest's headline number is asserted in
`web/test/gap-backtest.test.ts`. If the protection math ever changes such that
the number drifts, **the build fails**. The marketing claim and the code can
never disagree.

## 5. Property tests — the invariants, not just examples

`cargo test -p interest-model` runs property tests
(`contracts/crates/interest-model/src/proptests.rs`) that assert the safety
invariants across the whole input space, e.g.:

- utilization is always in `[0, 100%]` and monotone in borrows;
- the borrow-rate curve is monotone in utilization and continuous at the kink;
- the supply rate never exceeds the borrow rate;
- more collateral never lowers a health factor; more debt never raises it;
- the borrow index never shrinks; debt never falls below principal as it accrues.

Because the Stylus vault imports these functions verbatim, a property proven
here holds on-chain.

## 6. The public Risk API (read-only, CORS-open)

```bash
curl https://tessera-web-delta.vercel.app/api/risk
curl https://tessera-web-delta.vercel.app/api/risk/0xBd4956F88e7bC946F775a68080D7730186fAdc25
```

Real on-chain reads + the same regime engine the agent runs.

## 7. The agentic / MCP path

```bash
cd mcp && npm install && node demo-agent.mjs
```

A real MCP client → Tessera's MCP server → the live Risk API roundtrip: an
external agent consulting Tessera's risk read before deciding. See
[`mcp/README.md`](mcp/README.md) and [`/developers`](https://tessera-web-delta.vercel.app/developers).

## 8. Measured cost of the Stylus risk math

Computing a full health factor on the Stylus (Rust → WASM) vault — enumerating
the borrower's collateral, reading the oracle, and the WAD-scaled division — is
cheap:

| Call (eth_estimateGas, incl. 21k base + calldata) | Gas |
|---|---|
| `getHealthFactor(address)` | ~113,600 |
| `getAccountData(address)` (collateral + debt + HF) | ~119,600 |
| `getSafetyScore(address)` | ~113,700 |

```bash
cast estimate <vault> "getHealthFactor(address)" 0xBd49…dc25 --rpc-url https://sepolia-rollup.arbitrum.io/rpc
```

This is the live cost of the risk computation the agent runs every block. (A
measured Stylus-vs-Solidity head-to-head against an equivalent contract is
tracked as honest future work — we don't ship a contrived twin.)

## 9. Robinhood Chain + the backstop, proven on-chain

Tessera also runs on **Robinhood Chain testnet (chain 46630)** — the native home
of tokenized equities, an Arbitrum Orbit L2 whose larger code-size limit fits the
**complete** vault: the permissionless backstop liquidator + dual-oracle deviation
guard that are ~1KB over Sepolia's 24KB limit.

```
Vault (full backstop)  0xf10acf61b480c24102b303ebafb97d9392d693f2
RPC                    https://rpc.testnet.chain.robinhood.com/rpc
Explorer               https://explorer.testnet.chain.robinhood.com
```

The backstop isn't just deployed — it's **proven**. A non-agent address
liquidated a stale-heartbeat position on-chain (the permissionless safety release
valve for a down agent), running the same close-factor + post-HF-improvement
guards; the position's health factor went 0.94 → 1.20:

```
Backstop liquidation tx (non-agent, stale heartbeat):
https://explorer.testnet.chain.robinhood.com/tx/0x1c2f6a9024c4ec3018d074510a6bee7eea8a06823a9c975e74f0fe62c4881c76
```

Reproduce the whole RH deployment: `pwsh scripts/deploy-robinhood.ps1` (needs the
deployer funded with RH testnet ETH).

---

*If any command above doesn't reproduce the claim, that's a bug — open an issue.
The whole point of Tessera is that you never have to take our word for it.*
