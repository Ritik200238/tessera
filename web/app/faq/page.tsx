import { Prose } from "@/components/prose";
import { faqGroups } from "@/content/faq";
import { slugify } from "@/components/prose";

export const metadata = {
  title: "FAQ",
  description: "Answers to the most common questions about Tessera — how it works, the AI, the risks, fees, and more.",
  openGraph: {
    title: "Tessera FAQ",
    description: "How it works, what the AI does, the risks, fees, and regions — answered honestly.",
  },
};

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-2xl py-4">
      <header className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight">Frequently asked questions</h1>
        <p className="mt-3 text-lg text-[color:var(--color-muted-foreground)]">
          Straight answers — no hype, no promises we can&apos;t keep.
        </p>
      </header>

      {/* Group quick-links */}
      <nav aria-label="FAQ sections" className="mb-10 flex flex-wrap gap-2">
        {faqGroups.map((g) => (
          <a
            key={g.group}
            href={`#${slugify(g.group)}`}
            className="rounded-full border border-[color:var(--color-border)] px-3 py-1 text-sm text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--color-muted)] hover:text-[color:var(--color-foreground)]"
          >
            {g.group}
          </a>
        ))}
      </nav>

      <div className="space-y-12">
        {faqGroups.map((g) => (
          <section key={g.group} id={slugify(g.group)} className="scroll-mt-24">
            <h2 className="mb-4 text-xl font-semibold tracking-tight">{g.group}</h2>
            <div className="divide-y divide-[color:var(--color-border)] rounded-xl border border-[color:var(--color-border)]">
              {g.items.map((item, i) => (
                <details key={i} className="group px-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium text-[color:var(--color-foreground)] [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span className="shrink-0 text-[color:var(--color-muted-foreground)] transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <div className="pb-4 -mt-2">
                    <Prose blocks={item.answer} />
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
