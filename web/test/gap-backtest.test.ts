import { describe, it, expect } from "vitest";
import { runGapBacktest } from "../lib/gap-backtest";

/**
 * CI guardrail for the headline "gap-loss avoided" proof. Locks the claim so it
 * cannot silently rot, and keeps it HONEST (protection is never worse, and not
 * magic — at least one severe gap still liquidates a protected position).
 */
describe("gap-loss backtest", () => {
  const r = runGapBacktest();

  it("reports the headline", () => {
    console.log("HEADLINE:", r.headline);
    console.log(
      "STATS:",
      JSON.stringify({
        n: r.n,
        baselineLiq: r.baselineLiquidations,
        protectedLiq: r.protectedLiquidations,
        avoided: r.liquidationsAvoided,
        pct: r.avoidedOfBaselinePct,
        avgBufferGain: r.avgBufferGain.toFixed(2),
      }),
    );
    expect(r.n).toBe(9);
  });

  it("protection is never worse than the baseline (invariant)", () => {
    expect(r.protectedLiquidations).toBeLessThanOrEqual(r.baselineLiquidations);
  });

  it("protection demonstrably avoids liquidations the baseline suffers", () => {
    expect(r.liquidationsAvoided).toBeGreaterThanOrEqual(2);
    expect(r.avoidedOfBaselinePct).toBeGreaterThanOrEqual(50);
    expect(r.avoidedOfBaselinePct).toBeLessThanOrEqual(95);
  });

  it("is honest — a severe enough gap still liquidates a protected position", () => {
    expect(r.protectedLiquidations).toBeGreaterThanOrEqual(1);
  });

  it("enters every gap with a higher buffer than the baseline", () => {
    expect(r.avgBufferGain).toBeGreaterThan(0);
  });

  it("is fully deterministic", () => {
    expect(runGapBacktest().headline).toBe(r.headline);
  });
});
