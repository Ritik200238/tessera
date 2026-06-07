# Tessera — Enhanced Version (Production-Readiness Roadmap)

> Output of a multi-lens, adversarially-verified audit (smart-contract security, agent reliability,
> privacy red-team, product/UX, founder/GTM). 39 findings collected → 19 Critical/High independently
> verified against the real code → **37 survivors**. Every item below is grounded in a `file:line`.
>
> **How to use this doc:** work **top to bottom**. Items are grouped by priority tier
> (Critical → High → Medium → Nice) and, inside each tier, ordered by the launch critical path and
> dependencies. Each item is self-contained: Problem · Risk · Solution · **Acceptance Criteria (DoD)** ·
> Evidence · Effort. Do not check a box until its Acceptance Criteria all pass — that is the guard
> against half-baked work.
>
> **Constraints honored:** no domain purchase, no demo video, no UI/brand redesign (only essential,
> on-brand UX), respect the TDD + blueprint (no relitigating locked decisions), follow CLAUDE.md
> (no slop/fake logic, security-first, docs-driven), keep the product vision and flow intact.
>
> Legend: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Nice — `[BLIND]` = genuine blind spot (not previously
> documented) · `[gate]` = an execution detail inside a known blueprint gate. Effort: **S** ≤ half day ·
> **M** ~1–2 days · **L** ~3–5 days.

---

## The 5 things actually wrong (cross-cutting themes)

1. **Config exists, behavior doesn't.** The safety story lives in parameters the code never honors:
   `max_ltv` is dead config (borrow opens *at* the liquidation line), `reserve_factor` is never skimmed,
   the oracle hardcodes 8 decimals, and the landing sells per-day caps + Telegram/email alerts that don't
   exist. The conservative-LTV / 15%-reserve / safety-buffer narrative that *is* the product is, at the
   code level, cosmetic.
2. **The moat is invisible and unreliable.** `NEXT_PUBLIC_AGENT_URL` is unset on the live app, so the AI —
   the entire "why Tessera over Aave" — reads **Offline** to every visitor. And even when wired, the agent
   can't be trusted to be on: fire-and-forget txs, per-block idempotency that burns a needed liquidation on
   any transient error, an unbounded sequential scan, and no incident/on-call for a 24/7 promise.
3. **Radical transparency was built without a privacy/abuse boundary.** Public `/actions`, `/alerts/latest`,
   `/metrics` dox borrower addresses + debt + HF and leak the agent's exact liquidation float — unauth, no
   CORS, no rate limit. Transparency became an attack surface.
4. **The product tells the user a different story than it executes.** One global trigger but UI implies
   per-user; the borrow slider mislabels risk-weighted collateral as raw value; "enable protection" gives no
   confirmation you're watched; the public `/agent` page shows operator-only controls that 503; the shipped
   PRD still encodes the abandoned persona and 70/85% LTVs.
5. **Launching blind on a single point of everything.** One hardcoded RPC deanonymizes every user; one hot
   agent key with undocumented blast radius pushes all protective txs through the public mempool; one global
   pause; zero product analytics. No redundancy, no visibility — the first signal of failure will be a user's
   liquidation.

---

## Critical Path to Launch (do these, in this order)

This is the minimum ordered sequence that makes the product *honest, correct, and observable*. IDs link to
the detailed entries below.

1. `protection-claims-vs-reality` — stop the false marketing claims (build the cap+alert, or fix the copy).
2. `stale-prd-positioning-drift` — make the public source-of-truth match the real product.
3. `max-ltv-not-enforced-on-borrow` — restore the safety buffer the whole protocol assumes.
4. `total-assets-overstates-debt` — fix lender share-price accounting (phantom assets).
5. `no-chainlink-decimals-validation` — make the mainnet oracle swap safe.
6. `moat-not-felt-agent-offline` / `agent-offline-everywhere` — host the agent; make the differentiator visible.
7. `no-receipt-no-nonce-management` — stop silent on-chain tx failures being reported as success.
8. `tracked-set-grows-unbounded` — persist borrowers so the at-risk user is never missed.
9. `public-action-log-doxes-borrowers` — close the distressed-borrower doxing feed.
10. `borrow-ltv-mislabels-weighted-collateral` — fix the headline number in the conversion flow.
11. `public-agent-page-exposes-operator-controls` — gate operator knobs; surface the real per-user kill switch.
12. `no-watching-confirmation` — show the user they're individually covered.
13. `no-incident-comms-on-call` — detect a dead agent before a user is liquidated.
14. `no-analytics-no-funnel` — stop launching blind on activation.

**Batching note:** items 3, 4, 5 and the Medium contract items (`first-depositor-inflation`,
`reserve-factor-never-skimmed`, `liquidation-no-post-hf-check`, `debt-rounds-down`, `no-per-asset-pause`)
all require a vault redeploy — **do them in one contract revision + one redeploy + one test pass**, not five.

---

# 🔴 CRITICAL — must fix before launch

### 🔴 `protection-claims-vs-reality` [BLIND] — Landing sells protection features that don't exist
- **Problem:** `web/app/page.tsx:761-765` says auto-repay is "capped per transaction and per day" and
  `agent-controls.tsx:90-95` calls the allowance "the spending cap" — but there is **no per-day cap**; the only
  bound is the standing USDC allowance (`lib.rs:1019-1027`, `tick.ts:206-220` size the repay with zero daily
  throttle). `page.tsx:746-748` promises "Alerts arrive on Telegram, Discord, or email" — but the alerter only
  writes JSONL/`latest_alerts.json` (`alerter.ts`); there is **no Telegram/Discord/email/webhook delivery**
  anywhere in `agent/src`.
- **Risk:** For a "credibility over incentives," public, open-source protocol, marketing claims that are
  demonstrably false in the repo are the fastest way to destroy the no-token trust story. The per-day-cap
  claim is also a real safety regression — users approve large allowances believing a daily ceiling protects
  them.
- **Solution (CLAUDE.md "no fake logic" ⇒ build it, the correct path):**
  (a) Add a per-`(user, UTC-day)` repaid-total ledger in the agent SQLite, enforced in `tryAutoRepay` before
  the budget check; (b) ship **one** real alert channel — a Telegram bot (~30 lines, free; blueprint §22.5
  already names it) wired into `emitAlert`. *Interim until (a)/(b) land:* change copy to the truth ("capped by
  the USDC you approve"; "every alert lands in your in-app activity feed").
- **Acceptance Criteria:**
  - [ ] A per-(user,day) repaid ledger exists in agent SQLite; `tryAutoRepay` refuses once the day's cap is hit; a test proves a 2nd same-day repay over the cap is blocked.
  - [ ] At least one external alert channel (Telegram) actually delivers on `emitAlert`, behind an env-config; a test/dry-run shows a message sent.
  - [ ] No landing/agent-controls copy claims a capability that isn't live (grep the copy against shipped features).
- **Evidence:** `web/app/page.tsx:746-748,761-765`; `agent/src/strategy/alerter.ts:24-48`; `agent/src/strategy/auto-repay.ts:120-129`; `contracts/crates/vault/src/lib.rs:1019-1027`
- **Effort:** M · **Depends on:** none

### 🔴 `moat-not-felt-agent-offline` [BLIND] — The AI differentiator renders "Offline" to every visitor
- **Problem:** All agent telemetry flows through `env.agentUrl` (`web/lib/agent.ts:68-101`); `NEXT_PUBLIC_AGENT_URL`
  is unset on the live Vercel app, so the activity feed, `/status` uptime, and the alert stream render empty/
  "Offline." The agent also needs a long-lived host (TDD §10.3 explicitly says *not* Vercel) — so it simply
  isn't running for the deployed product.
- **Risk:** The *only* differentiator vs Aave/Morpho is invisible at first impression. To the Aave-migrator
  doing a side-by-side, Tessera looks like a smaller, unaudited money market — strictly dominated. The moat
  exists in the repo and tests but is felt by zero real users.
- **Solution:** (1) Host the agent on a free always-on tier (Fly.io/Render/Railway — TDD §10.3 scopes Fly at
  ~$2/mo) and set `NEXT_PUBLIC_AGENT_URL` in Vercel; the public `/actions` + `/health` are already built for
  this. (2) Seed a continuously-protected demo position (blueprint §24 "demo wallet pre-seeded") + run the
  keeper so the feed always shows real, recent agent actions ("watched N blocks · last action 4m ago").
- **Acceptance Criteria:**
  - [ ] Agent runs on an always-on host; `/health` and `/actions` reachable over HTTPS.
  - [ ] `NEXT_PUBLIC_AGENT_URL` set in Vercel prod; the live dashboard/`/status`/`/agent` show a real heartbeat and recent actions (not "Offline").
  - [ ] A seeded demo position generates a fresh agent action at least every few hours (keeper + e2e loop), verified on `/transparency`.
- **Evidence:** `web/lib/agent.ts:68-101`; `TDD/TDD.md:672-674`; `soft-floating-charm.md:498`
- **Effort:** M · **Depends on:** agent-reliability fixes are ideally landed first so the always-on agent is trustworthy (`no-receipt…`, `tracked-set…`)

---

# 🟠 HIGH PRIORITY

### 🟠 `max-ltv-not-enforced-on-borrow` [BLIND] — Borrow opens positions exactly at the liquidation line
- **Problem:** `borrow()` only enforces `HF >= 1e18` (`lib.rs:973-976`), and HF weights collateral by
  `liq_threshold_bps` (`lib.rs:169-176`). So a user can borrow until HF == 1.0 — right at the liquidation
  threshold. `max_ltv_bps` is stored/validated/emitted but **never read on any borrow path** (the code comment
  `lib.rs:977-982` admits it). Contradicts the TDD's own buffer design (`TDD.md:773-774`).
- **Risk:** A fresh loan has **zero buffer** — the next price/interest tick makes it liquidatable, so the agent
  has no time-to-act window and the "AI Protects" promise is mechanically impossible. No over-collateralization
  margin protects lenders.
- **Solution:** Add a second post-write check in `borrow()` that values collateral weighted by `max_ltv_bps`
  and requires `health_factor(ltv_weighted_coll_8, debt_usd_8) >= 1e18` **at borrow-open only**. Reuses the
  existing `collateral_value_usd_8` primitive (pass `max_ltv` where it passes `liq_threshold`). `withdraw_collateral`
  keeps the `liq_threshold` check.
- **Acceptance Criteria:**
  - [ ] `borrow()` reverts when max-LTV-weighted collateral < debt; opening a max-size loan leaves HF (liq-weighted) strictly > 1.0 with the documented buffer.
  - [ ] Proptest: for fuzzed deposits/borrows, post-borrow `max_ltv_weighted_value >= debt` always holds.
  - [ ] All existing vault tests pass; redeployed; `/risk` Max-LTV values now actually bind.
- **Evidence:** `contracts/crates/vault/src/lib.rs:973-982,169-176`; `TDD/TDD.md:773-774`
- **Effort:** S (batch with the redeploy) · **Depends on:** redeploy batch

### 🟠 `total-assets-overstates-debt` [BLIND] — Lender share price inflated by phantom assets
- **Problem:** `total_assets_internal()` approximates outstanding debt as `total_principal * current_index / WAD`
  (`lib.rs:221-231`), but `total_principal` is the raw sum of per-user principals each snapshotted at that
  user's `user_index (>= WAD)`. True debt is `Σ principal[u] * current_index / user_index[u]`. Dividing by WAD
  instead of `user_index[u]` **overstates** debt; the inline comment claims the opposite.
- **Risk:** `convert_to_shares/assets` price every lender's shares too high → late depositors overpay, early
  redeemers pull more than the pool's true value, last lenders short-changed (slow value leak that compounds
  with utilization/time). Breaks invariant I1 (`TDD.md:605`) and makes displayed APY/TVL wrong.
- **Solution:** Maintain a **scaled** `total_principal` (Aave's `scaledTotalSupply`): store
  `Σ principal[u]/user_index[u]`, updated on every borrow/repay/liquidate; true total debt =
  `scaled_total * current_index`. Removes the approximation entirely.
- **Acceptance Criteria:**
  - [ ] Scaled-principal accumulator added and updated on borrow/repay/liquidate.
  - [ ] Proptest: `total_assets == idle + Σ_u debt_of(u)` over a fuzzed multi-borrower, multi-accrual set.
  - [ ] `convert_to_shares(convert_to_assets(x))` round-trips within rounding bounds; redeployed.
- **Evidence:** `contracts/crates/vault/src/lib.rs:203-232,967-968`; `TDD/TDD.md:605`
- **Effort:** M (batch with the redeploy) · **Depends on:** redeploy batch

### 🟠 `no-chainlink-decimals-validation` [BLIND] — Oracle assumes 8-decimal feeds, never reads `decimals()`
- **Problem:** `price_usd_8` (`oracle.rs:32-66`) treats the raw `int256` answer as 8-decimal USD and feeds it
  into math that hard-assumes `PRICE_DECIMALS=8` (`liquidate.rs:24`, `health.rs:22`). The adapter never calls
  `decimals()`. Real Arbitrum Chainlink feeds are **not** uniformly 8-decimal, and the mock→prod swap is "just
  an address change."
- **Risk:** Any non-8-decimal mainnet feed mis-scales every price by `10^(d-8)` → mass false-healthy (lenders
  eat losses) or mass false-underwater (everyone liquidatable). Silent, catastrophic, and invisible on the
  hardcoded-8 testnet mock.
- **Solution:** Read `feed.decimals()` at `list_collateral` time, store it in `AssetParams` (append-only,
  ABI-safe), and normalize every read to 8dp; **or** at minimum read `decimals()` in `price_usd_8` and revert
  `OracleFailure` if `!= 8` (loud fail beats silent mis-pricing).
- **Acceptance Criteria:**
  - [ ] Feed decimals are read once at listing and stored; reads normalize to 8dp (or revert on mismatch).
  - [ ] A test lists a mock with `decimals()=18` and proves prices normalize (or the listing/read reverts loudly).
  - [ ] `AssetParams` extension is append-only (storage layout unchanged for existing fields); redeployed.
- **Evidence:** `contracts/crates/vault/src/oracle.rs:21-66`; `interest-model/src/liquidate.rs:24`; `health.rs:22`
- **Effort:** M (batch with the redeploy) · **Depends on:** redeploy batch

### 🟠 `no-receipt-no-nonce-management` [BLIND] — Protective txs are fire-and-forget; failures look like success
- **Problem:** `tryLiquidate`/`tryAutoRepay` call `walletClient.writeContract(...)`, log `status:'submitted'`,
  and return — never `waitForTransactionReceipt`, never inspect on-chain status, no nonce/replacement handling
  (`liquidator.ts:145-164`, `auto-repay.ts:163-181`; grep finds no `nonce`/`waitForTransactionReceipt`).
- **Risk:** (a) A tx that simulates OK but reverts on-chain is recorded as a successful liquidation/repay — the
  public log and metrics **lie**. (b) A stuck pending tx wedges the nonce lane; the next tick reuses `latest`
  nonce → "nonce too low," and the per-block idempotency means the user isn't retried that block — the position
  deteriorates with no error explaining why nothing lands, precisely during congestion when it matters most.
- **Solution:** Add an honest **step 6 (confirm)**: after `writeContract`, `await waitForTransactionReceipt`
  (bounded timeout); set `status:'confirmed'` only on `success`, else `status:'reverted-onchain'` + a distinct
  metric. Track the pending nonce locally; on timeout, resubmit same-nonce with bumped `maxFeePerGas`. Keep
  `submitted` vs `confirmed` distinct in metrics so transparency stays truthful (CLAUDE.md).
- **Acceptance Criteria:**
  - [ ] Every money-moving tx awaits a receipt; only `success` is logged/metered as confirmed; reverts produce a `reverted-onchain` record + metric.
  - [ ] A stuck/low-gas tx is detected and resubmitted with the same nonce + higher fee (test or documented manual proof).
  - [ ] `/transparency` and metrics never show "protected" for a tx that didn't confirm.
- **Evidence:** `agent/src/strategy/liquidator.ts:145-164`; `agent/src/strategy/auto-repay.ts:163-181`
- **Effort:** M · **Depends on:** none (do before/with hosting the agent)

### 🟠 `tracked-set-grows-unbounded` [BLIND] — Borrower set only grows; the quiet-then-underwater user is missed
- **Problem:** `indexUsers()` adds every event's `topic[1]` to an in-process `Set` that is never pruned
  (`index.ts:184-233`). Two failure modes: (1) it never shrinks → O(n) scan cost rises forever; (2) on cold
  start the only discovery is a single `getLogs` lookback (`AGENT_LOG_LOOKBACK`, default 50k blocks ≈ a few
  hours) — a borrower who opened long ago and went quiet (the classic "walks away, then the market gaps") is
  **never added** unless manually pinned. No durable borrower list, no backfill.
- **Risk:** The exact user the protocol most needs to protect is invisible on any fresh/restarted process →
  silent protection gap with zero alert/auto-repay/liquidation.
- **Solution:** Persist a `borrowers(user PK, last_seen_block, has_debt)` table in the existing SQLite. Insert
  on every Borrow event; the tick scans the DB list, not `getLogs`. Mark `has_debt=0` when a tick sees
  `debtOf==0` (keep the row for instant re-borrow). One-time **full backfill** from the known vault deploy block
  to head on first boot (chunked as today) so no borrower is ever missed regardless of quiet time.
- **Acceptance Criteria:**
  - [ ] Borrowers persist in SQLite; a restart re-derives the full active set without `getLogs` lookback gaps.
  - [ ] A borrower who opened before the lookback window and stays quiet is still scanned (test or scripted proof).
  - [ ] Per-tick scan iterates only active (has_debt) borrowers; zero-debt users are excluded but instantly re-added on re-borrow.
- **Evidence:** `agent/src/index.ts:184-233`; `agent/src/db/schema.ts:10-39`
- **Effort:** M · **Depends on:** none

### 🟠 `borrow-ltv-mislabels-weighted-collateral` [BLIND] — Borrow slider shows the wrong "Collateral value"
- **Problem:** `getAccountData()[0]` returns collateral **already** multiplied by each asset's liq threshold
  (`lib.rs:147-178` → `health.rs:48-70`). The borrow form labels that weighted number "Collateral value"
  (`borrow-form.tsx:108`), computes `target = collateralValue * ltvBps/10000` (`:55`), and shows "Target LTV …
  70% (max)" (`:132,151`). The landing simulator, by contrast, uses raw collateral (`page.tsx:223`). The two
  surfaces give contradictory numbers for the same deposit.
- **Risk:** The single most important pre-borrow number is wrong and self-contradictory across pages. A
  DeFi-native user notices "Collateral value" shrank vs what they deposited and the LTV math doesn't reconcile
  → reads as a bug, loses trust at the moment of signing. Also silently understates borrowing power.
- **Solution (labeling + denominator, no redesign):** Surface **both**: raw market value (sum
  `collateralOf × oracle price`, or a `getCollateralValueRaw` view) labeled "Collateral value"; the weighted
  figure labeled "Borrowing power (risk-adjusted)." Drive the LTV slider off **raw** value so 70% LTV = 70% of
  market value, matching the landing + `/risk`. Keep `projectHealthFactor` as-is.
- **Acceptance Criteria:**
  - [ ] Borrow form shows raw collateral value and risk-adjusted borrowing power as distinct, correctly-labeled numbers.
  - [ ] LTV slider denominator = raw market value; numbers reconcile with the landing simulator and `/risk` for the same deposit.
  - [ ] Projected HF still correct (fed the weighted value); no visual redesign.
- **Evidence:** `web/components/borrow-form.tsx:46-58,108,132`; `lib.rs:147-178`; `health.rs:48-70`; `web/app/page.tsx:223`
- **Effort:** S · **Depends on:** optionally a `getCollateralValueRaw` view (batch with redeploy) — else compute client-side from `collateralOf × price`

### 🟠 `agent-offline-everywhere` [BLIND] — Every surface says "Offline" + leaks dev config to users
- **Problem:** Because `NEXT_PUBLIC_AGENT_URL` is unset (`env.ts:24`; `agent.ts:85-87`), the dashboard tile,
  `/status` heartbeat, and `/agent` all show "Offline"/"No telemetry," and `/agent` dumps internal copy
  ("Set NEXT_PUBLIC_AGENT_URL… TDD 4.7") to end users (`dashboard-client.tsx:201,210`; `status-client.tsx:77`;
  `agent/page.tsx:28-36`).
- **Risk:** The hero claims "Watched 24/7" while three pages report the watcher is Offline and leak env-setup
  notes — a flat contradiction that reads as a half-finished build.
- **Solution:** (1) Ship a reachable agent URL (same as `moat-not-felt`). (2) Until set, replace developer copy
  with honest user-facing copy that distinguishes "telemetry feed not connected" from "agent not running," and
  keep **on-chain truths** (your allowance, your HF, past `Liquidate` events on `/transparency`) front and
  centre so protection reads as live from chain data. Copy + one endpoint, no redesign.
- **Acceptance Criteria:**
  - [ ] No end-user surface shows env-var names or "TDD" references.
  - [ ] With the agent hosted, all three surfaces show live state; with it down, copy is honest and on-chain data still renders.
- **Evidence:** `web/lib/env.ts:24`; `web/lib/agent.ts:85-102`; `dashboard-client.tsx:195-214`; `status-client.tsx:77`; `web/app/agent/page.tsx:28-36`
- **Effort:** S · **Depends on:** `moat-not-felt-agent-offline`

### 🟠 `unbounded-watchlist-griefing` [BLIND] — Watch set is a zero-cost griefing + cost-blowup vector
- **Problem:** Same root as `tracked-set-grows-unbounded`: per-tick RPC cost scales O(all-historical-users)
  (`tick.ts:159-221`, `auto-repay.ts:71-89`), and an attacker can open dozens of 1-wei dust borrows from fresh
  addresses to permanently bloat the set with no on-chain cost.
- **Risk:** At real adoption or under deliberate griefing, tick latency blows past the TDD §19 budget
  (p99 < 3s, ≤1+N RPC/tick); the agent falls behind during the volatile windows when it must act → a missed
  at-risk position becomes a real liquidation.
- **Solution:** (1) Evict a user from active tracking after `debtOf==0` for K ticks (extend the existing
  zero-debt alert-clear at `tick.ts:169-171`); (2) persist the active set (shared with `tracked-set…`);
  (3) **batch the hot reads via multicall** so RPC is O(1) calls, not O(2N).
- **Acceptance Criteria:**
  - [ ] HF/debt reads for all tracked users use multicall (one/few aggregated calls per tick).
  - [ ] Zero-debt users leave the active scan; dust-borrow swarm does not grow per-tick RPC count unbounded.
  - [ ] Measured tick latency stays within the TDD §19 budget at ≥100 simulated borrowers.
- **Evidence:** `agent/src/index.ts:184-233`; `tick.ts:158-221`; `TDD/TDD.md:919-930`
- **Effort:** M · **Depends on:** `tracked-set-grows-unbounded` (shares the borrowers table); overlaps `sequential-per-user-scan`

### 🟠 `no-analytics-no-funnel` [BLIND] — Launching blind; cannot find the activation cliff
- **Problem:** Blueprint §16 mandates privacy-respecting analytics + a landing→connect→first-action→second-action
  funnel + AI-surface events "from day 1." None exists (grep `plausible|umami|posthog|analytics|gtag|sentry`
  over `web/` = nothing). No event for "reached step 3 (protection) but didn't enable" — the single most
  important activation question for a product whose moat *is* step 3.
- **Risk:** You can't tell if borrowers reach protection opt-in, bounce at connect, or whether the guided flow
  works — so you can't improve activation or prove the moat is adopted. For a no-paid-acquisition GTM, every
  unmeasured drop-off is unrecoverable signal.
- **Solution:** Add one privacy-first script (Umami/Plausible self-host or free tier — no PII, matches no-KYC
  posture) firing four events: `landing_cta_click`, `wallet_connected`, `first_action`, `protection_enabled`.
  Add the post-borrow one-question prompt (blueprint §16) on the borrow success state.
- **Acceptance Criteria:**
  - [ ] Privacy-first analytics live (no PII/fingerprinting); the four funnel events fire and are visible in a dashboard.
  - [ ] A `protection_enabled` vs `reached_protection_step` ratio is measurable.
  - [ ] Post-borrow one-question feedback prompt ships on the success state.
- **Evidence:** `soft-floating-charm.md:321-338`; grep over `web/` = no files
- **Effort:** S · **Depends on:** none

### 🟠 `no-incident-comms-on-call` [BLIND] — A 24/7 promise with no way to know the agent died
- **Problem:** TDD §17 specifies UptimeRobot on `/health`, a Discord `BadDebtRealized` alerter, and a Grafana
  board — none are wired. `/status` only reads `/health` if `NEXT_PUBLIC_AGENT_URL` is set (currently unset).
  No on-call, no incident SLA trigger (blueprint §15 promises a 72h postmortem with no system to fire it),
  single agent instance with a hot key and no standby.
- **Risk:** A silent agent outage during a volatile window produces exactly the catastrophic liquidation the
  product claims to prevent — with no detection, paging, or comms. For a no-token protocol, an undetected
  outage that liquidates a "protected" user is an extinction-level reputation event.
- **Solution:** Stand up the cheap monitoring the TDD already designed: free UptimeRobot on `/health` paging if
  down >2 min; wire the reserved `DISCORD_WEBHOOK_URL` (TDD §20.1) so the agent posts to `#incidents` on
  repeated tick errors / low USDC float / `BadDebtRealized`; show a public `/status` heartbeat that goes red
  within minutes (`/health` already exposes `lastTickAt`/`errors24h`, `index.ts:99-111`). Document a one-page
  on-call rotation.
- **Acceptance Criteria:**
  - [ ] Uptime monitor pings `/health` and pages on >2 min downtime.
  - [ ] Agent posts to a webhook on tick-error streaks / low float / `BadDebtRealized`.
  - [ ] `/status` heartbeat goes red within minutes of a dead agent; a one-page on-call doc exists.
- **Evidence:** `agent/src/index.ts:99-111`; `TDD/TDD.md:872-896`; `soft-floating-charm.md:316`
- **Effort:** S–M · **Depends on:** agent hosted (`moat-not-felt`)

---

# 🟡 MEDIUM PRIORITY

> Contract items here (`first-depositor-inflation`, `reserve-factor-never-skimmed`,
> `liquidation-no-post-hf-check`, `debt-rounds-down`, `no-per-asset-pause`) **batch into the same redeploy** as
> the High contract fixes.

### 🟡 `first-depositor-inflation-no-virtual-shares` [BLIND]
- **Problem:** `convert_to_shares` uses the raw formula with `decimals_offset=0`, no virtual shares, no minimum-
  liquidity lock (`lib.rs:236-268`). First depositor gets `shares==assets`; classic inflation/rounding-to-zero
  vector. (`idle_assets` tracking blunts pure direct-donation, but the 1-wei-supply + large-base path remains.)
- **Risk:** On a fresh deploy (or after supply returns to 0), an attacker can grief (next deposit mints 0 →
  `ZeroShares` DoS) or steal (rounds to far fewer shares). The most common ERC-4626 audit finding.
- **Solution:** Add OZ's defense — a non-zero `decimals_offset` (e.g. 6) virtual-share buffer in the convert
  helpers (cleanest given `idle_assets` is storage-tracked), **or** mint dead shares to `address(0)` on first
  deposit. Add a first-depositor proptest.
- **Acceptance Criteria:**
  - [ ] Virtual-share offset (or dead-share lock) implemented; an inflation-attack proptest cannot force the 2nd depositor to 0/under-fair shares.
  - [ ] Redeployed; lender flows unchanged for honest users.
- **Evidence:** `contracts/crates/vault/src/lib.rs:236-268,660-704`
- **Effort:** S (redeploy batch)

### 🟡 `reserve-factor-never-skimmed` [BLIND]
- **Problem:** `reserve_factor_bps` only feeds the `supply_rate_bps` **view** (`lib.rs:1182-1187`); it never
  enters index accrual (`index.rs:44-64`), there's no reserve balance in storage, no skim. 100% of interest
  flows to lenders regardless. Setting it > 0 at mainnet drops displayed APY while no reserve forms.
- **Risk:** The named "insurance/safety reserve" lever has no on-chain substance; the bad-debt buffer
  (`BadDebtRealized` has no capital behind it) never forms; displayed vs realized yield diverge.
- **Solution:** Add `reserve_assets` (+ recipient) to storage; split accrual at the source — route
  `reserve_factor_bps` of each interest delta to `reserve_assets` (excluded from `total_assets`), remainder to
  lenders. Wire the plumbing now even at 0% so the mainnet flip is a parameter change, not a rewrite.
- **Acceptance Criteria:**
  - [ ] Interest accrual splits to a real reserve sink; `total_assets` excludes reserve; a test at RF>0 shows lender assets + reserve == total accrued interest.
  - [ ] Displayed supply APY matches realized lender yield at RF>0; redeployed.
- **Evidence:** `lib.rs:1182-1187`; `interest-model/src/index.rs:44-64`; `TDD/TDD.md:280,325`
- **Effort:** M (redeploy batch)

### 🟡 `liquidation-no-post-hf-check` + backstop hook [gate]
- **Problem:** `liquidate()` is `only_agent` (`lib.rs:1041`), computes `seize = repay*(1+bonus)`, but has **no
  post-liquidation HF check** and no requirement that health improves — near HF=1.0 the 5% bonus can leave the
  position *more* underwater. Agent-only with no on-chain fallback ⇒ key outage = no liquidations at all; the
  named "permissionless heartbeat-gated backstop" has no entrypoint to attach to.
- **Risk:** Bad-debt amplification at the boundary + single-point-of-failure for lenders.
- **Solution:** (a) Require post-state `new HF > old HF` **or** position fully closed. (b) Pre-wire the backstop:
  store `last_agent_heartbeat` (bump on any agent call); allow **any** caller to liquidate when
  `now - last_agent_heartbeat > heartbeat_timeout`. Keeps agent-only-while-alive (MVP) and makes the backstop a
  config flip, not a rewrite.
- **Acceptance Criteria:**
  - [ ] `liquidate()` reverts if it would not improve HF (and doesn't fully close); test covers a boundary case.
  - [ ] A heartbeat-gated permissionless path exists (disabled/long-timeout at MVP) with a test that a stale heartbeat opens it.
  - [ ] Redeployed.
- **Evidence:** `lib.rs:1031-1127`; `interest-model/src/liquidate.rs:107-129`
- **Effort:** M (redeploy batch)

### 🟡 `debt-rounds-down-favoring-borrower` [gate]
- **Problem:** `current_debt` and conversions round **down** (`index.rs:86-94`); debt should round **up**
  (against the borrower). Borrowers under-pay by ≤1 unit per accrual rehydration; dust debt becomes forgivable;
  lender interest leaks.
- **Risk:** Directional value transfer to borrowers + dust-debt griefing; auditors always flag rounding that
  favors the loan-taker.
- **Solution:** Round debt **up** in `current_debt` (`mulDivUp`); keep collateral valuation rounding down.
  Document rounding direction per quantity. Add a proptest `recorded_debt >= true_debt`.
- **Acceptance Criteria:**
  - [ ] Debt computation rounds up; proptest asserts recorded debt ≥ real-valued debt across fuzzed accruals.
  - [ ] Collateral/shares rounding directions documented and unchanged where already correct; redeployed.
- **Evidence:** `interest-model/src/index.rs:86-94`; `lib.rs:317-325`
- **Effort:** S (redeploy batch)

### 🟡 `no-per-asset-pause` [gate]
- **Problem:** Pause is a single global boolean (`storage.rs:101-104`, `lib.rs:98-103`). `set_asset_enabled(false)`
  zeroes that collateral's value (`lib.rs:161-167`) → flips healthy borrowers underwater. No surgical freeze.
- **Risk:** A single bad feed/de-peg forces either a full-protocol halt or unjust mass-liquidation.
- **Solution:** Add `AssetParams.frozen` (append-only): a frozen asset blocks **new** deposit/borrow but keeps
  valuing existing deposits at last-good value and still allows repay/withdraw/liquidate. Reserve
  `enabled=false`(zero-value) for true delistings.
- **Acceptance Criteria:**
  - [ ] A frozen asset blocks new deposit/borrow, still values existing collateral, allows exits; a test proves healthy borrowers aren't force-liquidated by a freeze.
  - [ ] Redeployed.
- **Evidence:** `storage.rs:101-104`; `lib.rs:98-103,161-167`
- **Effort:** S–M (redeploy batch)

### 🟡 `idempotency-per-block-blocks-retry` [gate]
- **Problem:** `recordIdempotency(user, block, 'attempt')` is written **before** balance/gas/sim/submit
  (`liquidator.ts:64-78`, `auto-repay.ts:116-118`, `db/index.ts:82-89`). A transient failure (swallowed RPC
  error → `getUsdcBalance` returns `0n`, momentary gas spike, sim timeout) permanently burns that block for
  that user.
- **Risk:** A flapping RPC / one-tick gas spike becomes "provably did not act on a liquidatable user this block";
  if block production also slows, the no-action window extends across ticks.
- **Solution:** Record idempotency **after** broadcast (keyed on submission), or split: keep `submitted` as the
  dedupe guard and let pre-submit transient failures NOT consume the block. Distinguish "sim reverted" (real
  can't-act) from "RPC threw" (retryable).
- **Acceptance Criteria:**
  - [ ] A transient pre-submit failure leaves the user retryable on the next tick within the same block; a sim-revert still de-dupes.
  - [ ] No-double-liquidation guarantee preserved (test).
- **Evidence:** `agent/src/strategy/liquidator.ts:64-96`; `auto-repay.ts:116-118`; `db/index.ts:82-89`; `index.ts:116-132`
- **Effort:** S · **Depends on:** pairs with `no-receipt-no-nonce-management`

### 🟡 `sequential-per-user-scan` [gate]
- **Problem:** `runTick` iterates users with serial `await` reads; `findCollateralToken` alone is `1+2*assetCount`
  serial calls per liquidatable user (`tick.ts:98-128,158-234`). Time-to-detect for the Nth borrower ≈
  N × serial RPC latency. No concurrency cap, no multicall, no at-risk prioritization.
- **Risk:** As the set grows, the loop's tail is protected progressively later — blowing the sub-10s target; one
  slow user stalls everyone behind them.
- **Solution:** Multicall the hot reads (HF/debt for all users in a few aggregated calls); do per-user serial
  work only for the at-risk subset, with bounded concurrency (p-limit 4–8); sort the at-risk subset by HF
  ascending so the most-endangered is acted on first. Money-moving actions can stay serial/deterministic.
- **Acceptance Criteria:**
  - [ ] Detection reads are batched (O(rtt), not O(N·rtt)); at-risk users processed most-endangered-first.
  - [ ] Measured detect-to-act < 10s at ≥100 borrowers; decisions remain deterministic.
- **Evidence:** `tick.ts:158-234,98-128`; `TDD/TDD.md:570`
- **Effort:** M · **Depends on:** overlaps `unbounded-watchlist-griefing`

### 🟡 `health-debt-collateral-read-non-atomically` [gate]
- **Problem:** Per user, the tick reads HF, then debt, then collateral, then simulate — separate `eth_call`s at
  `latest`, possibly straddling blocks/nodes (`tick.ts:159-208`, `liquidator.ts:120-126`). Repay size is
  `debt*(TARGET-hf)/TARGET` from a possibly-inconsistent snapshot; `getHealthFactor` is `nonpayable`/lazy-accrue,
  so the eth_call value can differ from what the tx sees.
- **Risk:** Repay/seize sized off a snapshot that matches no single chain state → avoidable sim reverts (wasted
  ticks) or over/undershoot of the target HF; widens under reorgs/node skew.
- **Solution:** Pin one `blockNumber` per user evaluation (read head once at tick start — already done at
  `tick.ts:140` — and pass `{ blockNumber }` to every read), or size the repay from the simulated post-state.
  Multicall gives a single-block snapshot for free.
- **Acceptance Criteria:**
  - [ ] All per-user reads in a tick use one pinned block; repay sizing is computed against a coherent snapshot.
  - [ ] Avoidable sim-revert rate drops (observed in logs/metrics).
- **Evidence:** `tick.ts:159-208`; `liquidator.ts:120-126`; `vault-client.ts:34-39`
- **Effort:** S · **Depends on:** pairs with `sequential-per-user-scan` (multicall)

### 🟡 `public-action-log-doxes-borrowers` [BLIND]
- **Problem:** `/actions` and `/alerts/latest` are unauth, no CORS, no rate limit; the log stores **full**
  borrower addresses + HF + debt + repay/seize (`routes/actions.ts:16`, `log/action.ts:15-57`,
  `alerts.ts:9-11`). The UI shows `shortAddr()` but the raw JSON is full.
- **Risk:** The moment `NEXT_PUBLIC_AGENT_URL` is set, this is a real-time, machine-readable feed of exactly
  which wallets are distressed and about to be auto-repaid/liquidated — a precision targeting + front-running +
  scraping/DoS surface; a privacy violation for the persona.
- **Solution:** (1) Store a **salted keccak prefix** (or truncated addr) + tx hash in the log emit path — the
  on-chain tx still proves the full address to anyone verifying, so no transparency is lost. (2) Hono CORS
  allowlist (Vercel origin) + token-bucket rate limiter in `buildApp`. (3) Gate `/alerts/latest` (a live
  distressed-user list) behind the `/config` bearer.
- **Acceptance Criteria:**
  - [ ] The canonical log never stores full addresses for alert/at-risk events; `/transparency` still verifies via tx hash.
  - [ ] CORS allowlist + rate limiter active on the agent HTTP server; `/alerts/latest` requires auth.
- **Evidence:** `routes/actions.ts:16`; `routes/alerts.ts:9-11`; `log/action.ts:15-57`; `http/server.ts:23-32`
- **Effort:** M · **Depends on:** do before exposing the agent URL publicly

### 🟡 `metrics-leaks-agent-float` [gate]
- **Problem:** `/metrics` is unauth (`routes/metrics.ts:9-12`) and includes `tessera_agent_usdc_balance` (exact
  liquidation float, `metrics.ts:43-47`), `seconds_since_last_tick`, `users_tracked`. The liquidator skips when
  `balance < repayAmount` (`liquidator.ts:81-96`), so the float is a hard cap.
- **Risk:** An attacker sizes a position so `debt/2` exceeds the agent's float → guaranteed "insufficient float"
  skip → denial-of-liquidation; `seconds_since_last_tick` reveals exactly when the agent is stalled.
- **Solution:** Bearer-gate `/metrics` behind `AGENT_ADMIN_SECRET` (server-side scrapers carry the header), or
  move `usdc_balance`/`seconds_since_last_tick` to an internal-only registry. Alarm on "skipped on insufficient
  float."
- **Acceptance Criteria:**
  - [ ] `/metrics` (or at least float + stall gauges) is not publicly readable; a scraper with the secret still works.
  - [ ] Liquidation-skipped-on-low-float raises an operator alert, not a silent log line.
- **Evidence:** `routes/metrics.ts:9-12`; `metrics.ts:43-47`; `liquidator.ts:81-96`
- **Effort:** S · **Depends on:** pairs with `public-action-log-doxes-borrowers`

### 🟡 `protective-tx-public-mempool-frontrun` [gate]
- **Problem:** `liquidate`/`agentRepayFor` submit via plain `writeContract` from a fixed, discoverable agent EOA
  after a public sim (`liquidator.ts:145-152`, `auto-repay.ts:163-170`). The `auto_repay` log publishes exact
  `repay` + `hfBefore` (`action.ts:39-57`).
- **Risk:** A one-block-ahead "this borrower is about to be liquidated/protected" signal to the whole mempool;
  nonce/gas griefing of the protective tx; cent-precise position deanonymization. Medium today (centralized
  sequencer) but acute under decentralized sequencing/Timeboost.
- **Solution:** (1) Submit protective txs via Arbitrum's sequencer-direct/private endpoint or a private relay.
  (2) Round/bucket `repay`/`hfBefore` in the **public** log (exact tx still on-chain). Track this alongside the
  named backstop gate.
- **Acceptance Criteria:**
  - [ ] Protective txs are submitted through a non-public path (or the exposure is explicitly documented as a tracked pre-mainnet gate with a date).
  - [ ] Public feed no longer publishes cent-precise repay/HF.
- **Evidence:** `liquidator.ts:145-152,99-101`; `auto-repay.ts:163-170`; `action.ts:39-57`; `lib.rs:1022,1041`
- **Effort:** M · **Depends on:** none

### 🟡 `nl-config-prompt-injection-stored` [gate]
- **Problem:** `/config` sends free-form `{text}` straight to the LLM to synthesize the agent's config
  (`config.ts:50-60`, `nl-config.ts:82`); the result `notes`/`context` flow into alert copy and the **public**
  JSONL/AlertSnapshot (`alerter.ts:30-46`, `alert-copy.ts:62-67`). `extractJson` trusts model output. Bearer-
  gated, but no output sanitization.
- **Risk:** (1) Injection steering the enforced config — caught **only** by the post-LLM `agentConfigSchema`
  range re-validation, which must never be loosened. (2) Stored injection into the transparency feed
  (log-forging / future stored-XSS if any consumer renders it as HTML).
- **Solution:** Strict allowlist charset + hard length cap on `notes` before persisting; keep
  `agentConfigSchema` as a hard gate + a test that an injected note cannot change `maxGasGwei`/`paused`;
  sanitize `context`/`notes` (strip control chars/HTML/newlines that could forge JSONL rows) at the log
  boundary; Zod-parse the LLM output shape rejecting unexpected keys.
- **Acceptance Criteria:**
  - [ ] Test: an adversarial note cannot alter `maxGasGwei`/`paused`/out-of-range config.
  - [ ] Log boundary strips control/HTML/newline content; a forged-row attempt can't inject a fake action line.
- **Evidence:** `routes/config.ts:50-60`; `nl-config.ts:49-61,82,98`; `alerter.ts:30-46`; `alert-copy.ts:62-67`
- **Effort:** S–M · **Depends on:** none

### 🟡 `single-rpc-deanonymizes-every-user` [gate]
- **Problem:** wagmi uses a single transport from `NEXT_PUBLIC_RPC_URL` (`wagmi.ts:15-24`); every read/write
  from every browser hits one RPC. No fallback, no proxy. Contradicts the blueprint's "we don't link wallets to
  identity" posture (§8) — the provider sees (IP, wallet, full query pattern) for the whole user base.
- **Risk:** One provider (or anyone who breaches/compels them) can build an IP→wallet map for 100% of users;
  also a single point of censorship/failure.
- **Solution:** (1) Document in the privacy policy (a named gate) that the default RPC sees IP+address, and add
  a **bring-your-own-RPC** field. (2) Add a viem `fallback()` multi-RPC array. (3) Prefer wallet-provided RPC
  for broadcast. No visual change.
- **Acceptance Criteria:**
  - [ ] viem `fallback()` with ≥2 providers; a BYO-RPC setting exists; privacy copy discloses the default-RPC linkage.
- **Evidence:** `web/lib/wagmi.ts:15-24`; `web/lib/env.ts:20`; `soft-floating-charm.md:180`
- **Effort:** S · **Depends on:** none

### 🟡 `agent-key-blast-radius` [gate]
- **Problem:** Single hot key from env (`index.ts:72`), sole `only_agent` signer, on a box that exposes unauth
  HTTP. If it leaks, the attacker *is* the agent: `agentRepayFor(user, amount)` can pull each protected user's
  **full** approved allowance into debt-repayment (the `min(allowance,balance)` cap lives only in agent code,
  `auto-repay.ts:122`, not in the vault). Vault bounds it to debt reduction (no value extraction), but a
  malicious key can force-spend allowances + grief timing. No documented rotation runbook; no on-chain cap.
- **Risk:** One leaked env var → protocol-wide forced-repay of every opted-in allowance + adversarial
  liquidation timing; only backstop is a manual `setAgent(zero)` someone has to notice.
- **Solution:** (1) Document a detection→rotation runbook tied to `setAgent`. (2) **Move the per-user + per-day
  cap on-chain** into `agent_repay_for` (a per-(user,day) ceiling) so a compromised *key* still can't drain a
  full allowance in one block (CLAUDE.md "caps on-chain when feasible"; blueprint §7). (3) Isolate the signing
  process from the public HTTP server.
- **Acceptance Criteria:**
  - [ ] `agent_repay_for` enforces a per-(user,day) on-chain ceiling (test: over-cap call reverts).
  - [ ] Signing process isolated from the public HTTP surface; a one-page key-rotation runbook exists.
- **Evidence:** `index.ts:72`; `auto-repay.ts:122`; `lib.rs:1019-1027,1041`; `soft-floating-charm.md:171,191`
- **Effort:** M (on-chain cap = redeploy batch) · **Depends on:** redeploy batch

### 🟡 `public-agent-page-exposes-operator-controls` [BLIND]
- **Problem:** `AgentConfigPanel` renders unconditionally on the public `/agent` page (`agent/page.tsx:61`),
  showing "Strategy notes / Alert when HF below / Poll interval / Save config / **Pause agent**" to any visitor.
  These POST to `/api/agent/config` which needs the server-only `AGENT_ADMIN_SECRET`, and are **global** settings.
  A normal user clicking Save/Pause gets a raw 503 (`config-panel.tsx:39`). `/admin` is gated by `env.adminAddress`
  (`shell.tsx:31`); `/agent` is not.
- **Risk:** Users think "Pause agent" is their kill switch (it's global), or hit a scary 503; it leaks that one
  global knob controls everyone's protection; looks broken; and it drowns the real per-user kill switch (the
  allowance/revoke).
- **Solution:** Gate `AgentConfigPanel` behind the same `isAdmin` check (or move to `/admin`). On public `/agent`
  keep only the read-only activity log + the user's own `AgentControls`. No new UI.
- **Acceptance Criteria:**
  - [ ] Operator controls are invisible to non-admin wallets; the public `/agent` shows only the activity log + per-user allowance control.
  - [ ] No visitor can reach a 503 dead-end from `/agent`.
- **Evidence:** `web/app/agent/page.tsx:61`; `agent-config-panel.tsx:50-71,144`; `api/agent/config/route.ts:31-35`; `shell.tsx:31-33`
- **Effort:** S · **Depends on:** none

### 🟡 `no-per-user-trigger-but-ui-implies-one` [gate]
- **Problem:** Alert band (`config.ts:11`) and protect target (`tick.ts:29`) are **global** constants applied to
  every user (`tick.ts:202-208`). But copy implies a personal trigger: landing "HF crossed **your** 1.10 trigger"
  (`page.tsx:95`), `AgentConfigPanel` "Alert when HF below" (`config-panel.tsx:98`).
- **Risk:** A user who "sets" 1.05 and is auto-repaid at 1.4 sees the agent apparently ignore their instructions —
  the worst impression for an autonomous money-mover; also overstates capability (CLAUDE.md "no fake flows").
- **Solution (MVP, on-brand):** Make copy honest — "Tessera's protection trigger (HF 1.10)"; frame the threshold
  as protocol-wide policy (admin-only per the prior finding). (Per-user triggers = a future scoped feature in
  agent SQLite if desired.)
- **Acceptance Criteria:**
  - [ ] No surface implies a user-chosen threshold; copy states the protocol-wide trigger.
- **Evidence:** `config.ts:11,25-32`; `tick.ts:29,202-208`; `page.tsx:95`; `agent-config-panel.tsx:98-110`
- **Effort:** S · **Depends on:** `public-agent-page-exposes-operator-controls`

### 🟡 `no-watching-confirmation` [gate]
- **Problem:** Enabling protection is just a USDC approval; success says only "Your protection setting is now
  live" (`agent-controls.tsx:54-63,130`). Whether the agent actually watches this wallet depends on indexer
  discovery / `AGENT_TRACKED_USERS`. The dashboard tile shows only a **global** heartbeat
  (`dashboard-client.tsx:195-214`) — no "I am protecting your $X position."
- **Risk:** The core emotional promise ("sleep through the weekend") needs the user to believe they're
  individually covered. A non-custodial allowance with no per-user "you're covered" feedback feels like shouting
  into the void → low trust at the scariest step.
- **Solution:** On `AgentControls` success + the dashboard tile, show a per-wallet summary from data already on
  hand: current allowance (cap), whether recent `/actions` reference this address (already fetched), "Watched
  since first deposit." Even "Protected · cap N USDC · agent last checked your position Xs ago" closes the loop.
- **Acceptance Criteria:**
  - [ ] The connected wallet sees a per-wallet "you are covered" state (cap + last-checked/last-action), not just a global heartbeat.
- **Evidence:** `agent-controls.tsx:54-63,127-132`; `dashboard-client.tsx:195-214`; `config.ts:67`; `tick.ts:147-152`
- **Effort:** S–M · **Depends on:** agent hosted (`moat-not-felt`)

### 🟡 `faucet-missing-from-borrow-journey` [gate]
- **Problem:** `/borrow` is the canonical guided journey (Deposit→Borrow→Protect) and the hero CTA points here
  (`page.tsx:368`), but Step 1 is `DepositForm` needing tokens the new user has zero of, and `FaucetButton` lives
  **only** in the dashboard's GetStarted card (`dashboard-client.tsx:167`).
- **Risk:** The headline conversion path dead-ends for every brand-new tester (and judge) at step one.
- **Solution:** Render the existing `FaucetButton` at the top of `/borrow` Step 1 (and/or a "Need test tokens?"
  affordance in `DepositForm` when balance is 0). It already self-hides on non-faucet networks — safe for
  mainnet. One-line placement.
- **Acceptance Criteria:**
  - [ ] A new wallet on `/borrow` can get test funds without leaving the page; the button self-hides on mainnet.
- **Evidence:** `web/app/borrow/page.tsx:22-44`; `deposit-form.tsx:43-49`; `dashboard-client.tsx:156-167`; `page.tsx:368`
- **Effort:** S · **Depends on:** none

### 🟡 `protection-activation-friction` [BLIND]
- **Problem:** Activating the moat is a raw ERC-20 `approve` of USDC to the vault as free-text with no default,
  no suggested cap, no tie to the user's debt (`agent-controls.tsx:54-63`). The Aave-migrator persona is trained
  to fear standing approvals; this is the highest-friction, lowest-trust moment in the funnel — and it's the
  differentiator.
- **Risk:** Borrowers complete deposit+borrow then **skip** protection → the whole value prop unused, the
  borrower exposed to the gap risk the product exists to solve, threatening the "zero bad debt" promise.
- **Solution (essential, on-brand, no redesign):** (1) Compute a suggested cap from live debt (e.g. `debt×1.25`),
  pre-fill it with a one-tap "recommended" chip. (2) Lead the copy with the bounded downside — "The agent can
  only ever REPAY your loan with this, never withdraw it; revoke anytime" (true per `lib.rs:1019-1027`). (3) Show
  the projected protected-HF outcome reusing the landing simulator math.
- **Acceptance Criteria:**
  - [ ] The approve step pre-fills a debt-derived recommended cap; copy leads with "can only repay, never withdraw, revoke anytime."
  - [ ] A projected "with this cap, a 15% gap is auto-repaid not liquidated" preview shows, reusing existing math.
- **Evidence:** `agent-controls.tsx:54-63,97-109`; `borrow/page.tsx:38-44`; `lib.rs:1019-1027`
- **Effort:** S–M · **Depends on:** `borrow-ltv-mislabels` (shares the simulator math)

### 🟡 `stylus-grant-credibility-leverage` [gate]
- **Problem:** Tessera has a rare asset — a real, deployed Stylus (Rust→WASM) lending vault + a solved
  Windows/no-admin toolchain — surfaced only as a one-line badge (`README.md:163-170`). The Arbitrum grant ask
  (blueprint §19 step 3) is framed generically.
- **Risk:** The strongest, least-copyable, **free** distribution lever (Arbitrum ecosystem amplification, Stylus
  showcase, grant funding that unlocks the audit gate → the only realistic mainnet path) is left on the table.
- **Solution (GTM/positioning, not new scope):** (1) One honest long-form "Building a real lending protocol in
  Stylus on Windows — gas math, the 24KB WASM limit, the toolchain" writeup (the repo has every detail). (2)
  Reframe the grant application around "canonical real-world-asset Stylus DeFi reference + a hardened
  cross-platform deploy recipe as a public good." Respects no-token/no-paid-acquisition.
- **Acceptance Criteria:**
  - [ ] A published engineering writeup exists; the grant application is reframed around the Stylus reference + toolchain public good.
- **Evidence:** `README.md:163-170`; `soft-floating-charm.md:386`; project memory (Windows Stylus recipe)
- **Effort:** M · **Depends on:** none

### 🟡 `retention-product-not-built` [gate]
- **Problem:** Blueprint §11 retention levers are unbuilt: earnings-since-deposit counter (lender), HF-history
  chart with agent interventions (borrower), earnings-calendar nudges. The dashboard is a point-in-time snapshot
  with nothing rewarding a return; the equity-DeFi UX moat (§4) is asserted on the landing but not delivered
  in-app.
- **Risk:** Deposit→forget; no engaged base for the build-in-public flywheel or issuer-partnership pitch
  (issuers want active users, not idle TVL); the specialization moat goes unfelt post-deposit.
- **Solution:** Ship the two cheapest, highest-signal levers from data already on hand: (1) earnings-since-deposit
  counter on the lender dashboard (`shares × convert_to_assets − cost basis` from the indexed Deposit event);
  (2) an HF-history sparkline on the borrower tile overlaying agent actions from the public JSONL (already
  fetched). Defer earnings-calendar. Additive components, on-brand (Tile + monospaced numerics).
- **Acceptance Criteria:**
  - [ ] Lender dashboard shows live earnings-since-deposit; borrower tile shows an HF-history sparkline with agent-action markers.
- **Evidence:** `soft-floating-charm.md:240-250`; `web/app/page.tsx:40-61`
- **Effort:** M · **Depends on:** agent hosted (for action overlay); `no-watching-confirmation` synergy

### 🟡 `stale-prd-positioning-drift` [gate]
- **Problem:** The public `PRD/PRD.md` ("source of truth") still lists "European Retail Stock Holder" as primary,
  70%/85% LTVs (§7.3), securities-lending framing, Robinhood Chain primary, and an "agent rebalances yield"
  feature that doesn't exist — all overridden by the blueprint. Blueprint §21 listed the exact edits; never made.
- **Risk:** For a "technically honest, docs-driven" project, a canonical doc that contradicts the live app +
  README is a self-inflicted credibility wound and confuses contributors/grant reviewers; it directly
  contradicts the build-in-public "why our LTVs are conservative" thread.
- **Solution:** Execute the blueprint §21 edits: §4 → Aave-migrator primary; §7.3 → conservative LTV/threshold
  ranges actually deployed; §1/§5 → USDC-yield-against-equities + auto-repay framing; delete/mark-V2 the unbuilt
  "yield rebalancer." Add a version bump + changelog line. Pure doc hygiene (CLAUDE.md documentation-driven).
- **Acceptance Criteria:**
  - [ ] PRD persona, LTV/threshold numbers, framing, and feature claims match the shipped product + README; version bumped with a changelog entry.
- **Evidence:** `PRD/PRD.md:50-54,193-202`; `soft-floating-charm.md:437-445`; `README.md:285-286`
- **Effort:** S · **Depends on:** none

---

# 🟢 NICE-TO-HAVE

### 🟢 `jsonl-public-log-and-config-hardening` [gate]
- **Problem:** `/actions` re-parses up to 7 days of files on every request, writes via non-atomic
  `appendFileSync` (`log/jsonl.ts:53-60,90-114`); `/config` calls the LLM per authed POST with no rate limit;
  `AGENT_ADMIN_SECRET` defaults to `'dev-admin-secret-change-me'` (`config.ts:60`).
- **Risk:** `/actions` is a cheap disk-walking DoS against the tick loop; a deploy that forgets to override the
  secret exposes config mutation (incl. `paused`) to anyone.
- **Solution:** Serve `/actions` from an in-memory ring buffer (last ~200), refreshing files as the durable
  record; rate-limit `/actions` + `/config`; make `AGENT_ADMIN_SECRET` have **no default** — fail-fast at boot
  in production (mirror the zero-`VAULT_ADDRESS` guard at `index.ts:43-52`).
- **Acceptance Criteria:**
  - [ ] `/actions` served from memory + rate-limited; production boot throws if `AGENT_ADMIN_SECRET` is unset/default.
- **Evidence:** `log/jsonl.ts:53-60,90-114`; `routes/actions.ts:9-18`; `config.ts:60`; `nl-config.ts:69-85`
- **Effort:** S · **Depends on:** pairs with `public-action-log-doxes-borrowers`

### 🟢 `faucet-sybil-no-allowlist` [gate]
- **Problem:** `Faucet.drip()` is gated only by a per-address cooldown (`Faucet.sol:54-66`); fresh EOAs are free
  on testnet, so it's trivially sybil-drained. The Faucet holds mint ownership of every mock.
- **Risk:** A sybil swarm mints unbounded test USDC/stock → inflates the apparent TVL/utilization that `/status`
  and `/transparency` read from chain, polluting the live demo right when judges evaluate; can also burn the
  agent's finite, publicly-visible float.
- **Solution:** Add a global per-window drip budget + a max-total-minted cap in the Faucet; optionally a cheap
  signed-nonce/session check to deter headless scripting. Document that faucet-inflated balances are excluded
  from any headline TVL figure. Testnet-only (no faucet on mainnet).
- **Acceptance Criteria:**
  - [ ] A global hourly drip cap + total-mint ceiling exist; a sybil loop hits the ceiling; headline TVL copy notes the testnet caveat.
- **Evidence:** `contracts/solidity/src/Faucet.sol:54-66,18-21`
- **Effort:** S · **Depends on:** none (separate Faucet redeploy)

### 🟢 `borrow-page-missing-repay-withdraw-exit` [gate]
- **Problem:** `RepayForm`/`WithdrawCollateralForm` render only on the dashboard when `hasPosition`
  (`dashboard-client.tsx:142-150`); `/borrow` (where users return to "manage my loan") offers only more
  deposit/borrow.
- **Risk:** The risk-reducing actions are harder to find than the risk-increasing ones — backwards for a
  safety-first protocol; adds friction under stress.
- **Solution:** Add a "Manage your position" link/section to `/borrow` when the wallet has debt (link to the
  dashboard manage section, or render the existing forms). Placement only.
- **Acceptance Criteria:**
  - [ ] A borrower with debt sees a repay/withdraw path from `/borrow`.
- **Evidence:** `dashboard-client.tsx:142-150`; `borrow/page.tsx:22-46`; `repay-form.tsx:23`; `withdraw-collateral-form.tsx:27`
- **Effort:** S · **Depends on:** none

---

## Recommended sprint sequence (so nothing is half-baked)

**Sprint 1 — Stop lying (credibility, mostly copy/placement, days):**
`protection-claims-vs-reality` (copy now, build cap+Telegram next) · `stale-prd-positioning-drift` ·
`borrow-ltv-mislabels-weighted-collateral` · `public-agent-page-exposes-operator-controls` ·
`no-per-user-trigger-but-ui-implies-one` · `agent-offline-everywhere` (honest copy) · `faucet-missing-from-borrow-journey`.

**Sprint 2 — One vault redeploy, all on-chain correctness:**
`max-ltv-not-enforced-on-borrow` · `total-assets-overstates-debt` · `no-chainlink-decimals-validation` ·
`first-depositor-inflation` · `reserve-factor-never-skimmed` · `liquidation-no-post-hf-check`+backstop hook ·
`debt-rounds-down` · `no-per-asset-pause` · `agent-key` on-chain per-day cap. → property tests → redeploy → re-export ABI.

**Sprint 3 — Make the agent trustworthy + visible:**
`no-receipt-no-nonce-management` · `idempotency-per-block` · `tracked-set-grows-unbounded` ·
`unbounded-watchlist-griefing`+`sequential-per-user-scan`+`non-atomic-reads` (multicall) → **host the agent** →
`moat-not-felt-agent-offline` → `no-watching-confirmation`.

**Sprint 4 — Privacy/abuse boundary + ops:**
`public-action-log-doxes-borrowers` · `metrics-leaks-agent-float` · `nl-config-prompt-injection` ·
`jsonl/config hardening` (+ no-default secret) · `protective-tx-mempool` · `single-rpc`/BYO-RPC ·
`no-incident-comms-on-call` · `no-analytics-no-funnel` · `faucet-sybil`.

**Sprint 5 — Activation, retention, GTM:**
`protection-activation-friction` · `retention-product` (earnings counter + HF history) ·
`borrow-page-missing-repay-withdraw-exit` · `stylus-grant-credibility-leverage`.

> After each sprint: run all four test suites (agent/web/Rust/Solidity), `typecheck`, and (Sprint 2/3) a fresh
> end-to-end on Sepolia before marking items done.

## Explicitly OUT of scope (per constraints)
No domain purchase · no demo video · no UI/brand redesign · no relitigating locked decisions (no token,
Aave-migrator persona, agent-only liquidation at MVP, 15% reserve factor, conservative LTVs, Chainlink-on-mainnet).
The named mainnet gates (independent audit, permissionless backstop, Immunefi bounty, insurance reserve,
legal/geo-block) remain as the blueprint defines them — several items above (`liquidation`+backstop hook,
`reserve-factor`, `agent-key` cap) deliberately *pre-wire* those gates so flipping them on later is a config
change, not a rewrite.
