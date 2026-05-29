import { ActionLog } from "@/components/action-log";
import { AgentConfigPanel } from "@/components/agent-config-panel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { getAgentActions, getAgentHealth } from "@/lib/agent";
import { env } from "@/lib/env";

export const metadata = { title: "Agent" };
export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const [actions, health] = await Promise.all([getAgentActions(50), getAgentHealth()]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Risk agent</h1>
        <p className="text-sm text-[color:var(--color-muted-foreground)] max-w-2xl">
          Tessera&apos;s autonomous agent polls the vault, alerts on at-risk positions, and
          executes liquidations when a position drops below health factor 1.0.
        </p>
      </header>

      {!env.agentUrl ? (
        <Alert tone="warning">
          <AlertTitle>Agent URL not configured</AlertTitle>
          <AlertDescription>
            Set <code className="font-mono">NEXT_PUBLIC_AGENT_URL</code> in this app&apos;s env to
            connect to the agent&apos;s HTTP server (default port 8787, TDD §4.7).
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Newest first · last 50 events</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionLog actions={actions} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Status" value={health.available ? (health.ok ? "OK" : "Degraded") : "Offline"} />
              <Row label="Last tick" value={health.lastTickAt ?? "—"} />
              <Row label="Errors (24h)" value={String(health.errors24h)} />
            </CardContent>
          </Card>
          <AgentConfigPanel />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-[color:var(--color-border)] pb-1.5 last:border-none last:pb-0">
      <span className="text-[color:var(--color-muted-foreground)]">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
