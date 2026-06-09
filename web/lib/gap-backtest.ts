import { assessRegime, hfToNumber } from "./regime";

/**
 * Reproducible gap-loss backtest (scale #5). Runs a fixed set of modeled
 * overnight / weekend / earnings equity gaps through TWO strategies using the
 * SAME deterministic regime engine the live agent uses (web/lib/regime.ts):
 *
 *   - Tessera (regime-aware): when a position is at-risk for the current regime
 *     (HF < the regime-widened alert line), the agent restores HF to the
 *     regime-widened protect target BEFORE the gap, using the last-close price.
 *   - Baseline (threshold-only): a generic money market that only reacts once a
 *     position is already underwater (HF < 1.00) — i.e. after the gap.
 *
 * A gap then scales collateral value (and thus HF) by (1 − gap). We count how
 * many liquidations the regime-aware agent avoids. This is a MODELED result
 * (clearly labeled), not historical protocol performance — but it is falsifiable
 * and locked behind a CI guardrail (web/test/gap-backtest.test.ts) so the
 * headline number cannot silently rot. Reproduce: `pnpm --filter @tessera/web test gap-backtest`.
 */
export interface GapScenario {
  label: string;
  whenISO: string; // fixed representative instant → fully deterministic
  gapPct: number; // collateral price gap, 0.25 = −25%
  startHf: number; // borrower HF at the close before the gap
}

// A plausible spread: small gaps where protection isn't needed, mid/large
// off-hours + earnings gaps where it saves the position, and a severe gap that
// liquidates even a protected position (protection is not magic).
export const GAP_SCENARIOS: GapScenario[] = [
  { label: "AAPL · weekend −18%", whenISO: "2026-01-03T12:00:00Z", gapPct: 0.18, startHf: 1.25 },
  { label: "TSLA · weekend −28%", whenISO: "2026-01-03T12:00:00Z", gapPct: 0.28, startHf: 1.3 },
  { label: "SPY · weekend −9%", whenISO: "2026-01-03T12:00:00Z", gapPct: 0.09, startHf: 1.2 },
  { label: "AAPL · overnight −12%", whenISO: "2026-01-05T23:00:00Z", gapPct: 0.12, startHf: 1.18 },
  { label: "TSLA · overnight −22%", whenISO: "2026-01-05T23:00:00Z", gapPct: 0.22, startHf: 1.2 },
  { label: "TSLA · earnings −20%", whenISO: "2026-07-30T12:00:00Z", gapPct: 0.2, startHf: 1.3 },
  { label: "AAPL · earnings −10%", whenISO: "2026-07-30T12:00:00Z", gapPct: 0.1, startHf: 1.35 },
  { label: "SPY · crash open −33%", whenISO: "2026-01-03T12:00:00Z", gapPct: 0.33, startHf: 1.22 },
  { label: "TSLA · severe −45%", whenISO: "2026-01-03T12:00:00Z", gapPct: 0.45, startHf: 1.25 },
];

export interface ScenarioResult extends GapScenario {
  regimeLabel: string;
  acted: boolean;
  preHfProtected: number;
  postHfProtected: number;
  postHfBaseline: number;
  liqProtected: boolean;
  liqBaseline: boolean;
}

export interface BacktestResult {
  rows: ScenarioResult[];
  n: number;
  baselineLiquidations: number;
  protectedLiquidations: number;
  liquidationsAvoided: number;
  avoidedOfBaselinePct: number;
  avgBufferGain: number; // avg HF the agent enters the gap with, above the baseline
  headline: string;
}

function simulate(s: GapScenario): ScenarioResult {
  const reg = assessRegime(new Date(s.whenISO));
  const alert = hfToNumber(reg.alertThresholdHf);
  const protect = hfToNumber(reg.protectTargetHf);
  const acted = s.startHf < alert;
  const preProtected = acted ? protect : s.startHf; // restored to the protect target if at-risk
  const postHfProtected = preProtected * (1 - s.gapPct);
  const postHfBaseline = s.startHf * (1 - s.gapPct); // baseline took no pre-gap action
  return {
    ...s,
    regimeLabel: reg.label,
    acted,
    preHfProtected: preProtected,
    postHfProtected,
    postHfBaseline,
    liqProtected: postHfProtected < 1,
    liqBaseline: postHfBaseline < 1,
  };
}

export function runGapBacktest(): BacktestResult {
  const rows = GAP_SCENARIOS.map(simulate);
  const n = rows.length;
  const baselineLiquidations = rows.filter((r) => r.liqBaseline).length;
  const protectedLiquidations = rows.filter((r) => r.liqProtected).length;
  const liquidationsAvoided = rows.filter((r) => r.liqBaseline && !r.liqProtected).length;
  const avoidedOfBaselinePct = baselineLiquidations
    ? Math.round((liquidationsAvoided / baselineLiquidations) * 100)
    : 0;
  const avgBufferGain = rows.reduce((a, r) => a + (r.preHfProtected - r.startHf), 0) / n;
  const headline = `In ${n} modeled overnight / weekend / earnings gaps, regime-aware protection avoided liquidation in ${liquidationsAvoided} of the ${baselineLiquidations} cases that liquidated an unprotected position (${avoidedOfBaselinePct}%).`;
  return {
    rows,
    n,
    baselineLiquidations,
    protectedLiquidations,
    liquidationsAvoided,
    avoidedOfBaselinePct,
    avgBufferGain,
    headline,
  };
}
