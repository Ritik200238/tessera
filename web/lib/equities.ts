/**
 * Equity-DeFi metadata + US market-hours helpers. The protocol operates 24/7 on
 * last close; these signals tell users "this is purpose-built for equities" and
 * remind them when the underlying market is shut (gap risk).
 */

export interface AssetMeta {
  symbol: string;
  /** Underlying issuer / index name. */
  name: string;
  /** Sector grouping for the equity-DeFi views. */
  sector: string;
}

const ASSET_META: Record<string, AssetMeta> = {
  tAAPL: { symbol: "tAAPL", name: "Apple Inc.", sector: "Technology" },
  tTSLA: { symbol: "tTSLA", name: "Tesla, Inc.", sector: "Consumer · Autos" },
  tNVDA: { symbol: "tNVDA", name: "NVIDIA Corp.", sector: "Technology" },
  tSPY: { symbol: "tSPY", name: "S&P 500 ETF", sector: "Broad index" },
  tQQQ: { symbol: "tQQQ", name: "Nasdaq-100 ETF", sector: "Broad index" },
};

export function assetMeta(symbol: string): AssetMeta {
  return ASSET_META[symbol] ?? { symbol, name: symbol, sector: "Equity" };
}

export type MarketState = "open" | "pre" | "after" | "closed";

export interface MarketStatus {
  state: MarketState;
  /** Short human label, e.g. "Market open" / "Closed · weekend". */
  label: string;
  /** True only during the regular 9:30–16:00 ET session. */
  isOpen: boolean;
}

/**
 * US equities regular session: 09:30–16:00 America/New_York, Mon–Fri. Exchange
 * holidays are not modeled (testnet). Computed from the viewer's clock via the
 * Intl timezone database, so it's correct regardless of the user's locale.
 */
export function marketStatus(now: Date = new Date()): MarketStatus {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = get("weekday");
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const mins = hour * 60 + minute;

  if (weekday === "Sat" || weekday === "Sun") {
    return { state: "closed", label: "Closed · weekend", isOpen: false };
  }
  if (mins < 9 * 60 + 30) return { state: "pre", label: "Pre-market", isOpen: false };
  if (mins >= 16 * 60) return { state: "after", label: "After hours", isOpen: false };
  return { state: "open", label: "Market open", isOpen: true };
}
