import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata = { title: "Roadmap" };

/**
 * Public roadmap — what's live, what's next, and the hard gates before real
 * funds. Honest by construction: "Live now" lists only shipped, verifiable
 * things; mainnet items are gates, not promises of dates.
 */
const LIVE: [string, string][] = [
  ["Stylus vault on Robinhood Chain (Arbitrum Orbit)", "ERC-4626 USDC pool + tokenized-stock collateral, conservative per-asset LTVs"],
  ["Autonomous risk agent", "watches every position each tick (~10s); plain-English alerts; auto-repay from a user-approved cap"],
  ["Regime-aware protection", "protect bands widen automatically for after-hours / weekends / earnings — acts before the gap"],
  ["Live Drill", "one click: a real position gaps −33% and the production agent rescues it on-chain"],
  ["Reproducible proof", "CI-locked backtest: protection avoided liquidation in 75% of modeled gap liquidations"],
  ["Radical transparency", "public decision records, track record, status, risk params — verifiable on-chain"],
];

const NEXT: [string, string][] = [
  ["Alert channels", "Telegram/Discord push for at-risk positions, on top of the existing feed"],
  ["Risk API + MCP server", "Tessera's risk signals consumable by other apps and AI agents"],
  ["Verifiable AI decision log", "hash-chained, locally re-derivable agent decisions — verify the AI, don't trust it"],
  ["Event-calendar depth", "confirmed earnings datetimes; halts and index events as data allows"],
  ["Robinhood Chain", "deploy where tokenized equities live natively, as the ecosystem opens"],
];

const GATES: [string, string][] = [
  ["Independent audit", "the single hard gate — funded via grant; no real funds before it"],
  ["Permissionless backstop liquidator", "code shipped + tested (heartbeat-gated); activates in the audited build"],
  ["Dual-oracle deviation guard", "code shipped + tested; second feed wired at mainnet"],
  ["Reserve factor 15% + insurance reserve", "revenue/safety capital switches on with the audited skim"],
  ["Bug bounty + legal review + TVL caps", "Immunefi, ToS/risk disclosure, geo-blocks, conservative per-asset caps"],
];

export default function RoadmapPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Roadmap</h1>
        <p className="max-w-2xl text-sm text-[color:var(--color-muted-foreground)]">
          Quality-gated, not date-gated. The long-term direction: the autonomous AI risk layer for
          24/7 tokenized-equity markets — no token, ever; revenue is the protocol&apos;s 15% reserve
          factor.
        </p>
      </header>

      <Section title="Live now (testnet)" tone="safe" items={LIVE} />
      <Section title="Next" items={NEXT} />
      <Section title="Mainnet gates — none crossed yet, all required" tone="warn" items={GATES} />
    </div>
  );
}

function Section({ title, items, tone }: { title: string; items: [string, string][]; tone?: "safe" | "warn" }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle
          className={
            tone === "safe"
              ? "text-[color:var(--color-safe-fg)]"
              : tone === "warn"
                ? "text-[color:var(--color-liquidating-fg)]"
                : undefined
          }
        >
          {title}
        </CardTitle>
        {tone === "warn" ? (
          <CardDescription>Real funds only after every gate below is met.</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {items.map(([t, d]) => (
            <li key={t} className="border-b border-[color:var(--color-border)] pb-2 last:border-none last:pb-0">
              <span className="font-medium">{t}</span>
              <span className="text-[color:var(--color-muted-foreground)]"> — {d}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
