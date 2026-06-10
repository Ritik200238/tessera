"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck, Play, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

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
  hf?: string;
  debt?: string;
  rescueTx?: string;
  rationale?: string;
  error?: string;
  cooldownMsRemaining: number;
}

const EXPLORER_TX = "https://sepolia.arbiscan.io/tx/";
const ACTIVE_STATES = new Set(["preparing", "position-open", "gap", "waiting-for-agent"]);

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
  const [starting, setStarting] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const r = await fetch("/api/drill", { cache: "no-store" });
      if (r.status === 404 || r.status === 503) {
        setUnavailable(true);
        return;
      }
      const j = (await r.json()) as DrillStatus;
      setStatus(j);
      setUnavailable(false);
    } catch {
      /* transient — keep last status */
    }
  }, []);

  useEffect(() => {
    void poll();
    timer.current = setInterval(() => void poll(), 2_500);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [poll]);

  async function start() {
    setStarting(true);
    try {
      await fetch("/api/drill", { method: "POST" });
      await poll();
    } finally {
      setStarting(false);
    }
  }

  const active = status ? ACTIVE_STATES.has(status.state) : false;
  const cooldownMin = status ? Math.ceil(status.cooldownMsRemaining / 60_000) : 0;
  const canStart = !active && !starting && (status?.cooldownMsRemaining ?? 0) === 0 && !unavailable;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck aria-hidden className="size-5" /> Run the live drill
          </CardTitle>
          <CardDescription>
            One click opens a real loan, crashes its collateral price −33%, and lets the{" "}
            <em>production</em> AI agent rescue it on-chain — usually inside a minute. Real
            transactions on Arbitrum Sepolia, on an isolated drill asset that can&apos;t touch real
            users. Nothing here is simulated.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {unavailable ? (
            <Alert tone="warning">
              <AlertTitle>The drill rig isn&apos;t available right now</AlertTitle>
              <AlertDescription>
                The agent host doesn&apos;t have the drill configured (or is waking up). Everything
                the drill demonstrates is also verifiable on the{" "}
                <a className="font-medium underline" href="/transparency">
                  Transparency
                </a>{" "}
                page.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={start} disabled={!canStart}>
                  {active || starting ? (
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                  ) : (
                    <Play aria-hidden className="size-4" />
                  )}
                  {active ? "Drill running…" : cooldownMin > 0 ? `Next drill in ~${cooldownMin}m` : "Start the drill"}
                </Button>
                {status ? (
                  <span className="text-sm text-[color:var(--color-muted-foreground)]">
                    {STATE_LABEL[status.state]}
                    {status.hf ? ` · HF ${status.hf}` : ""}
                  </span>
                ) : null}
              </div>

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
                              href={`${EXPLORER_TX}${s.tx}`}
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
                        href={`${EXPLORER_TX}${status.rescueTx}`}
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
            agent watches every block and repays <em>before</em> liquidation, from USDC the user pre-approved — it can
            only ever reduce debt.
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
