import { StatusClient } from "@/components/status-client";
import { getAgentHealth } from "@/lib/agent";

export const metadata = { title: "Status" };
export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const agentHealth = await getAgentHealth();
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">System status</h1>
        <p className="text-sm text-[color:var(--color-muted-foreground)] max-w-2xl">
          Live operational state — vault, oracle freshness, and the risk agent — read directly from
          the chain. If anything here is degraded, borrowing is paused conservatively.
        </p>
      </header>
      <StatusClient agentHealth={agentHealth} />
    </div>
  );
}
