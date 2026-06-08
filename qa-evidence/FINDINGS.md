# Tessera — Autonomous QA Findings

Live site: https://tessera-web-delta.vercel.app · local dev used for wallet flows.
Personas (injected real-key, Arb Sepolia): Alice=lender, Bob=borrower, Carol=edge.

## Coverage log
- [x] Logged-out visual sweep: 9 routes × desktop + mobile (18 screenshots) — `qa-evidence/{desktop,mobile}/`
- [x] **0 console/page errors** on all 18 logged-out page-loads (`console-errors.json`)
- [x] Harness proven: Alice auto-connects (real address in header, dashboard connected state)
- [x] Oracle refreshed via keeper --once (fresh 24h) — wallet flows unblocked
- [x] Desktop audit COMPLETE (9/9): home, lend, borrow, dashboard, transparency, status, risk, security, agent
- [!] NOTE: the sweep ran BEFORE the keeper refresh, so read-heavy pages (risk, transparency numbers, lend APY/util, dashboard stats) captured a DEGRADED stale-oracle state (skeletons / "—"). RE-CAPTURE these post-refresh next iteration to confirm healthy state.
- [x] Mobile audit (375×812): LAUNCH-GRADE. Verified home + borrow at readable viewport scale (header fits, hero readable, CTAs stacked w/ big tap targets, 3-step form stacks cleanly, asset buttons tappable, scrollable mobile nav works, no h-overflow). DOM check: landing = 10 populated sections (12.9 screens, long but content-full — NOT blank). LESSON: fullPage mobile thumbnails compress to illegibility; use viewport captures. Evidence: mobile/home-viewport.png, mobile/borrow-viewport.png
- [ ] Re-capture read-heavy pages post-oracle-refresh (risk/transparency/lend/dashboard)
- [x] Wallet flow — LEND (Alice): supplied 2,500 USDC end-to-end (real approve+deposit). On-chain verified: shares 2.5e15, totalAssets 2,500 USDC. Evidence: flows/lend-0*.png
- [x] Wallet flow — BORROW (Bob): deposited 10 tAAPL → borrowed 600 USDC @ 30% LTV. On-chain: debt 600 USDC, collateral 10 tAAPL, HF 2.17, vault idle 1,900 (= Alice 2,500 − 600). **Multi-user linkage proven.** A7 liq-price correct: tAAPL $92.31 from $200 (~54% drop). Evidence: flows/borrow-0*.png
- [x] Wallet flow — ACTIVE PROTECTION (Bob): enabled (approved 750 USDC cap) → ProtectionPreview B2 correct (30% drop → HF 1.52, no repay needed) → kill switch revoked (allowance → 0 on-chain). B2 + B6 verified. Evidence: flows/prot-0*.png
- [~] Wallet flow — AI AUTO-REPAY (#40) ARMED + polling (bg task bjxxi8d72): Bob re-granted 750 USDC allowance, tAAPL oracle dropped $200→$110, Bob HF 1.19 (auto-repay zone), debt 600. Agent health: ok, **usersTracked=1 (Bob tracked)**. WAITING for the hosted agent to auto-repay (debt drops < 600).
- [x] **AI AUTO-REPAY PROVEN LIVE (the marquee).** At HF 1.19 the agent (correctly) did nothing (above the ~1.1 alert band). Dropped tAAPL to $97 → HF 1.05 → the hosted agent autonomously **auto-repaid ~149.6 USDC** from Bob's pre-approved cap (tx 0x793694ee…, status confirmed), restoring HF to **exactly 1.3999 ≈ 1.40** (C1 regime-aware protect target, market-open). C2 decision record on the feed: *"market open: HF 1.05 is below the 1.40 protect target — repaying ~150 USDC from your approved cap to restore it."* + an LLM at-risk alert. Oracle restored to $200, Bob HF back to 2.89. **C1 + C2 + Active Protection end-to-end verified on real chain.**
- [x] Wallet flow — REPAY + WITHDRAW (Bob): repaid 200 (debt 450→250), withdrew 2 tAAPL (collateral 10→8, HF-safety allowed). On-chain verified. Repay/withdraw forms invalidate queries → fresh (no M7). Evidence: flows/manage-0*.png
- [x] Wallet flow — FAUCET (Carol): "Get test funds" → USDC 100k→110k (+10k drip). On-chain verified. Evidence: flows/faucet-0*.png
- [x] ALL WALLET FLOWS COVERED: lend · borrow · protection · AI auto-repay · repay · withdraw · faucet — every one on-chain verified.

### Notes on the auto-repay trigger (design, not defect)
- The agent's at-risk gate is the ALERT threshold (~1.1), not the 1.4 protect target. The 1.4 only SIZES the repay (restore-to level). So auto-repay fires when HF < ~1.1 and restores toward 1.4. ⚠️ **M8 — ProtectionPreview (B2) mismatch:** B2 shows "agent repays" whenever HF < 1.4, but the agent only acts below ~1.1. For 1.1 < HF < 1.4, B2 implies an action the agent won't take. UI-vs-reality gap — align B2's threshold to the alert band (or clarify "acts when you enter the alert zone").
- **L2 — rounded repay display understates:** the feed's `repay` is rounded to nearest 100 USDC (privacy), so a ~149.6 repay shows as "100" while the rationale says "~150". Mismatch; round to nearest 10, or show the rationale value.
- [x] Adversarial: (1) withdraw > pool liquidity → BLOCKED client-side (clean alert + disabled btn). (2) withdraw all collateral with open debt → reverts gracefully (no crash; body not humanized → M9). Found + FIXED the H2 LenderEarnings crash during this. (3) A5 history verified: shows the full lifecycle incl. the agent auto-repay. Evidence: flows/adv-0*.png

## Findings (severity)

### HIGH
- **H1 — Oracle was STALE (3 days), all 3 assets.** `/status` showed tAAPL/tTSLA/tSPY "Stale" (red). Staleness window 86400s; on-chain reads revert when stale → borrow / deposit-collateral / liquidation flows revert on the live site. Root cause: oracle keeper not running.
  → **MITIGATED for QA:** ran `node scripts/keeper.mjs --once` (all 3 prices re-stamped ok; fresh for 24h). **Product fix (still open):** the keeper must be hosted/scheduled so the oracle never goes stale — otherwise the live demo breaks again in 24h. This is the real launch finding.

- **H2 — LenderEarnings (A4) crashed the /lend page for any lender with a position. FIXED.** `supplyRateBps` decodes as a JS number (small uint), and `value (bigint) * supplyBps (number)` threw "Cannot mix BigInt and other types" → Next runtime-error overlay on /lend for the PRIMARY persona. Masked earlier because the shares read was stale (0 → early return); surfaced once a real position loaded. Fix: coerce `supplyBps` to bigint (`BigInt(result ?? 0)`). tsc green; re-ran the flow — /lend renders LenderEarnings, no crash. Grep found no sibling unguarded bigint×rate multiplies.

### MEDIUM
- **M1 — Agent activity feed flooded with "Tick" entries.** CONFIRMED on both `/agent` (50 of 50 entries are "Tick · Checked 0 users in Nms") and `/transparency`. Meaningful events (alerts/auto-repays/liquidations) are buried. Judge-facing noise. Fix: collapse/hide ticks or surface only substantive actions by default. (Health card itself is clean: OK, 0 errors.)
- **M4 — /risk shows skeletons for static config under stale oracle.** During the stale window, MAX LTV / LIQ THRESHOLD / LIQ BONUS (static `assetParams`, NOT oracle-dependent) showed skeleton loaders, not just the price/oracle. Likely the row waits on ALL reads incl. the reverting oracle read. Verify post-refresh; if static params still skeleton when only the oracle is stale, decouple them so config always shows.
- **M2 — APY comparison shows only the Tessera row.** `/lend` "vs the market" renders just Tessera (0.00%); Aave/Spark/Morpho rows missing → `/api/yields` likely returned empty. Verify the DefiLlama route + filters.
- **M3/M4 — RESOLVED (transient, stale-oracle fallout, NOT code defects).** Re-captured /risk + dashboard with the oracle fresh: /risk fully populates (tAAPL $200 LTV50/liq65/bonus5, tTSLA $250 40/55/5, tSPY $500 60/75/5, oracle dots green/fresh); dashboard shows live APY 0.25% + utilization 10.01% + position + history. The earlier skeletons/"—" were purely because the sweep ran during the stale window → reinforces H1 (keep the keeper running). Sub-point still worth a fix: under a stale oracle, /risk skeletons even the STATIC params (LTV/threshold/bonus) — decouple them so config shows regardless of price freshness.

- **M5 — Approve button doesn't advance to Supply after the approve tx.** In the lend flow, after "Approve USDC" mined, the button stayed on Approve; a page reload was required for it to become "Supply USDC". The `allowance` read isn't watched/refetched post-tx. Stuck "I approved, now what?" state.
- **M6 — Console CORS errors / failed fetches to `eth.merkle.io`** on connected pages (wagmi/ConnectKit default ETH-mainnet transport for ENS). Failed network calls = defect per guide §14. Fix: drop/replace the mainnet transport or disable ENS, since Tessera is single-chain Arb Sepolia.
- **M7 — Post-transaction data staleness (systemic, same root as M5).** After Alice's deposit confirmed on-chain, `/lend` still showed "Pool size: 0 USDC" and the LenderEarnings "Your supplied position" card never rendered (the balanceOf/totalAssets reads didn't refetch). Updated state only appears after a manual reload. Fix: invalidate/refetch the relevant reads (or `watch: true`) after a successful write. Affects every write flow (lend, borrow, repay, approvals).

- **M9 — withdraw-breaks-HF revert not humanized.** Withdrawing all collateral with open debt correctly reverts (no crash, caught), but the error BODY is a verbose viem dump ("Execution reverted… Request Arguments… Details…") rather than a friendly line. Title "Transaction failed" is clean; map this revert in decodeTxError to e.g. "This withdrawal would put your loan at risk — withdraw less."

### LOW
- **L1 — 🛡 emoji renders as tofu box** in the `/lend` AI-protected callout (likely headless-Chromium font; verify on a real browser, else swap for an SVG icon).

## Positives (launch-grade)
- `/status`: clean, honest operational view; flags oracle staleness in red. ✅
- `/dashboard` (connected): correct states + "Agent active — protecting, 0 errors" + A5 history. ✅
- `/borrow`: 3-step flow + A7 liq-price ($92.31 from $200, verified) + projected HF. ✅
- `/lend`: B5 AI callout, Supply/Withdraw, live APY/utilization (+ LenderEarnings after H2 fix). ✅
- `/risk`: full per-asset params + live oracle freshness (fresh). ✅
- `/security`: complete trust model + honest FAQ + mainnet gates. ✅
- Zero console errors across the logged-out sweep. ✅
- Mobile (home + borrow) launch-grade. ✅

---

# FINAL REPORT — Tessera full-product QA

**Method:** real Chromium + Playwright, three injected real-key wallets (Alice/Bob/Carol)
driving the real ConnectKit UI → REAL Arbitrum Sepolia txs, every state-changing claim
verified on-chain. Single chain (Arb Sepolia). Loop-driven, autonomous.

## Coverage matrix
| Area | Status |
|---|---|
| Pages desktop (9) | ✅ all audited |
| Pages mobile | ✅ home + borrow viewport-verified; rest fullPage; DOM-checked |
| Logged-out / empty states | ✅ 0 console errors on 18 loads |
| Connect (auto-connect) | ✅ |
| Faucet | ✅ Carol +10k USDC on-chain |
| Lend (supply) | ✅ Alice 2,500 USDC, shares on-chain |
| Borrow (deposit + borrow) | ✅ Bob 600 vs 10 tAAPL, HF 2.17; multi-user (Alice→Bob) |
| Repay | ✅ −200, debt 450→250 on-chain |
| Withdraw collateral | ✅ −2 tAAPL, HF-safety enforced |
| Active Protection (B6) + Preview (B2) | ✅ enable→preview→revoke, allowance→0 |
| **AI auto-repay (C1+C2)** | ✅ agent auto-repaid ~150 USDC, HF→1.40, on-chain decision record |
| Adversarial (liquidity guard, graceful revert) | ✅ |
| A5 history / A7 liq-price | ✅ verified |

## Verdict
**Strong testnet build; core thesis proven end-to-end.** The differentiator (AI
auto-repay with an explainable on-chain decision record) works autonomously under
real conditions. One launch-blocker was found AND FIXED here (H2 LenderEarnings crash).

**Before calling it launch-grade, fix:**
1. **H1** — host/schedule the oracle keeper (else the live demo breaks every 24h; borrow/deposit revert on a stale price).
2. **M7/M5** — refetch reads after writes (lend/deposit show stale pool size / no position / stuck Approve button until reload). Systemic.
3. **M8** — align ProtectionPreview's threshold to the real auto-repay trigger (acts <~1.1 alert band, not <1.4).
4. **M1** — de-noise the agent feed (collapse "Tick" heartbeats).
5. **M2** — APY-vs-market showed only the Tessera row (verify /api/yields on prod).
6. **M6 / M9 / L1/L2** — drop the mainnet ENS transport (eth.merkle CORS); humanize the withdraw-HF revert; SVG instead of 🛡 emoji; round repay display finer.

Nothing in the smart-contract layer or the autonomous agent misbehaved on-chain.
The fixes above are all frontend polish + ops (keeper hosting) — none are protocol bugs.
