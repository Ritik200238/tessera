import { ActionLog } from "@/components/action-log";
import { AgentControls } from "@/components/agent-controls";
import { AgentConfigPanel } from "@/components/agent-config-panel";
import { AgentInternals } from "@/components/agent-internals";
import { AdminOnly } from "@/components/admin-only";
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
          Tessera&apos;s autonomous agent polls the vault every block, alerts you in plain English
          when risk rises, and — when you enable Active Protection — auto-repays from your
          pre-approved USDC to prevent a liquidation. It liquidates only as a last resort below
          health factor 1.0. The deterministic core decides what to do; the agent can only act
          within the on-chain limits you set.
        </p>
      </header>

      {!env.agentUrl ? (
        <Alert tone="info">
          <AlertTitle>Live activity feed isn&apos;t connected to this view</AlertTitle>
          <AlertDescription>
            Your protection is enforced on-chain regardless of this feed: your approved cap, your
            health factor, and every past agent action are always verifiable on the{" "}
            <a className="font-medium underline" href="/transparency">Transparency</a> page.
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
          <AgentControls />
          <AdminOnly>
            <AgentConfigPanel />
            <AgentInternals />
          </AdminOnly>
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
