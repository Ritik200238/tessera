"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { env } from "@/lib/env";

/**
 * Natural-language strategy config + pause toggle. POSTs to the local
 * proxy route handler so the admin secret never reaches the browser.
 *
 * When the agent isn't hosted (`NEXT_PUBLIC_AGENT_URL` empty) the proxy returns
 * 503, so we render the panel read-only with a clear "not connected" notice
 * instead of buttons that always fail.
 */
export function AgentConfigPanel() {
  const connected = Boolean(env.agentUrl);
  const [notes, setNotes] = useState("");
  const [pollMs, setPollMs] = useState<number>(10_000);
  const [alertHfWhole, setAlertHfWhole] = useState<number>(1.1);
  const [paused, setPaused] = useState<boolean>(false);
  const [status, setStatus] = useState<{ tone: "success" | "danger" | null; msg: string }>({
    tone: null,
    msg: "",
  });
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setStatus({ tone: null, msg: "" });
    try {
      const res = await fetch("/api/agent/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          alertThreshold: Math.floor(alertHfWhole * 1e18),
          pollIntervalMs: pollMs,
          paused,
          notes,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setStatus({ tone: "danger", msg: body.error ?? `HTTP ${res.status}` });
      } else {
        setStatus({ tone: "success", msg: "Config saved." });
      }
    } catch (err) {
      setStatus({ tone: "danger", msg: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function togglePause(next: boolean) {
    setPaused(next);
    setBusy(true);
    setStatus({ tone: null, msg: "" });
    try {
      const res = await fetch("/api/agent/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paused: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setStatus({ tone: "danger", msg: body.error ?? `HTTP ${res.status}` });
      } else {
        setStatus({ tone: "success", msg: next ? "Agent paused." : "Agent resumed." });
      }
    } catch (err) {
      setStatus({ tone: "danger", msg: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure strategy</CardTitle>
        <CardDescription>
          Tell the agent how aggressively to react. Free-form notes are parsed by the LLM into the
          typed config the agent enforces.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="agent-notes" className="text-sm font-medium">
            Strategy notes
          </label>
          <textarea
            id="agent-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="e.g. Alert me earlier on TSLA — markets are volatile this week."
            className="w-full rounded-md border border-[color:var(--color-input)] bg-[color:var(--color-card)] p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring)]"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="alert-hf" className="text-xs font-medium">
              Alert when HF below
            </label>
            <input
              id="alert-hf"
              type="number"
              min={1.0}
              max={2.0}
              step={0.05}
              value={alertHfWhole}
              onChange={(e) => setAlertHfWhole(Number(e.currentTarget.value))}
              className="h-9 w-full rounded-md border border-[color:var(--color-input)] bg-[color:var(--color-card)] px-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="poll-ms" className="text-xs font-medium">
              Poll interval (ms)
            </label>
            <input
              id="poll-ms"
              type="number"
              min={1000}
              max={60_000}
              step={1000}
              value={pollMs}
              onChange={(e) => setPollMs(Number(e.currentTarget.value))}
              className="h-9 w-full rounded-md border border-[color:var(--color-input)] bg-[color:var(--color-card)] px-2 text-sm"
            />
          </div>
        </div>
        {status.tone === "success" ? (
          <Alert tone="success">
            <AlertTitle>Saved</AlertTitle>
            <AlertDescription>{status.msg}</AlertDescription>
          </Alert>
        ) : null}
        {status.tone === "danger" ? (
          <Alert tone="danger">
            <AlertTitle>Failed</AlertTitle>
            <AlertDescription>{status.msg}</AlertDescription>
          </Alert>
        ) : null}
        {!connected ? (
          <Alert tone="info">
            <AlertTitle>Agent not connected</AlertTitle>
            <AlertDescription>
              Host the agent and set <code className="font-mono">NEXT_PUBLIC_AGENT_URL</code> to enable
              saving config and pausing. This panel is read-only until then. (On-chain protection via your
              USDC allowance works regardless of the agent UI.)
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={submit} disabled={busy || !connected}>
            {busy ? "Saving…" : "Save config"}
          </Button>
          <Button
            variant={paused ? "outline" : "destructive"}
            onClick={() => togglePause(!paused)}
            disabled={busy || !connected}
          >
            {paused ? "Resume agent" : "Pause agent"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
