/**
 * Display formatters for Tessera's on-chain primitives.
 *
 * All on-chain values flow through these helpers — components must never
 * call `Number(bigint)` or hand-roll formatting. Keeps precision and locale
 * behaviour consistent across every page.
 */

const TWO_E18 = 2_000_000_000_000_000_000n;
const ONE_E18 = 1_000_000_000_000_000_000n;
const TEN_THOUSAND = 10_000n;

/** Format an 8-decimal USD bigint (oracle scale) as `$1,234.56`. */
export function formatUsd8(value: bigint, opts: { fractionDigits?: number } = {}): string {
  const { fractionDigits = 2 } = opts;
  const scale = 100_000_000n; // 1e8
  const whole = value / scale;
  const frac = value % scale;
  const fracStr = frac.toString().padStart(8, "0");
  const display = `${whole.toString()}.${fracStr.slice(0, Math.max(0, Math.min(8, fractionDigits)))}`;
  const [intPart, decimals] = display.split(".") as [string, string | undefined];
  return `$${addThousands(intPart)}${decimals && fractionDigits > 0 ? `.${decimals}` : ""}`;
}

/** Format an arbitrary-decimal token amount. */
export function formatToken(
  value: bigint,
  decimals: number,
  opts: { symbol?: string; fractionDigits?: number } = {},
): string {
  const { symbol, fractionDigits = 4 } = opts;
  if (decimals < 0) throw new Error("decimals must be >= 0");
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const frac = value % scale;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, fractionDigits);
  const trimmed = fracStr.replace(/0+$/, "");
  const body = trimmed.length > 0 ? `${addThousands(whole.toString())}.${trimmed}` : addThousands(whole.toString());
  return symbol ? `${body} ${symbol}` : body;
}

/** Format basis points (bps) as a percentage: `420n -> "4.20%"`. */
export function formatBps(bps: bigint | number): string {
  const n = typeof bps === "bigint" ? Number(bps) : bps;
  return `${(n / 100).toFixed(2)}%`;
}

/**
 * Format a 1e18-scaled health factor.
 *
 * `2n**256n - 1n` (returned by the vault when `debt == 0`) is displayed as
 * the infinity symbol — the position has no debt to liquidate.
 */
export function formatHealthFactor(hf: bigint): string {
  if (hf >= 2n ** 200n) return "∞";
  // Two decimal places, e.g. "1.07"
  const whole = hf / ONE_E18;
  const frac = (hf % ONE_E18) / 10n ** 16n; // -> 0..99
  return `${whole.toString()}.${frac.toString().padStart(2, "0")}`;
}

/**
 * Map a 1e18-scaled health factor to the headline 0–100 Safety Score (TDD §5.3):
 *   score = clamp( round( min(hf / 2e18, 1) * 100 ), 0, 100 )
 */
export function safetyScore(hf: bigint): number {
  if (hf <= 0n) return 0;
  if (hf >= TWO_E18) return 100;
  // multiply first to preserve precision, then round to nearest
  const scaledTimes100 = (hf * 100n) / TWO_E18;
  const remainder = (hf * 100n) % TWO_E18;
  // round half up
  const rounded = remainder * 2n >= TWO_E18 ? scaledTimes100 + 1n : scaledTimes100;
  return clampNumber(Number(rounded), 0, 100);
}

function addThousands(intPart: string): string {
  const negative = intPart.startsWith("-");
  const body = negative ? intPart.slice(1) : intPart;
  const grouped = body.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return negative ? `-${grouped}` : grouped;
}

function clampNumber(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

export const constants = {
  ONE_E18,
  TWO_E18,
  TEN_THOUSAND,
};
