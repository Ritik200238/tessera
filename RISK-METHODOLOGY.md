# Tessera Risk Methodology

**Purpose:** turn *"we picked 40%"* into *"here is the model that produces 40%, and the process that changes it."* This is the published risk framework behind the Rulebook (the on-chain vault). It is honest about what is derived versus what is a conservative v1 estimate pending more data.

Companion to `rulbookImprvmnts.md` (the engineering plan) and `TDD/`. Parameters described here are enforced in `contracts/crates/vault` and the pure-math `interest-model` crate.

---

## 1. The core risk: overnight/weekend gaps on tokenized equities

A tokenized stock trades 24/7, but the underlying equity market is closed nights, weekends, and holidays. So the price **gaps** — it jumps discontinuously when the market reopens or on off-hours news. Every parameter below exists to keep the protocol solvent across those gaps, with the AI agent handling the part static parameters cannot.

Two layers, deliberately:
- **Static buffer (this document):** sized so the protocol survives a *typical-to-severe* gap on its own.
- **Active layer (the agent):** regime-aware early action that widens protection ahead of *known* gap windows. The static buffer is the floor; the agent is the margin on top. Neither alone is the whole answer, and we never claim a static number survives every tail event — that is what the insolvency waterfall (§6) is for.

---

## 2. LTV and liquidation threshold — the derivation

For each asset we set two numbers: **max LTV** (the most you can borrow) and the **liquidation threshold** (the debt/collateral ratio that triggers liquidation). The gap between them is the safety buffer.

**The model:**
1. Build the asset's empirical distribution of **adverse close-to-open gaps** — overnight, Friday→Monday, and earnings-day — over a multi-year window.
2. Set the **liquidation threshold** so that a position opened at max LTV survives a gap at the **99th percentile** of that distribution before becoming liquidatable. Formally, for a max-LTV borrower the tolerated drop before liquidation is `1 − LTV/threshold`; we require that ≥ the 99th-percentile adverse gap.
3. Set **max LTV** below the threshold by a margin that gives the agent a realistic window to act between "at risk" and "liquidatable" (the regime bands in §4).
4. **Scale the buffer to volatility, not just the level:** a more volatile asset gets a *wider* buffer, not merely a lower LTV.

**Current parameters (conservative v1):**

| Asset | Max LTV | Liq threshold | Buffer | Drop tolerated at max LTV |
|---|---|---|---|---|
| tTSLA | 40% | 55% | 15pp | ~27% |
| tAAPL | 50% | 65% | 15pp | ~23% |
| tSPY | 60% | 75% | 15pp | ~20% |

**Honest status:** these are deliberately conservative round numbers, directionally correct (the most volatile name, TSLA, gets the lowest LTV and the largest drop-tolerance). They are **not yet fully data-derived** — the v1.1 task is to replace them with values produced by step 2 above against real gap data for each name, and to scale the *buffer width* (currently a uniform 15pp) to each asset's volatility. SPY can likely support a higher LTV; the buffer-width uniformity is the known gap. Until then we err conservative on purpose.

---

## 3. Close factor & the full-close path

- **Close factor: 50%.** A single liquidation may repay at most half the debt, so a healthy-ish position is never wiped in one shot.
- **Full-close (HF < 0.95):** below 0.95 a position is non-viable; the close factor lifts to 100% so a liquidator can wind it down in one transaction instead of the 50% cap freezing bad debt. The post-state guard still blocks a skim-and-leave (it requires the debt fully repaid *or* the collateral fully seized).

## 4. Agent regime bands (the active layer)

The agent acts before the static buffer is tested:
- It restores an at-risk position to **HF 1.4** (a comfortable margin above the 1.1 alert line).
- It widens these bands automatically for after-hours, weekends, and earnings — the windows where gaps happen.
- The agent's decision is deterministic; an LLM only writes the human-readable explanation. The agent can only *reduce* debt, from USDC the user pre-approved.

Limit, stated plainly: a reactive agent cannot beat an *instantaneous* gap straight through the liquidation line. For that, see the waterfall (§6).

---

## 5. Liquidation incentive — depth-based Dutch auction

A flat bonus assumes a liquid market to dump seized collateral into; tokenized equities may not have one. So the bonus **ramps with depth**:
- The per-asset bonus (currently 5%) is the **floor**.
- It increases linearly as health falls, reaching **15%** (`MAX_LIQ_BONUS_BPS`) at HF 0.90.
- Pure function of the health factor the vault already reads — no griefable "mark underwater" transaction, no extra storage.

Effect: there is no collateral price at which liquidation is permanently unprofitable; the deeper a position sinks, the more a liquidator earns to clear it.

---

## 6. Solvency: reserve factor and the insolvency waterfall

The single most important question in lending — *what happens when the buffer fails* — has an explicit, on-chain, visible answer.

- **Reserve factor: 15%.** 15% of all interest accrues to an on-chain reserve (first-loss capital + protocol revenue); lenders earn the other 85% via the share price. Bounded ≤ 25%.
- **The waterfall:** when an underwater position is wound down and debt remains after all collateral is seized:
  1. the **reserve absorbs** the loss first (up to its balance);
  2. only the **uncovered remainder socializes** pro-rata to lenders, recorded in `bad_debt`;
  3. one `BadDebtAbsorbed` event makes it visible — never a silent share-price poison.

## 7. Concentration & liquidity limits

- **Per-asset supply caps** bound how much of a single (correlated) equity collateral the shared pool holds.
- **Global borrow cap** bounds total protocol exposure.
- **Min-debt floor (100 USDC):** no dust positions whose liquidation costs more than the bonus.
- **Bank-run buffer:** a borrow may not push utilization above **95%**, so an idle buffer always remains for lender withdrawals.

## 8. Oracle policy

Pricing is the existential risk for RWA lending (thin 24/7 feeds, closed-market hours). The policy is being externalized into a dedicated **PriceGuard** router (rulbookImprvmnts.md Phase 5): primary feed + staleness window + dual-feed deviation guard + TWAP sanity band + a **market-hours haircut** (new borrows are restricted/haircut while the underlying market is closed) + a **circuit breaker** that pauses *new risk* (never repay/liquidate) when the feed is unreliable. Principle: *you can always make yourself safer; you can never add risk on a price we can't defend.*

## 9. Corporate actions (policy — Phase 6.7)

Tokenized equities undergo splits, dividends, mergers, and trading halts. v1 policy (documented runbook, not yet automated):
- **Splits/reverse-splits:** handled via a governed freeze → re-list-with-adjusted-feed runbook. Asset **decimals are immutable once listed** (changing them would mis-account every holder), so a split is modeled through the price feed and risk params, never the decimals field.
- **Dividends** accruing to vault-held collateral accrue to the protocol reserve (documented; a holder-pass-through is a later refinement).
- **Trading halts:** the guardian (or the PriceGuard deviation breach, automatically) sets the asset's risk state to halted, blocking new risk while repay/liquidate stay open.
- **Delisting/issuer freeze:** per-issuer due diligence at listing; a freeze on a collateral token is detected via transfer failure and the asset is frozen by the guardian. This is a known RWA-specific risk that crypto-native protocols do not face.

## 10. Multi-collateral liquidation ordering (policy — Phase 6.3)

The vault liquidates one collateral token per call (keeps the contract small and the math simple). When a borrower holds multiple collaterals, the liquidator chooses the order; the agent's off-chain policy is **most-liquid-first** (sell the easiest-to-offload collateral first to minimize slippage and maximize the chance bad debt is cleared before it socializes). Absorption (§6) only fires once the borrower's *last* collateral is exhausted.

---

## 11. Governance of these parameters

- **Who changes them:** the contract owner — which at mainnet is an OpenZeppelin `TimelockController` controlled by a multisig (rulbookImprvmnts.md Phase 3). No parameter changes instantly.
- **The public window:** every critical change (oracle, agent, LTV/threshold, caps, reserve factor, min-debt) is queued behind a **24-hour timelock**, visible on-chain before it takes effect, so users can exit a change they disagree with. The only instant power is `pause`, held by a guardian whose sole ability is to pause.
- **The basis:** parameter changes should cite this methodology — the gap-distribution model, the percentile target, and the volatility scaling — not ad-hoc judgment. "The founder picked a number" is not an acceptable basis for a protocol holding real money.

---

## 12. Honest limitations

1. Parameters in §2 are a conservative v1, not yet fully data-derived. Tracked as the top open item.
2. A robust, manipulation-resistant on-chain price feed for tokenized equities is partner-dependent (PriceGuard provides the *policy*; the *feed quality* depends on a Chainlink/Pyth-grade provider on the canonical chain).
3. Issuer/custodial risk (freeze, de-peg, seizure) is mitigated by due diligence + circuit breakers, not eliminated.
4. No third-party audit yet — a hard mainnet gate.

We would rather state these plainly than imply a completeness we do not have. The point of this document is that every parameter has a *reason*, and every change has a *process*.

---

*Maintained alongside the contract. Update in the same change as any risk-parameter or policy change.*
