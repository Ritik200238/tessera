import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ArrowLeft, ArrowRight } from "lucide-react";
import { Prose } from "@/components/prose";
import { DocsShell } from "@/components/docs-shell";
import {
  getSection,
  getHeadings,
  getPrevNext,
  navGroups,
  searchIndex,
  flatSections,
} from "@/lib/docs";

export function generateStaticParams() {
  return flatSections.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = getSection(slug);
  if (!found) return { title: "Not found" };
  return {
    title: found.section.title,
    description: `Tessera documentation — ${found.section.title}.`,
    openGraph: { title: `${found.section.title} · Tessera Docs` },
  };
}

export default async function DocSectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = getSection(slug);
  if (!found) notFound();

  const { section, groupTitle } = found;
  const headings = getHeadings(section.blocks);
  const { prev, next } = getPrevNext(slug);

  return (
    <div className="py-2">
      <DocsShell groups={navGroups} search={searchIndex} activeSlug={slug} headings={headings}>
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-xs text-[color:var(--color-muted-foreground)]"
        >
          <Link href="/docs" className="hover:text-[color:var(--color-foreground)]">
            Docs
          </Link>
          <ChevronRight aria-hidden className="size-3" />
          <span>{groupTitle}</span>
          <ChevronRight aria-hidden className="size-3" />
          <span className="text-[color:var(--color-foreground)]">{section.title}</span>
        </nav>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[color:var(--color-foreground)]">
          {section.title}
        </h1>

        <Prose blocks={section.blocks} className="mt-6" />

        <nav className="mt-14 grid gap-3 border-t border-[color:var(--color-border)] pt-6 sm:grid-cols-2">
          {prev ? (
            <Link
              href={`/docs/${prev.slug}`}
              className="group flex flex-col rounded-lg border border-[color:var(--color-border)] p-4 transition-colors hover:border-[color:var(--color-primary)]"
            >
              <span className="flex items-center gap-1 text-xs text-[color:var(--color-muted-foreground)]">
                <ArrowLeft aria-hidden className="size-3" /> Previous
              </span>
              <span className="mt-1 font-medium text-[color:var(--color-foreground)] group-hover:text-[color:var(--color-primary)]">
                {prev.title}
              </span>
            </Link>
          ) : (
            <span className="hidden sm:block" />
          )}
          {next ? (
            <Link
              href={`/docs/${next.slug}`}
              className="group flex flex-col rounded-lg border border-[color:var(--color-border)] p-4 text-right transition-colors hover:border-[color:var(--color-primary)] sm:col-start-2"
            >
              <span className="flex items-center justify-end gap-1 text-xs text-[color:var(--color-muted-foreground)]">
                Next <ArrowRight aria-hidden className="size-3" />
              </span>
              <span className="mt-1 font-medium text-[color:var(--color-foreground)] group-hover:text-[color:var(--color-primary)]">
                {next.title}
              </span>
            </Link>
          ) : null}
        </nav>
      </DocsShell>
    </div>
  );
}
