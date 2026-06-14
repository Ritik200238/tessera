import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brand, values, team, links, chain } from "@/lib/content";

export const metadata = {
  title: "About",
  description:
    "Tessera is building the autonomous AI risk layer for tokenized-equity lending. Our mission, our principles, and the team behind it.",
  openGraph: {
    title: "About Tessera",
    description: "Why we're building the safest place to borrow against tokenized stocks.",
  },
};

/** Initials avatar in Tessera Blue — clean, photo-free, on-brand. */
function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-primary)] text-base font-bold text-[color:var(--color-primary-foreground)]">
      {initials}
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-16 py-4">
      {/* Mission hero */}
      <header className="space-y-5">
        <p className="text-sm font-medium uppercase tracking-wider text-[color:var(--color-primary)]">
          About Tessera
        </p>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight">
          Borrowing against tokenized stocks shouldn&apos;t liquidate you in your sleep.
        </h1>
        <p className="text-lg leading-relaxed text-[color:var(--color-muted-foreground)]">
          {brand.mission}
        </p>
      </header>

      {/* What we're building */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">What we&apos;re building</h2>
        <p className="leading-relaxed text-[color:var(--color-muted-foreground)]">
          Tessera is a non-custodial lending market for tokenized equities, paired with an autonomous risk
          agent — the Watcher — that monitors every position around the clock and works to prevent
          catastrophic liquidations before they happen. Lenders earn yield on USDC; borrowers unlock
          liquidity against their tokenized stocks without selling. A deterministic on-chain core makes every
          decision that moves money; the AI never holds your funds.
        </p>
        <p className="leading-relaxed text-[color:var(--color-muted-foreground)]">
          Our long-term goal is bigger than one lending market:{" "}
          <span className="font-medium text-[color:var(--color-foreground)]">{brand.vision}</span> We&apos;re
          building it in the open, on Arbitrum Stylus, and we&apos;d rather earn trust slowly through
          transparency than quickly through hype.
        </p>
        <p className="text-sm text-[color:var(--color-muted-foreground)]">
          <span className="font-medium text-[color:var(--color-foreground)]">Where we are today:</span>{" "}
          {brand.stage} (on {chain.name}, an {chain.kind}.)
        </p>
      </section>

      {/* Principles */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight">How we work</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {values.map((v) => (
            <Card key={v.title}>
              <CardHeader>
                <CardTitle className="text-base">{v.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-[color:var(--color-muted-foreground)]">
                {v.body}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Team */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight">The team</h2>
        <p className="max-w-2xl leading-relaxed text-[color:var(--color-muted-foreground)]">
          Founder-led and building in the open — a small team with a high bar. Judge us by what we
          ship: the{" "}
          <a href={links.github} target="_blank" rel="noopener noreferrer" className="font-medium text-[color:var(--color-primary)] underline underline-offset-2 hover:opacity-80">
            open-source code ↗
          </a>
          , the live protocol, and the{" "}
          <Link href="/transparency" className="font-medium text-[color:var(--color-primary)] underline underline-offset-2 hover:opacity-80">
            on-chain transparency page
          </Link>
          .
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {team.map((m) => (
            <Card key={m.name}>
              <CardContent className="flex gap-4 p-6">
                <Avatar name={m.name} />
                <div className="min-w-0">
                  <p className="font-semibold text-[color:var(--color-foreground)]">{m.name}</p>
                  <p className="text-sm font-medium text-[color:var(--color-primary)]">{m.role}</p>
                  {m.bio ? (
                    <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-muted-foreground)]">{m.bio}</p>
                  ) : null}
                  {m.links?.length ? (
                    <div className="mt-3 flex flex-wrap gap-3">
                      {m.links.map((l) => (
                        <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[color:var(--color-primary)] underline underline-offset-2 hover:opacity-80">
                          {l.label} ↗
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Open roles — honest signal of growth (no placeholder names). */}
          <Card className="border-dashed bg-transparent">
            <CardContent className="flex gap-4 p-6">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-dashed border-[color:var(--color-border)] text-xl text-[color:var(--color-muted-foreground)]">
                +
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-[color:var(--color-foreground)]">Join the team</p>
                <p className="text-sm font-medium text-[color:var(--color-muted-foreground)]">
                  Protocol · Frontend · AI agents
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-muted-foreground)]">
                  We&apos;re growing the founding team. If you build serious DeFi, Rust on Stylus, or
                  autonomous agents, say hello at{" "}
                  <a href={`mailto:${links.contactEmail}`} className="font-medium text-[color:var(--color-primary)] underline underline-offset-2 hover:opacity-80">
                    {links.contactEmail}
                  </a>
                  .
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Contact */}
      <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-muted)] p-6">
        <h2 className="text-lg font-semibold tracking-tight">Get in touch</h2>
        <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-muted-foreground)]">
          Building something here, evaluating Tessera, or want to talk? Reach us at{" "}
          <a href={`mailto:${links.contactEmail}`} className="text-[color:var(--color-primary)] underline underline-offset-2 hover:opacity-80">
            {links.contactEmail}
          </a>{" "}
          or read the{" "}
          <Link href="/litepaper" className="text-[color:var(--color-primary)] underline underline-offset-2 hover:opacity-80">
            litepaper
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
