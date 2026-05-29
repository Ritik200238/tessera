import { safetyScore } from "./format";

/**
 * Health-factor classification — TDD §5.3.
 *
 * `tone` keys map 1:1 to the design tokens declared in `app/globals.css`
 * and to the icon set used by <HealthBadge/>. This module is the single
 * source of truth for the mapping; UI components must not duplicate it.
 */

export type HealthTone = "safe" | "healthy" | "watch" | "atrisk" | "liquidating";

export interface HealthClassification {
  tone: HealthTone;
  label: string;
  copy: string;
  score: number;
}

const ONE_E18 = 1_000_000_000_000_000_000n;
const ONE_POINT_ONE_E18 = 1_100_000_000_000_000_000n;
const ONE_POINT_TWO_E18 = 1_200_000_000_000_000_000n;
const ONE_POINT_FIVE_E18 = 1_500_000_000_000_000_000n;

export function classify(hf: bigint): HealthClassification {
  const score = safetyScore(hf);
  if (hf >= ONE_POINT_FIVE_E18) {
    return {
      tone: "safe",
      label: "Safe",
      copy: "Tessera is watching. No action needed.",
      score,
    };
  }
  if (hf >= ONE_POINT_TWO_E18) {
    return {
      tone: "healthy",
      label: "Healthy",
      copy: "Comfortable buffer.",
      score,
    };
  }
  if (hf >= ONE_POINT_ONE_E18) {
    return {
      tone: "watch",
      label: "Watch",
      copy: "Markets are moving — Tessera is monitoring closely.",
      score,
    };
  }
  if (hf >= ONE_E18) {
    return {
      tone: "atrisk",
      label: "At risk",
      copy: "Add collateral or repay to avoid liquidation.",
      score,
    };
  }
  return {
    tone: "liquidating",
    label: "Liquidating",
    copy: "Tessera is closing this position to protect you.",
    score,
  };
}

/**
 * Project the post-borrow health factor purely client-side, used by the
 * `/borrow` slider preview before submitting the transaction.
 *
 *   hf = collateralValueUsd8 * 1e18 / debtUsd8
 *
 * `collateralValueUsd8` and `debtUsd8` are 1e8-scaled USD values (oracle
 * scale). Returns `2^256 - 1` when the projected debt is zero.
 */
export function projectHealthFactor(params: {
  collateralValueUsd8: bigint;
  currentDebtUsd8: bigint;
  additionalBorrowUsd8: bigint;
}): bigint {
  const debt = params.currentDebtUsd8 + params.additionalBorrowUsd8;
  if (debt <= 0n) return 2n ** 256n - 1n;
  return (params.collateralValueUsd8 * ONE_E18) / debt;
}
