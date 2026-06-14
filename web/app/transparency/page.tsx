import { TransparencyClient } from "@/components/transparency-client";
import { GapBacktestCard } from "@/components/gap-backtest-card";
import { getAgentActions } from "@/lib/agent";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata = {
  title: "Transparency",
  openGraph: {
    title: "Tessera — Transparency",
    description: "Every protocol number and every agent action, on-chain. What's real vs mocked, stated up front.",
  },
};
export const dynamic = "force-dynamic";

// What a skeptical reviewer should know before trusting anything here — stated
// up front rather than discovered. Each row is exactly as honest as it can be.
const REAL = [
  "The Stylus vault, its rules, and every lend / borrow / repay / liquidate tx — live on Robinhood Chain (chain 46630).",
  "The AI agent's decision logic and its auto-repay / liquidation transactions (the Live Drill is the production path, not a script).",
  "The agent's safety boundary: it can only reduce your own debt from an allowance you control.",
  "The reproducible gap backtest below — its number is locked by CI; the build fails if it drifts.",
];
const MOCKED = [
  ["Price oracle", "A Chainlink-style mock kept fresh by a scheduled keeper. Mainnet swaps in real Chainlink + a deviation guard (already written) at one address."],
  ["Tokens (USDC, tAAPL/tTSLA/tSPY)", "Testnet mocks with a public faucet — they carry no value. Mainnet uses real USDC and issuer-tokenized equities."],
  ["The Live Drill's gap", "We move the mock price to create the crash you choose. The agent's rescue that follows is real and unscripted; only the trigger is ours (that's the point of a drill)."],
];

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

      <Card>
        <CardHeader>
          <CardTitle>What&apos;s real vs. what&apos;s mocked — and why</CardTitle>
          <CardDescription>
            This is a testnet build. Here&apos;s exactly where the line is, stated up front.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-safe-fg)]">
              Real &amp; verifiable
            </p>
            <ul className="space-y-1.5 text-sm">
              {REAL.map((r) => (
                <li key={r} className="flex gap-2">
                  <span aria-hidden className="text-[color:var(--color-safe-fg)]">✓</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-watch-fg)]">
              Mocked for testnet (and the mainnet plan)
            </p>
            <ul className="space-y-2 text-sm">
              {MOCKED.map(([k, v]) => (
                <li key={k}>
                  <span className="font-medium">{k}.</span>{" "}
                  <span className="text-[color:var(--color-muted-foreground)]">{v}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <GapBacktestCard />
      <TransparencyClient actions={actions} />
    </div>
  );
}
