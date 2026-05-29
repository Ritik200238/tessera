import { describe, it, expect } from "vitest";
import { classify, classifyLevel, safetyScore } from "../src/strategy/health-classifier.js";

const E18 = 1_000_000_000_000_000_000n;

describe("classifyLevel", () => {
  it("HF=2e18 → safe", () => {
    expect(classifyLevel(2n * E18)).toBe("safe");
  });
  it("HF=1.5e18 boundary → safe", () => {
    expect(classifyLevel(1_500_000_000_000_000_000n)).toBe("safe");
  });
  it("HF=1.49e18 → healthy", () => {
    expect(classifyLevel(1_490_000_000_000_000_000n)).toBe("healthy");
  });
  it("HF=1.1e18 → watch", () => {
    expect(classifyLevel(1_100_000_000_000_000_000n)).toBe("watch");
  });
  it("HF=1.05e18 → at-risk", () => {
    expect(classifyLevel(1_050_000_000_000_000_000n)).toBe("at-risk");
  });
  it("HF=0.9e18 → liquidating", () => {
    expect(classifyLevel(900_000_000_000_000_000n)).toBe("liquidating");
  });
});

describe("safetyScore", () => {
  it("HF=2e18 → 100", () => expect(safetyScore(2n * E18)).toBe(100));
  it("HF=0 → 0", () => expect(safetyScore(0n)).toBe(0));
  it("HF=1e18 → 50", () => expect(safetyScore(E18)).toBe(50));
  it("HF=1.5e18 → 75", () => expect(safetyScore(1_500_000_000_000_000_000n)).toBe(75));
  it("HF=1.2e18 → 60", () => expect(safetyScore(1_200_000_000_000_000_000n)).toBe(60));
  it("HF > 2e18 clamps to 100", () => {
    const huge = (2n ** 256n - 1n);
    expect(safetyScore(huge)).toBe(100);
  });
  it("HF=1e18-1 → 50 (rounds)", () => {
    expect(safetyScore(E18 - 1n)).toBe(50);
  });
  it("HF=1e18+1 → 50 (rounds)", () => {
    expect(safetyScore(E18 + 1n)).toBe(50);
  });
  it("HF=2e18-1 → 100 (rounds to boundary)", () => {
    expect(safetyScore(2n * E18 - 1n)).toBe(100);
  });
});

describe("classify (combined)", () => {
  it("HF=2e18 → safe + score 100", () => {
    const c = classify(2n * E18);
    expect(c.level).toBe("safe");
    expect(c.score).toBe(100);
  });
  it("HF=1.1e18 → watch + score 55", () => {
    const c = classify(1_100_000_000_000_000_000n);
    expect(c.level).toBe("watch");
    expect(c.score).toBe(55);
  });
  it("HF=0.9e18 → liquidating", () => {
    const c = classify(900_000_000_000_000_000n);
    expect(c.level).toBe("liquidating");
    expect(c.score).toBeLessThan(50);
  });
});
