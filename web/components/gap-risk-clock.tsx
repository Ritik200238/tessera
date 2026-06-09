"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getGapRiskState, formatCountdown, hfToNumber, type GapRiskState } from "@/lib/regime";

/**
 * Gap-Risk Clock — surfaces the agent's deterministic regime engine as a live,
 * legible signal: current NYSE state, the countdown to the next gap window, and
 * the exact consequence (how the AI protect target widens). This is the moat
 * made visible; it runs entirely in the browser from pure math, so it stays
 * correct even if the agent host is asleep.
 */
const TONE: Record<GapRiskState["regime"], { dot: string; label: string }> = {
  open: { dot: "var(--color-safe-fg)", label: "NYSE open" },
  "after-hours": { dot: "#d97706", label: "After-hours" },
  weekend: { dot: "var(--color-liquidating-fg)", label: "Weekend gap risk" },
};

export function GapRiskClock({ className = "" }: { className?: string }) {
  const [s, setS] = useState<GapRiskState | null>(null);
  useEffect(() => {
    const tick = () => setS(getGapRiskState(new Date()));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  if (!s) {
    return (
      <div className={"rounded-lg border border-[color:var(--color-border)] p-4 " + className}>
        <p className="text-xs text-[color:var(--color-muted-foreground)]">Loading market clock…</p>
      </div>
    );
  }

  const tone = TONE[s.regime];
  const nowTarget = hfToNumber(s.protectTargetHf).toFixed(2);
  const afterTarget = hfToNumber(s.protectTargetAfter).toFixed(2);
  const base = "1.40";

  let line: ReactNode;
  if (s.regime === "open") {
    const into = s.next.regimeAfter === "weekend" ? "the weekend" : "overnight";
    line = (
      <>
        Closes in <span className="font-semibold tabular-nums">{formatCountdown(s.next.msUntil)}</span> → {into}. The AI
        protect target then rises <span className="tabular-nums">{base} → {afterTarget}</span>, so the agent acts earlier.
      </>
    );
  } else {
    line = (
      <>
        Reopens <span className="font-medium">{s.next.label}</span>. AI protect target raised to{" "}
        <span className="font-semibold tabular-nums">{nowTarget}</span> (vs {base} when open) — the agent de-risks earlier
        through the gap.
      </>
    );
  }

  return (
    <div className={"rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-brand-wash)] p-4 " + className}>
      <div className="flex items-center gap-2">
        <span aria-hidden className="inline-block size-2.5 rounded-full" style={{ background: tone.dot }} />
        <span className="text-sm font-semibold">{tone.label}</span>
        {s.earningsNear ? (
          <span className="rounded-full border border-[color:var(--color-border)] px-2 py-0.5 text-[11px] font-medium">
            earnings imminent
          </span>
        ) : null}
        <span className="ml-auto text-xs text-[color:var(--color-muted-foreground)]">Gap-risk clock</span>
      </div>
      <p className="mt-1.5 text-sm text-[color:var(--color-muted-foreground)]">{line}</p>
    </div>
  );
}
