import { TransparencyClient } from "@/components/transparency-client";
import { GapBacktestCard } from "@/components/gap-backtest-card";
import { getAgentActions } from "@/lib/agent";

export const metadata = { title: "Transparency" };
export const dynamic = "force-dynamic";

export default async function TransparencyPage() {
  const actions = await getAgentActions(100);
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Transparency</h1>
        <p className="text-sm text-[color:var(--color-muted-foreground)] max-w-2xl">
          The whole point of Tessera is that nothing is hidden. Live protocol numbers, every
          liquidation, and every action the agent has taken — all on-chain, all here.
        </p>
      </header>
      <GapBacktestCard />
      <TransparencyClient actions={actions} />
    </div>
  );
}
