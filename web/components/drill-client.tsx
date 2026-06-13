"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck, Play, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getTxUrl } from "@/lib/chain";
import { track } from "@/lib/analytics";

/**
 * Live Drill — watch the production agent save a real on-chain position.
 * Polls /api/drill while a drill runs and renders each step with its real tx
 * hash. Everything shown is a real Arbitrum Sepolia transaction on an isolated
 * drill-only asset; step 4 is the same code path that protects real users.
 */
interface DrillStep {
  name: string;
  detail: string;
  tx?: string;
  at: string;
}
interface UnprotectedTwin {
  startHf: number;
  postHf: number;
  liquidated: boolean;
  seizedUsd: number;
  penaltyUsd: number;
}
interface DrillStatus {
  state:
    | "idle"
    | "preparing"
    | "position-open"
    | "gap"
    | "waiting-for-agent"
    | "saved"
    | "failed";
  startedAt: string | null;
  finishedAt: string | null;
  steps: DrillStep[];
  gapPct: number;
  hf?: string;
  debt?: string;
  rescueTx?: string;
  rationale?: string;
  unprotected?: UnprotectedTwin;
  error?: string;
  cooldownMsRemaining: number;
}

const ACTIVE_STATES = new Set(["preparing", "position-open", "gap", "waiting-for-agent"]);
const GAP_CHOICES = [35, 40, 45] as const;

const STATE_LABEL: Record<DrillStatus["state"], string> = {
  idle: "Ready",
  preparing: "Preparing the drill position…",
  "position-open": "Position open — about to gap the price",
  gap: "Price gapped — position in the danger zone",
  "waiting-for-agent": "Danger zone. The live agent is on watch — waiting for its next tick…",
  saved: "Saved — the agent auto-repaid and restored health",
  failed: "Drill did not complete",
};

export function DrillClient() {
  const [status, setStatus] = useState<DrillStatus | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [checked, setChecked] = useState(false);
  const [starting, setStarting] = useState(false);
  const [gapPct, setGapPct] = useState<number>(40);
  const unavailableRef = useRef(false);

  const poll = useCallback(async () => {
    try {
      const r = await fetch("/api/drill", { cache: "no-store" });
      if (r.status === 404 || r.status === 503) {
        setUnavailable(true);
        unavailableRef.current = true;
        return;
      }
      const j = (await r.json()) as DrillStatus;
      setStatus(j);
      setUnavailable(false);
      unavailableRef.current = false;
    } catch {
      /* transient — keep last status */
    } finally {
      setChecked(true);
    }
  }, []);

  // Poll briskly while the rig is live; back off to a slow recovery probe when
  // it's unavailable, so we don't flood the console with 404s (and still recover
  // if it's armed later).
  useEffect(() => {
    let cancelled = false;
    let t: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      await poll();
      if (cancelled) return;
      t = setTimeout(tick, unavailableRef.current ? 30_000 : 2_500);
    };
    void tick();
    return () => {
      cancelled = true;
      if (t) clearTimeout(t);
    };
  }, [poll]);

  async function start() {
    setStarting(true);
    track("drill_started", { gapPct });
    try {
      await fetch("/api/drill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gapPct }),
      });
      await poll();
    } finally {
      setStarting(false);
    }
  }

  const active = status ? ACTIVE_STATES.has(status.state) : false;
  const cooldownMin = status ? Math.ceil(status.cooldownMsRemaining / 60_000) : 0;
  const canStart = checked && !active && !starting && (status?.cooldownMsRemaining ?? 0) === 0 && !unavailable;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck aria-hidden className="size-5" /> Run the live drill
          </CardTitle>
          <CardDescription>
            <strong>You</strong> pick the crash. One click opens a real loan and gaps its collateral
            by the size you choose, then the <em>production</em> AI agent rescues it on-chain —
            usually inside a minute. Real transactions on Arbitrum Sepolia, on an isolated drill
            asset that can&apos;t touch real users. The rescue is not a script.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!checked ? (
            <p className="text-sm text-[color:var(--color-muted-foreground)]">Checking the drill rig…</p>
          ) : unavailable ? (
            <Alert tone="warning">
              <AlertTitle>The drill rig isn&apos;t armed right now</AlertTitle>
              <AlertDescription>
                Want to see it instantly?{" "}
                <a className="font-medium underline" href="/sandbox">
                  Run the drill&apos;s decision engine yourself in the Sandbox
                </a>{" "}
                — no wallet, no waiting. The reproducible on-chain backtest and every agent action are
                on the{" "}
                <a className="font-medium underline" href="/transparency">
                  Transparency
                </a>{" "}
                page.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-xs font-medium text-[color:var(--color-muted-foreground)]">
                  Choose the overnight gap to apply:
                </p>
                <div className="inline-flex rounded-md border border-[color:var(--color-border)] p-0.5" role="group" aria-label="Crash size">
                  {GAP_CHOICES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGapPct(g)}
                      disabled={active || starting}
                      aria-pressed={gapPct === g}
                      className={
                        "rounded px-3 py-1.5 text-sm font-semibold tabular-nums transition-colors disabled:opacity-50 " +
                        (gapPct === g
                          ? "bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]"
                          : "text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-muted)]")
                      }
                    >
                      −{g}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={start} disabled={!canStart}>
                  {active || starting ? (
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                  ) : (
                    <Play aria-hidden className="size-4" />
                  )}
                  {active ? "Drill running…" : cooldownMin > 0 ? `Next drill in ~${cooldownMin}m` : `Crash it −${gapPct}% and watch`}
                </Button>
                {status ? (
                  <span className="text-sm text-[color:var(--color-muted-foreground)]">
                    {STATE_LABEL[status.state]}
                    {status.hf ? ` · HF ${status.hf}` : ""}
                  </span>
                ) : null}
              </div>

              {status?.unprotected ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-[color:var(--color-safe-fg)]/30 bg-[color:var(--color-safe-bg)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-safe-fg)]">
                      Protected · live on-chain
                    </p>
                    <p className="mt-1 text-sm">
                      Watched by the agent. {status.state === "saved" ? "Rescued — health restored." : "Rescue in progress…"}
                      {status.hf ? ` HF ${status.hf}.` : ""}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[color:var(--color-liquidating-fg)]/30 bg-[color:var(--color-liquidating-bg)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-liquidating-fg)]">
                      Unprotected · projection
                    </p>
                    <p className="mt-1 text-sm">
                      A typical leveraged borrower (HF {status.unprotected.startHf.toFixed(2)}) hit by the same −{status.gapPct}% gap:{" "}
                      {status.unprotected.liquidated ? (
                        <>
                          <strong className="text-[color:var(--color-liquidating-fg)]">liquidated</strong> at HF{" "}
                          {status.unprotected.postHf.toFixed(2)} — ~${status.unprotected.seizedUsd.toLocaleString()} of collateral
                          force-sold, ${status.unprotected.penaltyUsd.toLocaleString()} lost to the penalty.
                        </>
                      ) : (
                        <>survives at HF {status.unprotected.postHf.toFixed(2)} — but undefended, one more dip from liquidation.</>
                      )}
                    </p>
                    <p className="mt-1 text-[10px] text-[color:var(--color-muted-foreground)]">
                      Same deterministic engine; not a second live position.
                    </p>
                  </div>
                </div>
              ) : null}

              {status && status.steps.length > 0 ? (
                <ol className="space-y-2">
                  {status.steps.map((s, i) => (
                    <li
                      key={`${s.at}-${i}`}
                      className="flex items-start gap-3 rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm"
                    >
                      <span
                        aria-hidden
                        className="mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-primary)] text-[11px] font-semibold text-[color:var(--color-primary-foreground)]"
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0">
                        {s.detail}
                        {s.tx ? (
                          <>
                            {" "}
                            <a
                              href={getTxUrl(s.tx)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-xs underline"
                            >
                              tx ↗
                            </a>
                          </>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : null}

              {status?.state === "waiting-for-agent" ? (
                <p className="text-sm text-[color:var(--color-muted-foreground)]">
                  This is the real thing: the same agent that watches every user position has to
                  notice the breach on its own and act. No script is driving it.
                </p>
              ) : null}

              {status?.state === "saved" ? (
                <Alert tone="success">
                  <AlertTitle>Position saved by the AI</AlertTitle>
                  <AlertDescription>
                    {status.rationale ?? "The agent auto-repaid from the pre-approved cap and restored the health factor."}{" "}
                    {status.rescueTx ? (
                      <a
                        href={getTxUrl(status.rescueTx)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium underline"
                      >
                        Verify the rescue on-chain ↗
                      </a>
                    ) : null}
                  </AlertDescription>
                </Alert>
              ) : null}

              {status?.state === "failed" ? (
                <Alert tone="warning">
                  <AlertTitle>Drill didn&apos;t complete</AlertTitle>
                  <AlertDescription>{status.error ?? "Try again in a few minutes."}</AlertDescription>
                </Alert>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What you&apos;re watching</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-[color:var(--color-muted-foreground)]">
          <p>
            <span className="font-medium text-[color:var(--color-foreground)]">Why this matters:</span> tokenized
            stocks gap while the underlying market is closed. A generic money market reacts after the damage; Tessera&apos;s
            agent watches around the clock (~10s) and can repay <em>before</em> liquidation, from USDC the user
            pre-approved — it can only ever reduce debt.
          </p>
          <p>
            <span className="font-medium text-[color:var(--color-foreground)]">Why it&apos;s honest:</span> the drill
            asset (tDRILL) is listed on the same live vault with the same rules, but isolated from real users. The
            rescue is performed by the production agent loop — not a demo script — and every step links to an Arbitrum
            Sepolia transaction you can verify.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
