/**
 * Pure-function health-factor classifier + Safety Score.
 * Mirrors TDD §5.3 and §4.6. No I/O — fully unit-testable.
 */

import type { AlertLevel, HealthClassification } from "../types.js";

const ONE_E18 = 1_000_000_000_000_000_000n;
const ONE_POINT_ONE = 1_100_000_000_000_000_000n;
const ONE_POINT_TWO = 1_200_000_000_000_000_000n;
const ONE_POINT_FIVE = 1_500_000_000_000_000_000n;
const TWO_E18 = 2_000_000_000_000_000_000n;

/**
 * Classify a 1e18-scaled health factor into a TDD §5.3 band.
 *
 *   HF >= 1.5e18              -> "safe"
 *   1.2e18 <= HF < 1.5e18     -> "healthy"
 *   1.1e18 <= HF < 1.2e18     -> "watch"
 *   1.0e18 <= HF < 1.1e18     -> "at-risk"
 *   HF < 1.0e18               -> "liquidating"
 */
export function classifyLevel(hf: bigint): AlertLevel {
  if (hf >= ONE_POINT_FIVE) return "safe";
  if (hf >= ONE_POINT_TWO) return "healthy";
  if (hf >= ONE_POINT_ONE) return "watch";
  if (hf >= ONE_E18) return "at-risk";
  return "liquidating";
}

/**
 * Portfolio Safety Score 0-100 (TDD §5.3):
 *   score = clamp(round(min(hf/2e18, 1) * 100), 0, 100)
 *
 * Uses fixed-point arithmetic on bigints to avoid Number precision loss
 * for HF values near U256::MAX.
 */
export function safetyScore(hf: bigint): number {
  if (hf <= 0n) return 0;
  if (hf >= TWO_E18) return 100;
  // multiply first to keep precision: floor((hf * 100) / 2e18), then round.
  // We want round-half-up: (hf * 200 + 2e18) / (4e18)  ≡  round(hf*100/2e18)
  const numerator = hf * 200n + TWO_E18;
  const score = Number(numerator / (TWO_E18 * 2n));
  if (score < 0) return 0;
  if (score > 100) return 100;
  return score;
}

/** Convenience: full classification in one call. */
export function classify(hf: bigint): HealthClassification {
  return { hf, level: classifyLevel(hf), score: safetyScore(hf) };
}
