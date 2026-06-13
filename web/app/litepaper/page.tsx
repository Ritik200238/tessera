import { Prose } from "@/components/prose";
import { PrintButton } from "@/components/print-button";
import { litepaperBlocks } from "@/content/litepaper";
import { brand } from "@/lib/content";

export const metadata = {
  title: "Litepaper",
  description: "Tessera litepaper — the problem, the protocol, the AI risk layer, the business model, and the roadmap.",
  openGraph: {
    title: "Tessera Litepaper",
    description: brand.tagline,
  },
};

export default function LitepaperPage() {
  return (
    <article className="mx-auto max-w-2xl py-4">
      <header className="mb-10 border-b border-[color:var(--color-border)] pb-8">
        <p className="text-sm font-medium uppercase tracking-wider text-[color:var(--color-primary)]">Litepaper</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Tessera</h1>
        <p className="mt-3 text-lg text-[color:var(--color-muted-foreground)]">{brand.tagline}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3 print:hidden">
          <a
            href="/tessera-litepaper.pdf"
            className="inline-flex h-10 items-center rounded-md bg-[color:var(--color-primary)] px-4 text-sm font-semibold text-[color:var(--color-primary-foreground)] transition-opacity hover:opacity-90"
          >
            Download PDF ↓
          </a>
          <PrintButton label="Print" />
          <span className="text-xs text-[color:var(--color-muted-foreground)]">
            Testnet · {new Date().getFullYear()} · No token, ever
          </span>
        </div>
      </header>
      <Prose blocks={litepaperBlocks} />
    </article>
  );
}
