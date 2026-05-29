import { describe, expect, it } from "vitest";
import { formatBps, formatHealthFactor, formatToken, formatUsd8, safetyScore } from "@/lib/format";

describe("formatUsd8", () => {
  it("formats $0", () => {
    expect(formatUsd8(0n)).toBe("$0.00");
  });
  it("formats common values", () => {
    expect(formatUsd8(100_000_000n)).toBe("$1.00");           // $1
    expect(formatUsd8(123_456_789_00n)).toBe("$123.45");      // 12345.6789 ... actually 12345 with 8 decimals
  });
  it("rounds to fractionDigits", () => {
    // 1234567890123n -> $12345.67890123
    expect(formatUsd8(1_234_567_890_123n, { fractionDigits: 4 })).toBe("$12,345.6789");
  });
  it("formats large numbers with thousands separators", () => {
    expect(formatUsd8(123_456_789_012_345n)).toBe("$1,234,567.89");
  });
});

describe("formatToken", () => {
  it("roundtrips a clean integer amount", () => {
    expect(formatToken(1_500_000_000_000_000_000n, 18, { symbol: "tAAPL" })).toBe("1.5 tAAPL");
  });
  it("strips trailing zeros", () => {
    expect(formatToken(1_000_000n, 6)).toBe("1");
  });
  it("respects fractionDigits cap", () => {
    expect(formatToken(123_456_789_012_345_678n, 18, { fractionDigits: 4 })).toBe("0.1234");
  });
  it("throws on negative decimals", () => {
    expect(() => formatToken(1n, -1)).toThrow();
  });
});

describe("formatBps", () => {
  it("formats both bigint and number inputs", () => {
    expect(formatBps(420n)).toBe("4.20%");
    expect(formatBps(0)).toBe("0.00%");
    expect(formatBps(10000)).toBe("100.00%");
  });
});

describe("formatHealthFactor", () => {
  it("uses ∞ for the infinite sentinel", () => {
    expect(formatHealthFactor(2n ** 256n - 1n)).toBe("∞");
  });
  it("renders two decimal places", () => {
    expect(formatHealthFactor(1_070_000_000_000_000_000n)).toBe("1.07");
    expect(formatHealthFactor(2_000_000_000_000_000_000n)).toBe("2.00");
  });
});

describe("safetyScore", () => {
  it("clamps at 100 above 2e18", () => {
    expect(safetyScore(3_000_000_000_000_000_000n)).toBe(100);
  });
  it("returns 0 for zero or negative", () => {
    expect(safetyScore(0n)).toBe(0);
  });
  it("maps the TDD example values", () => {
    expect(safetyScore(2_000_000_000_000_000_000n)).toBe(100);
    expect(safetyScore(1_500_000_000_000_000_000n)).toBe(75);
    expect(safetyScore(1_200_000_000_000_000_000n)).toBe(60);
    expect(safetyScore(1_000_000_000_000_000_000n)).toBe(50);
  });
  it("rounds to the nearest integer", () => {
    // 1.005e18 / 2e18 = 0.5025 -> rounds to 50
    expect(safetyScore(1_005_000_000_000_000_000n)).toBe(50);
    // 1.01e18 / 2e18 = 0.505 -> rounds to 51
    expect(safetyScore(1_010_000_000_000_000_000n)).toBe(51);
  });
});
