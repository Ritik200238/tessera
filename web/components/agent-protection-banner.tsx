"use client";

import { useEffect, useState } from "react";
import { env } from "@/lib/env";
import { deriveAgentStatus, type AgentStatus } from "@/lib/agent";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

/**
 * Position-level honesty banner. Polls the agent's /health live and warns
 * LOUDLY when AI protection is NOT live, so a borrower is never shown a calm
 * "you're protected" UI while the agent is actually down/asleep/stalled — the
 * single worst trust outcome in DeFi (liquidated while the dashboard said safe).
 *
 * - down / stale  -> RED "manage manually"
 * - unknown       -> AMBER "monitoring not configured here"
 * - live          -> renders nothing (the rest of the UI already shows healthy state)
 *
 * Polls client-side against NEXT_PUBLIC_AGENT_URL and computes staleness against
 * a live clock, so it stays accurate without a page reload.
 */
export function AgentProtectionBanner({ className }: { className?: string }) {
  const [status, setStatus] = useState<AgentStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = env.agentUrl;
    async function check() {
      if (!url) {
        if (!cancelled) setStatus("unknown");
        return;
      }
      try {
        const res = await fetch(`${url}/health`, { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setStatus("down");
          return;
        }
        const h = (await res.json()) as { lastTickAt?: unknown };
        const lastTickAt = typeof h?.lastTickAt === "string" ? h.lastTickAt : null;
        if (!cancelled) {
          setStatus(deriveAgentStatus({ available: true, configured: true, lastTickAt }, Date.now()));
        }
      } catch {
        if (!cancelled) setStatus("down");
      }
    }
    check();
    const id = setInterval(check, 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // While the first probe is in flight, or when protection is live, show nothing.
  if (status === null || status === "live") return null;

  if (status === "unknown") {
    return (
      <Alert tone="warning" className={className}>
        <AlertTitle>AI protection status unknown</AlertTitle>
        <AlertDescription>
          The monitoring agent isn&apos;t configured for this site, so we can&apos;t confirm your
          position is being watched. Treat it as unmonitored and manage it yourself.
        </AlertDescription>
      </Alert>
    );
  }

  // down or stale
  return (
    <Alert tone="danger" className={className}>
      <AlertTitle>AI protection is OFFLINE — manage your position manually</AlertTitle>
      <AlertDescription>
        The agent hasn&apos;t checked in recently, so alerts and auto-repay may not fire until it
        recovers. If your health factor is low, repay or add collateral yourself now — don&apos;t wait
        on the AI.
      </AlertDescription>
    </Alert>
  );
}
