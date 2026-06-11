import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getMarketRisk, getPositionRisk } from "@/lib/risk";
import { GapRiskClock } from "@/components/gap-risk-clock";
import { GapBacktestCard } from "@/components/gap-backtest-card";
import { GapSandbox } from "@/components/gap-sandbox";
import { SafetyBar } from "@/components/safety-bar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata = {
  title: "Explore",
  openGraph: {
    title: "Explore Tessera — no wallet needed",
    description: "A live look at the protocol and a real on-chain protected position, read straight from the chain.",
  },
};
export const dynamic = "force-dynamic";

// A real borrower position on the LIVE vault — read-only, no wallet needed.
// Everything below is fetched from the chain, never fabricated.
const DEMO = "0xBd4956F88e7bC946F775a68080D7730186fAdc25" as const;
const EXPLORER = "https://sepolia.arbiscan.io/address/";

export default async function ExplorePage() {
  const [market, position] = await Promise.all([
    getMarketRisk().catch(() => null),
    getPositionRisk(DEMO).catch(() => null),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Explore — no wallet needed</h1>
        <p className="max-w-2xl text-sm text-[color:var(--color-muted-foreground)]">
          A live look at the protocol and a real on-chain position, read straight from the chain.
          When you&apos;re ready, the{" "}
          <Link href="/start" className="font-medium underline">guided start</Link> opens your own in
          a few clicks — or just{" "}
          <Link href="/drill" className="font-medium underline">watch the AI rescue a position</Link>.
        </p>
      </header>

      <GapRiskClock />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Live market risk</CardTitle>
            <CardDescription>Regime + the AI&apos;s protection bands right now.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {market ? (
              <>
                <p className="text-xs text-[color:var(--color-muted-foreground)]">
                  Health factor is how safe a loan is — 1.00 is the liquidation line; higher is safer.
                </p>
                <Row label="Market regime" value={market.regimeLabel} />
                <Row label="AI acts below health factor" value={market.aiActsBelowHf.toFixed(2)} />
                <Row label="Restores toward health factor" value={market.restoresTowardHf.toFixed(2)} />
                <Row label="Liquidation below health factor" value={market.liquidationHf.toFixed(2)} />
                <div className="pt-1">
                  {market.assets.map((a) => (
                    <div key={a.symbol} className="flex items-baseline justify-between border-t border-[color:var(--color-border)] py-1.5 tabular-nums">
                      <span className="font-medium">{a.symbol}</span>
                      <span>
                        {a.priceUsd !== null ? `$${a.priceUsd.toLocaleString()}` : "—"}{" "}
                        <span className={"text-xs " + (a.stale ? "text-[color:var(--color-liquidating-fg)]" : "text-[color:var(--color-safe-fg)]")}>
                          {a.stale ? "stale" : "fresh"}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-[color:var(--color-muted-foreground)]">Market data is loading from the chain…</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>A real protected position</CardTitle>
            <CardDescription>
              On-chain, read-only —{" "}
              <a className="underline" href={`${EXPLORER}${DEMO}`} target="_blank" rel="noopener noreferrer">
                view the wallet ↗
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {position && position.exists ? (
              <>
                {position.healthFactor !== null && (
                  <SafetyBar hf={position.healthFactor} actAt={position.aiActsBelowHf} protectAt={position.restoresTowardHf} />
                )}
                <Stat label="Debt outstanding" value={position.debtUsdc !== null ? `$${position.debtUsdc.toLocaleString()}` : "—"} />
                <p className="text-[color:var(--color-muted-foreground)]">{position.verdict}</p>
              </>
            ) : (
              <p className="text-[color:var(--color-muted-foreground)]">
                The demo position is between states right now — try the{" "}
                <Link href="/drill" className="underline">Live Drill</Link> to watch one move.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <GapSandbox />

      <GapBacktestCard />

      <div className="flex flex-wrap gap-3">
        <Link
          href="/start"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-[color:var(--color-primary)] px-4 text-sm font-medium text-[color:var(--color-primary-foreground)] hover:opacity-90"
        >
          Open your own position <ArrowRight aria-hidden className="size-4" />
        </Link>
        <Link
          href="/drill"
          className="inline-flex h-10 items-center rounded-md border border-[color:var(--color-border)] px-4 text-sm font-medium hover:bg-[color:var(--color-muted)]"
        >
          Watch the AI rescue a position
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[color:var(--color-muted-foreground)]">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "safe" }) {
  return (
    <div className="rounded-md bg-[color:var(--color-muted)] px-3 py-2">
      <p className="text-xs text-[color:var(--color-muted-foreground)]">{label}</p>
      <p className={"text-lg font-semibold tabular-nums" + (tone === "safe" ? " text-[color:var(--color-safe-fg)]" : "")}>
        {value}
      </p>
    </div>
  );
}
