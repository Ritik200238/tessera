"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { NavGroup, Heading, SearchEntry } from "@/lib/docs";
import { SearchTrigger, SearchPalette } from "@/components/docs-search";

/* ---- left sidebar --------------------------------------------------------- */
function Sidebar({
  groups,
  activeSlug,
  onNavigate,
}: {
  groups: NavGroup[];
  activeSlug: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Documentation" className="space-y-7 text-sm">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="px-2 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--color-foreground)]">
            {g.title}
          </p>
          <ul className="mt-2 space-y-0.5">
            {g.items.map((it) => {
              const active = it.slug === activeSlug;
              return (
                <li key={it.slug}>
                  <Link
                    href={`/docs/${it.slug}`}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={
                      "block rounded-md px-2 py-1.5 transition-colors " +
                      (active
                        ? "bg-[color:var(--blue-wash)] font-medium text-[color:var(--color-primary)]"
                        : "text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-muted)] hover:text-[color:var(--color-foreground)]")
                    }
                  >
                    {it.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/* ---- right rail: "On this page" (scroll-spy) ------------------------------ */
function OnThisPage({ headings }: { headings: Heading[] }) {
  const [active, setActive] = useState<string>(headings[0]?.slug ?? "");
  const key = headings.map((h) => h.slug).join("|");

  useEffect(() => {
    const els = headings
      .map((h) => document.getElementById(h.slug))
      .filter((e): e is HTMLElement => e !== null);
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]?.target.id) setActive(vis[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );
    els.forEach((e) => obs.observe(e));
    return () => obs.disconnect();
  }, [key]);

  if (headings.length === 0) return null;
  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--color-foreground)]">
        On this page
      </p>
      <ul className="mt-3 space-y-1.5 border-l border-[color:var(--color-border)]">
        {headings.map((h) => (
          <li key={h.slug} className={h.level === 3 ? "ml-3" : ""}>
            <a
              href={`#${h.slug}`}
              className={
                "-ml-px block border-l-2 py-0.5 pl-3 transition-colors " +
                (active === h.slug
                  ? "border-[color:var(--color-primary)] font-medium text-[color:var(--color-foreground)]"
                  : "border-transparent text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]")
              }
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ---- the 3-column shell --------------------------------------------------- */
export function DocsShell({
  groups,
  search,
  activeSlug,
  headings,
  children,
}: {
  groups: NavGroup[];
  search: SearchEntry[];
  activeSlug: string;
  headings: Heading[];
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  return (
    <div className="lg:grid lg:grid-cols-[228px_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[228px_minmax(0,1fr)_196px]">
      {/* left: search + sidebar (sticky on desktop) */}
      <aside className="hidden lg:block">
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] space-y-5 overflow-y-auto pb-10">
          <SearchTrigger onOpen={openSearch} />
          <Sidebar groups={groups} activeSlug={activeSlug} />
        </div>
      </aside>

      {/* mobile: search + collapsible nav */}
      <div className="mb-6 space-y-3 lg:hidden">
        <SearchTrigger onOpen={openSearch} />
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          className="flex w-full items-center justify-between rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm font-medium"
        >
          Browse docs
          <ChevronDown aria-hidden className={"size-4 transition-transform " + (mobileOpen ? "rotate-180" : "")} />
        </button>
        {mobileOpen ? (
          <div className="rounded-md border border-[color:var(--color-border)] p-4">
            <Sidebar groups={groups} activeSlug={activeSlug} onNavigate={() => setMobileOpen(false)} />
          </div>
        ) : null}
      </div>

      {/* center: content */}
      <div className="min-w-0 max-w-2xl pb-4">{children}</div>

      {/* right: on this page (sticky, xl+ only) */}
      <aside className="hidden xl:block">
        <div className="sticky top-20">
          <OnThisPage headings={headings} />
        </div>
      </aside>

      {/* single shared command palette (Cmd-K) */}
      <SearchPalette entries={search} open={searchOpen} onOpen={openSearch} onClose={closeSearch} />
    </div>
  );
}
