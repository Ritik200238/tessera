import { describe, it, expect } from "vitest";
import { safetyScore } from "../src/strategy/health-classifier.js";

const E18 = 1_000_000_000_000_000_000n;

describe("safetyScore boundary values", () => {
  const cases: Array<[bigint, number]> = [
    [0n, 0],
    [1n, 0],
    [E18 - 1n, 50],
    [E18, 50],
    [E18 + 1n, 50],
    [2n * E18 - 1n, 100],
    [2n * E18, 100],
    [2n * E18 + 1n, 100],
    [(2n ** 256n) - 1n, 100],
  ];
  for (const [hf, expected] of cases) {
    it(`HF=${hf.toString()} → ${expected}`, () => {
      expect(safetyScore(hf)).toBe(expected);
    });
  }
});
