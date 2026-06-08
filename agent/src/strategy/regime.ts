/**
 * Equity-market regime + event awareness — the deterministic core of the
 * "predicts danger before it happens" protection (the moat, blueprint C1).
 *
 * The defining risk of tokenized equities is the discrete GAP: the token trades
 * 24/7 but the underlying only reprices while the market is open, so price can
 * jump over a weekend, overnight, or on earnings. A generalist money-market
 * cannot structurally follow that. We can: this engine widens the protect target
 * and the alert band exactly when gap risk is highest (market closed / weekend /
 * earnings imminent), so the agent acts BEFORE the gap, not after.
 *
 * Fully deterministic — the LLM never participates here; it only explains the
 * result downstream.
 */

export type MarketRegime = "open" | "after-hours" | "weekend";

const WAD = 1_000_000_000_000_000_000n;
const pct = (n: bigint) => (WAD * n) / 100n;

/** NYSE regular session: Mon–Fri 09:30–16:00 America/New_York (DST-aware). */
export function marketRegime(now: Date): MarketRegime {
  // Resolve wall-clock fields in ET regardless of the host timezone.
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  const wd = get("weekday");
  if (wd === "Sat" || wd === "Sun") return "weekend";
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const mins = (Number.isNaN(hour) ? 0 : hour) * 60 + (Number.isNaN(minute) ? 0 : minute);
  return mins >= 9 * 60 + 30 && mins < 16 * 60 ? "open" : "after-hours";
}

export type EarningsCalendar = Record<string, string[]>;

/** True if any calendared equity has earnings within `withinHours` ahead of now. */
export function earningsNear(now: Date, cal: EarningsCalendar, withinHours = 48): boolean {
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

export interface RegimeAssessment {
  regime: MarketRegime;
  earningsNear: boolean;
  /** Health factor the protective auto-repay aims to restore to (regime-widened). */
  protectTargetHf: bigint;
  /** Health factor below which the agent alerts (regime-widened). */
  alertThresholdHf: bigint;
  /** Human-readable summary for alert copy / decision records. */
  label: string;
}

/**
 * Widen the protect target and alert band for risky regimes. Deterministic and
 * monotonic: closed > open, weekend > after-hours, and earnings stacks on top.
 */
export function assessRegime(opts: {
  now: Date;
  baseProtectHf: bigint;
  baseAlertHf: bigint;
  earningsCal: EarningsCalendar;
}): RegimeAssessment {
  const regime = marketRegime(opts.now);
  const near = earningsNear(opts.now, opts.earningsCal);

  let bump = 0n;
  if (regime === "after-hours") bump += pct(15n); // +0.15 overnight gap risk
  if (regime === "weekend") bump += pct(30n); // +0.30 — two-day gap, no reprice
  if (near) bump += pct(30n); // +0.30 — earnings move imminent

  const parts: string[] = [
    regime === "open" ? "market open" : regime === "weekend" ? "weekend gap risk" : "after-hours",
  ];
  if (near) parts.push("earnings imminent");

  return {
    regime,
    earningsNear: near,
    protectTargetHf: opts.baseProtectHf + bump,
    alertThresholdHf: opts.baseAlertHf + bump,
    label: parts.join(" · "),
  };
}
