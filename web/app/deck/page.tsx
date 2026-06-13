import { PrintButton } from "@/components/print-button";
import { slides } from "@/content/deck";
import { brand } from "@/lib/content";

export const metadata = {
  title: "Deck",
  description: "Tessera — overview deck.",
  robots: { index: false }, // unlisted investor asset; shared directly, not crawled
};

export default function DeckPage() {
  return (
    <div className="mx-auto max-w-3xl py-4">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <p className="text-sm text-[color:var(--color-muted-foreground)]">
          {slides.length} slides · {brand.tagline}
        </p>
        <PrintButton label="Save deck as PDF" />
      </div>

      <div className="space-y-6 print:space-y-0">
        {slides.map((s) => (
          <section
            key={s.n}
            className="flex min-h-[420px] flex-col rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-background)] p-8 print:min-h-screen print:break-after-page print:rounded-none print:border-0"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--color-primary)]">
              Tessera · {String(s.n).padStart(2, "0")}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">{s.title}</h2>
            {s.subtitle ? (
              <p className="mt-2 text-lg text-[color:var(--color-muted-foreground)]">{s.subtitle}</p>
            ) : null}
            <ul className="mt-6 flex-1 space-y-3">
              {s.bullets.map((b, i) => (
                <li key={i} className="flex gap-3 text-[color:var(--color-foreground)]">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--color-primary)]" />
                  <span className="leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
            {s.note ? (
              <p className="mt-6 border-t border-[color:var(--color-border)] pt-3 text-xs italic text-[color:var(--color-muted-foreground)] print:hidden">
                {s.note}
              </p>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
