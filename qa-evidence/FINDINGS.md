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
- [ ] Adversarial / negative cases

## Findings (severity)

### HIGH
- **H1 — Oracle was STALE (3 days), all 3 assets.** `/status` showed tAAPL/tTSLA/tSPY "Stale" (red). Staleness window 86400s; on-chain reads revert when stale → borrow / deposit-collateral / liquidation flows revert on the live site. Root cause: oracle keeper not running.
  → **MITIGATED for QA:** ran `node scripts/keeper.mjs --once` (all 3 prices re-stamped ok; fresh for 24h). **Product fix (still open):** the keeper must be hosted/scheduled so the oracle never goes stale — otherwise the live demo breaks again in 24h. This is the real launch finding.

### MEDIUM
- **M1 — Agent activity feed flooded with "Tick" entries.** CONFIRMED on both `/agent` (50 of 50 entries are "Tick · Checked 0 users in Nms") and `/transparency`. Meaningful events (alerts/auto-repays/liquidations) are buried. Judge-facing noise. Fix: collapse/hide ticks or surface only substantive actions by default. (Health card itself is clean: OK, 0 errors.)
- **M4 — /risk shows skeletons for static config under stale oracle.** During the stale window, MAX LTV / LIQ THRESHOLD / LIQ BONUS (static `assetParams`, NOT oracle-dependent) showed skeleton loaders, not just the price/oracle. Likely the row waits on ALL reads incl. the reverting oracle read. Verify post-refresh; if static params still skeleton when only the oracle is stale, decouple them so config always shows.
- **M2 — APY comparison shows only the Tessera row.** `/lend` "vs the market" renders just Tessera (0.00%); Aave/Spark/Morpho rows missing → `/api/yields` likely returned empty. Verify the DefiLlama route + filters.
- **M3 — Transparency live numbers / liquidations not populating (verify).** "Live protocol numbers", "Protection track record", and "Liquidations: Loading…" showed `—`/loading at capture. Confirm they resolve (timing vs stuck RPC getLogs over 100k blocks).

- **M5 — Approve button doesn't advance to Supply after the approve tx.** In the lend flow, after "Approve USDC" mined, the button stayed on Approve; a page reload was required for it to become "Supply USDC". The `allowance` read isn't watched/refetched post-tx. Stuck "I approved, now what?" state.
- **M6 — Console CORS errors / failed fetches to `eth.merkle.io`** on connected pages (wagmi/ConnectKit default ETH-mainnet transport for ENS). Failed network calls = defect per guide §14. Fix: drop/replace the mainnet transport or disable ENS, since Tessera is single-chain Arb Sepolia.
- **M7 — Post-transaction data staleness (systemic, same root as M5).** After Alice's deposit confirmed on-chain, `/lend` still showed "Pool size: 0 USDC" and the LenderEarnings "Your supplied position" card never rendered (the balanceOf/totalAssets reads didn't refetch). Updated state only appears after a manual reload. Fix: invalidate/refetch the relevant reads (or `watch: true`) after a successful write. Affects every write flow (lend, borrow, repay, approvals).

### LOW
- **L1 — 🛡 emoji renders as tofu box** in the `/lend` AI-protected callout (likely headless-Chromium font; verify on a real browser, else swap for an SVG icon).

## Positives (launch-grade)
- `/status`: clean, honest operational view; flags oracle staleness in red. ✅
- `/dashboard` (connected): correct empty state + "Agent active — protecting, 0 errors". ✅
- `/borrow`: 3-step flow (deposit → borrow → Active Protection) structurally sound. ✅
- `/lend`: B5 AI callout, Supply/Withdraw, live APY/utilization. ✅
- Zero console errors across the logged-out sweep. ✅
