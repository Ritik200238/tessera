import { DashboardClient } from "@/components/dashboard-client";
import { getAgentHealth } from "@/lib/agent";

export default async function DashboardPage() {
  const agentStatus = await getAgentHealth();
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-[color:var(--color-muted-foreground)] max-w-2xl">
          Your single view of the portfolio. The Safety Score updates on every new block; the
          autonomous agent runs in the background and is shown to the right.
        </p>
      </header>
      <DashboardClient agentStatus={agentStatus} />
    </div>
  );
}
