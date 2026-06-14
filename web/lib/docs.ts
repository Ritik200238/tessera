import type { Block } from "@/components/prose";
import { slugify } from "@/components/prose";
import { docGroups } from "@/content/docs";

/** A single documentation page (one route under /docs/[slug]). */
export interface DocSection {
  title: string;
  slug: string;
  blocks: Block[];
}
/** A sidebar group of pages. */
export interface DocGroup {
  title: string;
  sections: DocSection[];
}

/* ---- derived, lightweight structures (no Block content — safe to pass to
   client components without shipping the whole docs corpus) ----------------- */

export interface NavItem {
  title: string;
  slug: string;
}
export interface NavGroup {
  title: string;
  items: NavItem[];
}
/** Sidebar nav — titles + slugs only. */
export const navGroups: NavGroup[] = docGroups.map((g) => ({
  title: g.title,
  items: g.sections.map((s) => ({ title: s.title, slug: s.slug })),
}));

export interface FlatSection {
  groupTitle: string;
  title: string;
  slug: string;
}
/** Reading order across all groups — for prev/next. */
export const flatSections: FlatSection[] = docGroups.flatMap((g) =>
  g.sections.map((s) => ({ groupTitle: g.title, title: s.title, slug: s.slug })),
);

export interface Heading {
  text: string;
  slug: string;
  level: 2 | 3;
}
/** The h2/h3 headings inside a page — for the right-rail "On this page". */
export function getHeadings(blocks: Block[]): Heading[] {
  const out: Heading[] = [];
  for (const b of blocks) {
    if (b.type === "h2" || b.type === "h3") {
      out.push({ text: b.text, slug: b.id ?? slugify(b.text), level: b.type === "h2" ? 2 : 3 });
    }
  }
  return out;
}

export function getSection(slug: string): { section: DocSection; groupTitle: string } | null {
  for (const g of docGroups) {
    const s = g.sections.find((x) => x.slug === slug);
    if (s) return { section: s, groupTitle: g.title };
  }
  return null;
}

export function getPrevNext(slug: string): { prev: FlatSection | null; next: FlatSection | null } {
  const i = flatSections.findIndex((s) => s.slug === slug);
  return {
    prev: i > 0 ? flatSections[i - 1]! : null,
    next: i >= 0 && i < flatSections.length - 1 ? flatSections[i + 1]! : null,
  };
}

/** Flat search index — section + its headings, used by the Cmd-K palette. */
export interface SearchEntry {
  groupTitle: string;
  title: string;
  slug: string;
  headings: Heading[];
}
export const searchIndex: SearchEntry[] = docGroups.flatMap((g) =>
  g.sections.map((s) => ({
    groupTitle: g.title,
    title: s.title,
    slug: s.slug,
    headings: getHeadings(s.blocks),
  })),
);
