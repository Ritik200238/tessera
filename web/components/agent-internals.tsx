"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

/**
 * Admin-only surface for the agent's two operational endpoints that previously
 * had no UI: GET /alerts/latest (the current distressed-borrower watchlist) and
 * GET /metrics (Prometheus, linked raw). Both are bearer-gated and reached via
 * the server-side /api/agent/* proxies so the admin secret never hits the browser.
 */
interface AlertItem {
  user: string;
  hf: string;
}

function fmtHf(hf: string): string {
  try {
    return (Number(BigInt(hf)) / 1e18).toFixed(2);
  } catch {
    return hf;
  }
}

export function AgentInternals() {
  const [alerts, setAlerts] = useState<AlertItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/agent/alerts", { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { alerts?: AlertItem[]; error?: string };
        if (cancelled) return;
        if (!r.ok) setErr(j.error ?? `HTTP ${r.status}`);
        else setAlerts(j.alerts ?? []);
      })
      .catch((e) => {
        if (!cancelled) setErr((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent watchlist</CardTitle>
        <CardDescription>
          Positions the agent is currently flagging (admin-only).{" "}
          <a className="underline" href="/api/agent/metrics" target="_blank" rel="noopener noreferrer">
            Raw metrics ↗
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {err ? (
          <p className="text-[color:var(--color-muted-foreground)]">{err}</p>
        ) : alerts === null ? (
          <p className="text-[color:var(--color-muted-foreground)]">Loading…</p>
        ) : alerts.length === 0 ? (
          <p className="text-[color:var(--color-muted-foreground)]">No distressed positions right now.</p>
        ) : (
          <ul className="space-y-1">
            {alerts.map((a) => (
              <li key={a.user} className="flex justify-between gap-2 font-mono text-xs">
                <span className="truncate">{a.user}</span>
                <span className="shrink-0">HF {fmtHf(a.hf)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
