import { DashboardClient } from "@/components/dashboard-client";
import { MarketBadge } from "@/components/market-badge";
import { AgentProtectionBanner } from "@/components/agent-protection-banner";
import { getAgentHealth } from "@/lib/agent";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const agentStatus = await getAgentHealth();
  return (
    <div className="space-y-8">
      <AgentProtectionBanner />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-[color:var(--color-muted-foreground)] max-w-2xl">
            Your single view of the portfolio. The Safety Score refreshes as new prices land; the
            autonomous agent runs in the background (re-checking about every 10s) and is shown to the right.
          </p>
        </div>
        <MarketBadge />
      </header>
      <DashboardClient agentStatus={agentStatus} />
    </div>
  );
}
