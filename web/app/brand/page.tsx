import type { ReactNode } from "react";
import { Mark, Wordmark } from "@/components/mark";
import { brand } from "@/lib/content";

export const metadata = {
  title: "Brand Kit",
  description:
    "The Tessera brand kit — the mark, logo downloads, color palette, typography, and voice. Everything you need to represent Tessera correctly.",
};

/* ---- small building blocks ----------------------------------------------- */

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-[family-name:var(--font-plex-mono)] text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--blue)]">
      {children}
    </p>
  );
}

function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="border-t border-[color:var(--line)] py-14 first:border-t-0">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.03em] text-[color:var(--ink)] sm:text-4xl">
        {title}
      </h2>
      {intro ? (
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[color:var(--muted)]">{intro}</p>
      ) : null}
      <div className="mt-8">{children}</div>
    </section>
  );
}

function DownloadButton({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
  return (
    <a
      href={href}
      download
      className={
        "inline-flex h-10 items-center rounded-md px-4 text-sm font-semibold transition-opacity hover:opacity-90 " +
        (primary
          ? "bg-[var(--blue)] text-white"
          : "border border-[color:var(--line-2)] bg-[var(--surface)] text-[color:var(--ink)]")
      }
    >
      {label} ↓
    </a>
  );
}

const PALETTE: { name: string; hex: string; varName: string; role: string; onDark?: boolean }[] = [
  { name: "Ink", hex: "#111214", varName: "--ink", role: "Primary text & the mark", onDark: true },
  { name: "Tessera Blue", hex: "#2353e6", varName: "--blue", role: "The accent — one thing at a time", onDark: true },
  { name: "Blue (deep)", hex: "#1a3fb0", varName: "--blue-ink", role: "Hover & pressed states", onDark: true },
  { name: "Canvas", hex: "#fbfbfa", varName: "--canvas", role: "Page background" },
  { name: "Surface", hex: "#ffffff", varName: "--surface", role: "Cards & panels" },
  { name: "Line", hex: "#e9e9e6", varName: "--line", role: "Borders & dividers" },
  { name: "Muted", hex: "#6e727a", varName: "--muted", role: "Secondary text" },
  { name: "Safe", hex: "#0a6e4c", varName: "--safe", role: "Healthy / success", onDark: true },
  { name: "Danger", hex: "#c5283d", varName: "--danger", role: "Risk / liquidation", onDark: true },
];

/* ---- page ----------------------------------------------------------------- */

export default function BrandPage() {
  return (
    <div className="mx-auto max-w-4xl py-6">
      {/* Hero */}
      <header className="pb-6">
        <Eyebrow>Brand Kit</Eyebrow>
        <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-[-0.035em] text-[color:var(--ink)] sm:text-5xl">
          The Tessera <span className="text-[color:var(--blue)]">brand</span>, in one place.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[color:var(--muted)]">
          The mark, the colors, the type, and the voice — everything you need to represent Tessera
          accurately. {brand.tagline}
        </p>
      </header>

      {/* The mark */}
      <Section
        id="mark"
        eyebrow="01 · Logo"
        title="The mark"
        intro="Four tesserae — mosaic tiles set with grout gaps. Three sit in neutral ink; one is laid in Tessera Blue: the moment a position joins the structure. The blue tile is always bottom-right."
      >
        <div className="grid gap-4 sm:grid-cols-[1.3fr_1fr]">
          {/* big light */}
          <div className="flex items-center justify-center rounded-2xl border border-[color:var(--line)] bg-[var(--canvas)] py-16">
            <Mark size={150} />
          </div>
          {/* dark */}
          <div className="flex items-center justify-center rounded-2xl border border-[color:var(--ink)] bg-[var(--ink)] py-16">
            <Mark size={110} color="#ffffff" />
          </div>
        </div>

        {/* wordmark lockup */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-center rounded-2xl border border-[color:var(--line)] bg-[var(--surface)] py-10">
            <Wordmark markSize={30} />
          </div>
          <div className="flex items-center justify-center rounded-2xl border border-[color:var(--ink)] bg-[var(--ink)] py-10">
            <Wordmark markSize={30} color="#ffffff" />
          </div>
        </div>

        {/* downloads */}
        <div className="mt-6 flex flex-wrap gap-3">
          <DownloadButton href="/brand/tessera-mark.svg" label="Mark (SVG)" primary />
          <DownloadButton href="/brand/tessera-logo-transparent-1080.png" label="PNG · transparent" />
          <DownloadButton href="/brand/tessera-logo-light-1080.png" label="PNG · light" />
          <DownloadButton href="/brand/tessera-logo-dark-1080.png" label="PNG · dark" />
        </div>
      </Section>

      {/* Clearspace & don'ts */}
      <Section id="usage" eyebrow="02 · Usage" title="Keep it clean">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[color:var(--line)] bg-[var(--surface)] p-6">
            <p className="font-semibold text-[color:var(--safe)]">Do</p>
            <ul className="mt-3 space-y-2 text-sm text-[color:var(--ink-2)]">
              <li>Give the mark room — at least the height of one tile as clearspace.</li>
              <li>Use the ink mark on light backgrounds, the white mark on dark.</li>
              <li>Keep the bottom-right tile Tessera Blue. Always.</li>
              <li>Use the SVG wherever possible so it stays sharp at any size.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-[color:var(--line)] bg-[var(--surface)] p-6">
            <p className="font-semibold text-[color:var(--danger)]">Don&apos;t</p>
            <ul className="mt-3 space-y-2 text-sm text-[color:var(--ink-2)]">
              <li>Don&apos;t recolor the tiles, add gradients, or change the opacities.</li>
              <li>Don&apos;t rotate, stretch, or add shadows and outlines.</li>
              <li>Don&apos;t place the mark on a busy photo without enough contrast.</li>
              <li>Don&apos;t rebuild the wordmark in a different typeface.</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* Color */}
      <Section
        id="color"
        eyebrow="03 · Color"
        title="Palette"
        intro="A near-neutral system with one decisive accent. Tessera Blue is used sparingly — for the one thing that matters on a screen. Green means safe; red means risk."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PALETTE.map((c) => (
            <div key={c.varName} className="overflow-hidden rounded-xl border border-[color:var(--line)]">
              <div
                className="flex h-24 items-end justify-end p-3"
                style={{ background: c.hex, color: c.onDark ? "#fff" : "var(--ink)" }}
              >
                <span className="font-[family-name:var(--font-plex-mono)] text-xs opacity-80">{c.hex}</span>
              </div>
              <div className="bg-[var(--surface)] p-3">
                <p className="text-sm font-semibold text-[color:var(--ink)]">{c.name}</p>
                <p className="font-[family-name:var(--font-plex-mono)] text-xs text-[color:var(--muted)]">
                  {c.varName}
                </p>
                <p className="mt-1 text-xs text-[color:var(--muted)]">{c.role}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Typography */}
      <Section
        id="type"
        eyebrow="04 · Type"
        title="Typography"
        intro="Two typefaces, each with a job. Schibsted Grotesk carries all language. IBM Plex Mono carries every number — rates, balances, health factors, addresses — so figures always line up and read as data."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[color:var(--line)] bg-[var(--surface)] p-6">
            <p className="text-xs uppercase tracking-wider text-[color:var(--muted)]">Schibsted Grotesk · language</p>
            <p className="mt-3 text-6xl font-extrabold tracking-[-0.03em] text-[color:var(--ink)]">Aa</p>
            <p className="mt-4 text-xl font-bold tracking-[-0.02em] text-[color:var(--ink)]">
              The safest place to borrow against tokenized stocks.
            </p>
            <p className="mt-2 text-sm text-[color:var(--muted)]">Regular · Medium · Semibold · Bold · Extrabold</p>
          </div>
          <div className="rounded-xl border border-[color:var(--line)] bg-[var(--surface)] p-6">
            <p className="text-xs uppercase tracking-wider text-[color:var(--muted)]">IBM Plex Mono · numbers</p>
            <p className="mt-3 font-[family-name:var(--font-plex-mono)] text-6xl font-semibold text-[color:var(--ink)]">
              123
            </p>
            <p className="mt-4 font-[family-name:var(--font-plex-mono)] text-xl text-[color:var(--ink)]">
              HF 1.94 · 12.4% APY · $24,000
            </p>
            <p className="mt-2 font-[family-name:var(--font-plex-mono)] text-sm text-[color:var(--muted)]">
              0x8bf6…87f6e
            </p>
          </div>
        </div>
      </Section>

      {/* Voice */}
      <Section
        id="voice"
        eyebrow="05 · Voice"
        title="How Tessera sounds"
        intro="Confident, mature, and technically honest. We build credibility through clarity, not hype — and we never overclaim."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[color:var(--line)] bg-[var(--surface)] p-6">
            <p className="font-semibold text-[color:var(--safe)]">We say</p>
            <ul className="mt-3 space-y-2 text-sm text-[color:var(--ink-2)]">
              <li>&ldquo;An AI agent works to head off liquidations.&rdquo;</li>
              <li>&ldquo;Live on testnet. Not yet open to real funds.&rdquo;</li>
              <li>&ldquo;It cannot guarantee protection — a severe gap can still liquidate.&rdquo;</li>
              <li>Plain numbers, named gates, no jargon for its own sake.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-[color:var(--line)] bg-[var(--surface)] p-6">
            <p className="font-semibold text-[color:var(--danger)]">We don&apos;t say</p>
            <ul className="mt-3 space-y-2 text-sm text-[color:var(--ink-2)]">
              <li>&ldquo;Guaranteed.&rdquo; &ldquo;Risk-free.&rdquo; &ldquo;Proven.&rdquo;</li>
              <li>Mainnet features described as if they&apos;re already live.</li>
              <li>Hype, moon-talk, or buzzwords that hide what&apos;s real.</li>
              <li>Anything we can&apos;t back up on-chain or in plain English.</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* Messaging */}
      <Section id="messaging" eyebrow="06 · Messaging" title="The words that matter">
        <div className="space-y-4">
          <div className="rounded-xl border border-[color:var(--line)] bg-[var(--blue-wash)] p-6">
            <p className="text-xs uppercase tracking-wider text-[color:var(--blue-ink)]">Tagline · use verbatim</p>
            <p className="mt-2 text-2xl font-extrabold tracking-[-0.02em] text-[color:var(--ink)]">{brand.tagline}</p>
          </div>
          <div className="rounded-xl border border-[color:var(--line)] bg-[var(--surface)] p-6">
            <p className="text-xs uppercase tracking-wider text-[color:var(--muted)]">One-liner</p>
            <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--ink-2)]">{brand.oneLiner}</p>
          </div>
          <div className="rounded-xl border border-[color:var(--line)] bg-[var(--surface)] p-6">
            <p className="text-xs uppercase tracking-wider text-[color:var(--muted)]">Long-term vision</p>
            <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--ink-2)]">{brand.vision}</p>
          </div>
        </div>
      </Section>

      {/* Name & marks */}
      <Section id="name" eyebrow="07 · Name & marks" title="Using the Tessera name">
        <p className="max-w-2xl text-sm leading-relaxed text-[color:var(--muted)]">
          Always &ldquo;Tessera&rdquo; — capital T, one word. The code is open-source; the name and the
          mark identify this project specifically, so please don&apos;t use them in a way that implies
          partnership or endorsement that doesn&apos;t exist. When in doubt, link to{" "}
          <a href="/" className="font-medium text-[color:var(--blue)] underline">
            tessera
          </a>{" "}
          rather than reproducing the mark.
        </p>
      </Section>
    </div>
  );
}
