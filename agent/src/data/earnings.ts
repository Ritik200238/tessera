// Curated upcoming earnings dates (ISO, UTC) for the UNDERLYING equities of the
// listed tokenized-stock collateral. SPY is an index ETF and has no earnings.
// Maintained quarterly. Used by the regime engine (strategy/regime.ts) to widen
// protection ahead of an earnings gap — the discrete event a generalist
// money-market structurally cannot follow.
export const EARNINGS_CALENDAR: Record<string, string[]> = {
  AAPL: ["2026-07-31", "2026-10-30", "2027-01-29"],
  TSLA: ["2026-07-22", "2026-10-21", "2027-01-28"],
};
