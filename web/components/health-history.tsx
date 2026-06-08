"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { classify } from "@/lib/health";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Health-factor history sparkline (blueprint §11 — retention).
 *
 * Charts the wallet's OWN health factor over time so a borrower can see how close
 * they came to the 1.10 protection trigger and how the position recovered. The
 * series is sampled client-side (every block while the dashboard is open,
 * throttled) and persisted to localStorage per address — it is the user's real
 * observed HF, not synthetic data, and it accumulates across visits. We don't
 * fabricate history: a fresh position shows an honest "building history" state.
 */

const WAD = 1_000_000_000_000_000_000n;
const ALERT_HF = 1.1; // the protection trigger the agent watches
const LIQ_HF = 1.0; // liquidation line
const MAX_SAMPLES = 96;
const MIN_GAP_MS = 30_000; // at most ~1 stored sample / 30s
const CHART_MIN = 0.9;
const CHART_MAX = 2.0;

interface Sample {
  t: number;
  hf: number;
}

function hfToNumber(hf: bigint): number {
  const capped = hf > 5n * WAD ? 5n * WAD : hf;
  return Number(capped) / 1e18;
}

function loadSamples(key: string): Sample[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is Sample =>
        typeof s === "object" && s !== null && typeof (s as Sample).hf === "number" && typeof (s as Sample).t === "number",
    );
  } catch {
    return [];
  }
}

const W = 100;
const H = 34;
const PAD = 3;

function toY(v: number): number {
  const clamped = Math.max(CHART_MIN, Math.min(CHART_MAX, v));
  const frac = (clamped - CHART_MIN) / (CHART_MAX - CHART_MIN);
  return H - PAD - frac * (H - 2 * PAD);
}
function toX(i: number, n: number): number {
  return n <= 1 ? W / 2 : PAD + (i / (n - 1)) * (W - 2 * PAD);
}

export function HealthHistory({ address, hf, hasDebt }: { address: string; hf: bigint; hasDebt: boolean }) {
  const storageKey = `tessera:hf-history:${address.toLowerCase()}`;
  const [samples, setSamples] = useState<Sample[]>([]);
  const lastStoredAt = useRef(0);

  // Load persisted history when the wallet changes.
  useEffect(() => {
    setSamples(loadSamples(storageKey));
    lastStoredAt.current = 0;
  }, [storageKey]);

  // Append a throttled sample whenever HF changes (only for finite, has-debt HF).
  useEffect(() => {
    if (!hasDebt || hf <= 0n) return;
    const now = Date.now();
    if (now - lastStoredAt.current < MIN_GAP_MS) return;
    lastStoredAt.current = now;
    setSamples((prev) => {
      const next = [...prev, { t: now, hf: hfToNumber(hf) }].slice(-MAX_SAMPLES);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* private mode / quota — degrade to in-memory only */
      }
      return next;
    });
  }, [hf, hasDebt, storageKey]);

  const lowest = useMemo(() => (samples.length ? Math.min(...samples.map((s) => s.hf)) : null), [samples]);
  const current = hasDebt ? hfToNumber(hf) : null;
  const tone = classify(hf).tone;
  const stroke = `var(--color-${tone}-fg)`;

  const points = useMemo(
    () => samples.map((s, i) => `${toX(i, samples.length).toFixed(1)},${toY(s.hf).toFixed(1)}`).join(" "),
    [samples],
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-[color:var(--color-muted-foreground)]">
          Health history
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {samples.length < 2 ? (
          <p className="text-sm text-[color:var(--color-muted-foreground)]">
            Building your health history — it fills in as you visit while this position is open. Tessera
            watches the <span className="font-mono">1.10</span> protection trigger the whole time.
          </p>
        ) : (
          <>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="h-16 w-full"
              role="img"
              aria-label="Health factor over time"
            >
              {/* liquidation (1.00) and protection-trigger (1.10) reference lines */}
              <line x1={0} x2={W} y1={toY(LIQ_HF)} y2={toY(LIQ_HF)} stroke="var(--color-atrisk-fg)" strokeWidth={0.4} strokeDasharray="2 2" opacity={0.5} />
              <line x1={0} x2={W} y1={toY(ALERT_HF)} y2={toY(ALERT_HF)} stroke="var(--color-watch-fg)" strokeWidth={0.4} strokeDasharray="2 2" opacity={0.6} />
              <polyline points={points} fill="none" stroke={stroke} strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[color:var(--color-muted-foreground)]">
                Lowest: <span className="font-mono text-[color:var(--color-foreground)]">{lowest?.toFixed(2)}</span>
              </span>
              <span className="text-[color:var(--color-muted-foreground)]">
                <span className="inline-block size-2 rounded-full align-middle" style={{ background: "var(--color-watch-fg)" }} />{" "}
                1.10 trigger
              </span>
              <span className="text-[color:var(--color-muted-foreground)]">
                Now: <span className="font-mono text-[color:var(--color-foreground)]">{current?.toFixed(2) ?? "—"}</span>
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
