"use client";

import { useEffect, useState } from "react";
import { Prose, type Block } from "@/components/prose";

export interface DocSection {
  title: string;
  slug: string;
  blocks: Block[];
}
export interface DocGroup {
  title: string;
  sections: DocSection[];
}

/**
 * Documentation layout: a sticky, grouped sidebar (table of contents) beside the
 * rendered sections. Pure presentational — takes content groups as props, so the
 * docs copy lives in a separate content module (the single source of truth).
 * The active section is highlighted as you scroll.
 */
export function DocsLayout({ groups }: { groups: DocGroup[] }) {
  const allSlugs = groups.flatMap((g) => g.sections.map((s) => s.slug));
  const [active, setActive] = useState<string>(allSlugs[0] ?? "");

  useEffect(() => {
    const headings = allSlugs
      .map((slug) => document.getElementById(slug))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [allSlugs.join("|")]);

  return (
    <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
      <aside className="hidden lg:block">
        <nav aria-label="Documentation" className="sticky top-24 space-y-6 text-sm">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-foreground)]">
                {g.title}
              </p>
              <ul className="mt-2 space-y-1.5 border-l border-[color:var(--color-border)]">
                {g.sections.map((s) => (
                  <li key={s.slug}>
                    <a
                      href={`#${s.slug}`}
                      className={
                        "-ml-px block border-l-2 pl-3 py-0.5 transition-colors " +
                        (active === s.slug
                          ? "border-[color:var(--color-primary)] text-[color:var(--color-foreground)] font-medium"
                          : "border-transparent text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]")
                      }
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 max-w-2xl">
        {groups.flatMap((g) =>
          g.sections.map((s) => (
            <section key={s.slug} className="mb-12 scroll-mt-24" id={s.slug}>
              <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--color-foreground)]">
                {s.title}
              </h2>
              <Prose blocks={s.blocks} />
            </section>
          )),
        )}
      </div>
    </div>
  );
}
