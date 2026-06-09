/**
 * Browser-safe mirror of the agent's deterministic regime engine
 * (agent/src/strategy/regime.ts + agent/src/data/earnings.ts). This is the SAME
 * logic the live agent uses to widen the protect target / alert band before a
 * gap — surfaced here for the Gap-Risk Clock + honest Protection Preview so the
 * moat is visible and works even when the agent host is asleep. Keep the bump
 * values + earnings dates in sync with the agent (they are intentionally
 * duplicated rather than imported across packages).
 */

export type MarketRegime = "open" | "after-hours" | "weekend";

const WAD = 1_000_000_000_000_000_000n;
const pct = (n: bigint) => (WAD * n) / 100n;

/** Base health-factor bands (match the agent: PROTECT_TARGET 1.4, alert 1.1). */
export const BASE_PROTECT_HF = 1_400_000_000_000_000_000n; // 1.40
export const BASE_ALERT_HF = 1_100_000_000_000_000_000n; // 1.10
export const LIQUIDATION_HF = 1_000_000_000_000_000_000n; // 1.00

/** Curated upcoming earnings (mirror agent/src/data/earnings.ts). SPY has none. */
export const EARNINGS_CALENDAR: Record<string, string[]> = {
  AAPL: ["2026-07-31", "2026-10-30", "2027-01-29"],
  TSLA: ["2026-07-22", "2026-10-21", "2027-01-28"],
};

const OPEN_MIN = 9 * 60 + 30; // 09:30 ET
const CLOSE_MIN = 16 * 60; // 16:00 ET
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function etFields(now: Date): { wd: number; mins: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wd = WD[get("weekday")] ?? 1;
  let hour = Number(get("hour"));
  if (Number.isNaN(hour) || hour === 24) hour = 0;
  const minute = Number(get("minute")) || 0;
  return { wd, mins: hour * 60 + minute };
}

/** NYSE regular session: Mon–Fri 09:30–16:00 ET (DST-aware). */
export function marketRegime(now: Date): MarketRegime {
  const { wd, mins } = etFields(now);
  if (wd === 0 || wd === 6) return "weekend";
  return mins >= OPEN_MIN && mins < CLOSE_MIN ? "open" : "after-hours";
}

export function earningsNear(now: Date, cal: Record<string, string[]> = EARNINGS_CALENDAR, withinHours = 48): boolean {
  const start = now.getTime();
  const horizon = start + withinHours * 3_600_000;
  for (const dates of Object.values(cal)) {
    for (const d of dates) {
      const t = Date.parse(d);
      if (!Number.isNaN(t) && t >= start && t <= horizon) return true;
    }
  }
  return false;
}

/** Protect target for a given regime (no earnings) — for "after the close" previews. */
export function protectTargetFor(regime: MarketRegime): bigint {
  if (regime === "weekend") return BASE_PROTECT_HF + pct(30n);
  if (regime === "after-hours") return BASE_PROTECT_HF + pct(15n);
  return BASE_PROTECT_HF;
}

export interface RegimeAssessment {
  regime: MarketRegime;
  earningsNear: boolean;
  protectTargetHf: bigint;
  alertThresholdHf: bigint;
  label: string;
}

export function assessRegime(now: Date, cal: Record<string, string[]> = EARNINGS_CALENDAR): RegimeAssessment {
  const regime = marketRegime(now);
  const near = earningsNear(now, cal);
  let bump = 0n;
  if (regime === "after-hours") bump += pct(15n);
  if (regime === "weekend") bump += pct(30n);
  if (near) bump += pct(30n);
  const parts = [regime === "open" ? "market open" : regime === "weekend" ? "weekend gap risk" : "after-hours"];
  if (near) parts.push("earnings imminent");
  return {
    regime,
    earningsNear: near,
    protectTargetHf: BASE_PROTECT_HF + bump,
    alertThresholdHf: BASE_ALERT_HF + bump,
    label: parts.join(" · "),
  };
}

export interface MarketEvent {
  kind: "closes" | "opens";
  regimeAfter: MarketRegime;
  at: Date;
  msUntil: number;
  label: string; // e.g. "Mon 9:30 ET"
}

/**
 * The next NYSE state transition. Wall-clock delta is treated as the UTC delta
 * (a multi-day countdown can be off by the rare DST hour — fine for a display).
 */
export function nextMarketEvent(now: Date): MarketEvent {
  const { wd, mins } = etFields(now);
  const isWeekday = wd >= 1 && wd <= 5;

  if (isWeekday && mins >= OPEN_MIN && mins < CLOSE_MIN) {
    const delta = CLOSE_MIN - mins;
    return {
      kind: "closes",
      regimeAfter: wd === 5 ? "weekend" : "after-hours",
      at: new Date(now.getTime() + delta * 60_000),
      msUntil: delta * 60_000,
      label: `${DAY[wd]} 4:00 PM ET`,
    };
  }

  // Closed → next session's 09:30 open.
  let daysAhead = 0;
  if (isWeekday && mins < OPEN_MIN) {
    daysAhead = 0;
  } else {
    let d = wd;
    do {
      d = (d + 1) % 7;
      daysAhead++;
    } while (d === 0 || d === 6);
  }
  const delta = daysAhead * 24 * 60 + OPEN_MIN - mins;
  const openWd = (wd + daysAhead) % 7;
  return {
    kind: "opens",
    regimeAfter: "open",
    at: new Date(now.getTime() + delta * 60_000),
    msUntil: delta * 60_000,
    label: `${DAY[openWd]} 9:30 AM ET`,
  };
}

export interface GapRiskState extends RegimeAssessment {
  next: MarketEvent;
  protectTargetAfter: bigint; // protect target once `next` happens
}

export function getGapRiskState(now: Date, cal: Record<string, string[]> = EARNINGS_CALENDAR): GapRiskState {
  const assessment = assessRegime(now, cal);
  const next = nextMarketEvent(now);
  return { ...assessment, next, protectTargetAfter: protectTargetFor(next.regimeAfter) };
}

export const hfToNumber = (hf: bigint): number => Number(hf) / 1e18;

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const totalMin = Math.round(ms / 60_000);
  const d = Math.floor(totalMin / (60 * 24));
  const h = Math.floor((totalMin % (60 * 24)) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
