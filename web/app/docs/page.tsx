import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DocsShell } from "@/components/docs-shell";
import { navGroups, searchIndex } from "@/lib/docs";

export const metadata = {
  title: "Docs",
  description:
    "How Tessera works: lending, borrowing, the health factor, the AI Watcher, risks, and the architecture.",
  openGraph: {
    title: "Tessera Docs",
    description: "How lending, borrowing, and the AI risk layer work.",
  },
};

export default function DocsHome() {
  return (
    <div className="py-2">
      <DocsShell groups={navGroups} search={searchIndex} activeSlug="" headings={[]}>
        <header className="max-w-2xl">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-[color:var(--color-primary)]">
            Documentation
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-[color:var(--color-foreground)]">
            Everything that makes Tessera work.
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-[color:var(--color-muted-foreground)]">
            How to lend and borrow, how the AI Watcher protects positions, and the risks and
            architecture behind it — plain-English first, with the precise detail underneath. Press{" "}
            <kbd className="rounded border border-[color:var(--color-border)] px-1.5 py-0.5 font-mono text-[11px]">
              ⌘K
            </kbd>{" "}
            to search.
          </p>
        </header>

        <div className="mt-12 space-y-10">
          {navGroups.map((g) => (
            <section key={g.title}>
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--color-muted-foreground)]">
                {g.title}
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {g.items.map((it) => (
                  <Link
                    key={it.slug}
                    href={`/docs/${it.slug}`}
                    className="group flex items-center justify-between rounded-lg border border-[color:var(--color-border)] px-4 py-3 transition-colors hover:border-[color:var(--color-primary)] hover:bg-[color:var(--blue-wash)]"
                  >
                    <span className="font-medium text-[color:var(--color-foreground)]">{it.title}</span>
                    <ArrowRight
                      aria-hidden
                      className="size-4 text-[color:var(--color-muted-foreground)] transition-transform group-hover:translate-x-0.5 group-hover:text-[color:var(--color-primary)]"
                    />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </DocsShell>
    </div>
  );
}
