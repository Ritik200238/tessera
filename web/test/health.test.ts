import { describe, expect, it } from "vitest";
import { classify, projectHealthFactor } from "@/lib/health";

const E18 = 1_000_000_000_000_000_000n;

describe("classify", () => {
  it("safe for HF >= 1.5e18", () => {
    expect(classify(2n * E18).tone).toBe("safe");
    expect(classify(1_500_000_000_000_000_000n).tone).toBe("safe");
  });
  it("healthy for 1.2 <= HF < 1.5", () => {
    expect(classify(1_499_999_999_999_999_999n).tone).toBe("healthy");
    expect(classify(1_200_000_000_000_000_000n).tone).toBe("healthy");
  });
  it("watch for 1.1 <= HF < 1.2", () => {
    expect(classify(1_199_999_999_999_999_999n).tone).toBe("watch");
    expect(classify(1_100_000_000_000_000_000n).tone).toBe("watch");
  });
  it("atrisk for 1.0 <= HF < 1.1", () => {
    expect(classify(1_099_999_999_999_999_999n).tone).toBe("atrisk");
    expect(classify(E18).tone).toBe("atrisk");
  });
  it("liquidating for HF < 1.0", () => {
    expect(classify(999_999_999_999_999_999n).tone).toBe("liquidating");
    expect(classify(0n).tone).toBe("liquidating");
  });
  it("emits non-empty copy and label for every tone", () => {
    for (const hf of [2n * E18, 13n * E18 / 10n, 115n * E18 / 100n, 105n * E18 / 100n, 95n * E18 / 100n]) {
      const c = classify(hf);
      expect(c.copy.length).toBeGreaterThan(0);
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(100);
    }
  });
});

describe("projectHealthFactor", () => {
  it("returns infinity when projected debt is zero", () => {
    const inf = 2n ** 256n - 1n;
    expect(
      projectHealthFactor({
        collateralValueUsd8: 100_00000000n,
        currentDebtUsd8: 0n,
        additionalBorrowUsd8: 0n,
      }),
    ).toBe(inf);
  });
  it("computes hf = collateral * 1e18 / debt", () => {
    // collateral $200, debt $100  -> HF = 2e18
    const hf = projectHealthFactor({
      collateralValueUsd8: 200_00000000n,
      currentDebtUsd8: 0n,
      additionalBorrowUsd8: 100_00000000n,
    });
    expect(hf).toBe(2n * E18);
  });
  it("includes additionalBorrow in the denominator", () => {
    // collateral $300, current $100 debt, additional $50 -> debt=$150 -> hf=2e18
    const hf = projectHealthFactor({
      collateralValueUsd8: 300_00000000n,
      currentDebtUsd8: 100_00000000n,
      additionalBorrowUsd8: 50_00000000n,
    });
    expect(hf).toBe(2n * E18);
  });
});
