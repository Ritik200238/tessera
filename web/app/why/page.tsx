import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { WaitlistForm } from "@/components/waitlist-form";

export const metadata = {
  title: "Why Tessera",
  openGraph: {
    title: "Why Tessera — the case for AI-protected lending",
    description:
      "Tokenized stocks trade 24/7; the market behind them doesn't. That gap is where people get liquidated — and what Tessera's AI is built to stop.",
  },
};

const PERSONAS = [
  {
    who: "The yield seeker",
    sub: "supplies USDC on Aave / Spark / Morpho today",
    pain: "Wants exposure to tokenized-equity borrow demand for higher yield — but not the bad-debt risk of a venue that liquidates too slowly when stocks gap.",
    fit: "Tessera's agent acts before positions go underwater, so the lender's pool is protected, not just the borrower.",
  },
  {
    who: "The leveraged equity holder",
    sub: "holds tokenized TSLA / NVDA / SPY",
    pain: "Wants to borrow against equities without a margin call firing while they sleep. On a normal market a weekend gap is a forced liquidation.",
    fit: "An autonomous agent repays from USDC they pre-approve to hold the line through the gap — they keep the keys and can revoke anytime.",
  },
  {
    who: "The agent economy (B2B)",
    sub: "other AI agents & apps touching tokenized RWAs",
    pain: "Any agent managing on-chain positions needs a trustworthy risk read before it acts — and there's no standard risk layer for tokenized equities.",
    fit: "Tessera exposes its risk engine as a public Risk API + an MCP server, so any agent can consult it. That demand is demonstrable today.",
  },
];

export default function WhyPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-primary)]">
          The case for Tessera
        </p>
        <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Tokenized stocks trade 24/7. The market behind them doesn&apos;t.
        </h1>
        <p className="max-w-2xl text-[color:var(--color-muted-foreground)]">
          That difference is where people get liquidated — and where an AI agent that watches every
          position and acts <em>before</em> the liquidation has a real, durable job to do.
        </p>
      </header>

      {/* The problem */}
      <Card>
        <CardHeader>
          <CardTitle>The problem is structural, not hypothetical</CardTitle>
          <CardDescription>Why this risk exists by design, and won&apos;t go away.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed">
          <p>
            A tokenized stock keeps trading nights, weekends, and holidays — but the equity market
            behind it is closed. So the price <strong>gaps</strong>: a position that&apos;s perfectly
            safe at midnight can be underwater by morning on overnight news, with no chance for the
            borrower to react.
          </p>
          <p>
            On every other lending venue, that gap means a liquidation — sold at the worst possible
            moment, with a penalty. Crypto-native money markets were never built for an asset whose
            underlying market is closed two days a week. Tessera is.
          </p>
          <p className="text-[color:var(--color-muted-foreground)]">
            See it for yourself: drag a crash in the{" "}
            <Link href="/sandbox" className="font-medium underline">Sandbox</Link>, or watch the agent
            rescue a real position in the{" "}
            <Link href="/drill" className="font-medium underline">Live Drill</Link>.
          </p>
        </CardContent>
      </Card>

      {/* Who needs this */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Who needs this</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PERSONAS.map((p) => (
            <Card key={p.who} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-base">{p.who}</CardTitle>
                <CardDescription>{p.sub}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-relaxed">
                <p className="text-[color:var(--color-muted-foreground)]">{p.pain}</p>
                <p>{p.fit}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Why now + wedge to platform */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Why now</CardTitle>
            <CardDescription>The asset class just became real.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              Tokenized equities went from thesis to live product — Robinhood Chain, Backed, Dinari,
              Ondo and others now issue stocks on-chain, and they trade around the clock by design.
            </p>
            <p>
              That 24/7 property is exactly what creates the gap-risk above — and it&apos;s brand new.
              The venue that owns <em>safe</em> credit on these assets is unclaimed. We&apos;re early to a
              real, growing market, and we say so plainly.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>From product to infrastructure</CardTitle>
            <CardDescription>The wedge, then the platform.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              <strong>The wedge:</strong> the safest venue to lend against, or borrow against, tokenized
              equities — because the agent prevents the liquidations other venues eat.
            </p>
            <p>
              <strong>The platform:</strong> that same risk engine, exposed as an API and an{" "}
              <Link href="/developers" className="font-medium underline">MCP server</Link>, becomes the
              risk layer other protocols and AI agents consult before they touch tokenized RWAs.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Honest signal */}
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s real today — and what we&apos;re not claiming</CardTitle>
          <CardDescription>Honest about the stage we&apos;re at.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 text-sm sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-safe-fg)]">
              Real today
            </p>
            <ul className="space-y-1.5">
              {[
                "The protocol is live on two Arbitrum chains (Sepolia + Robinhood Chain), with a backstop liquidation proven on-chain.",
                "The production agent rescues real positions — the Live Drill is that exact path, on demand.",
                "The risk engine is already consumable by external AI agents through the Risk API + MCP server.",
              ].map((r) => (
                <li key={r} className="flex gap-2">
                  <span aria-hidden className="text-[color:var(--color-safe-fg)]">✓</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted-foreground)]">
              Not yet (and we won&apos;t pretend otherwise)
            </p>
            <ul className="space-y-1.5 text-[color:var(--color-muted-foreground)]">
              {[
                "This is a testnet build — no mainnet, no real funds, no fabricated user counts or TVL.",
                "Mainnet is gated on a third-party audit, a bug bounty, and a safety reserve.",
                "Early access is opening now — the list below is the real, honest count of interest.",
              ].map((r) => (
                <li key={r} className="flex gap-2">
                  <span aria-hidden>•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Waitlist */}
      <Card>
        <CardHeader>
          <CardTitle>Get early access</CardTitle>
          <CardDescription>
            Building on tokenized equities, or want to use Tessera when it opens? Leave an email — one
            message when early access is live, nothing else.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-lg">
            <WaitlistForm />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
