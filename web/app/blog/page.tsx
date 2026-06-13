import Link from "next/link";
import { posts } from "@/content/blog";

export const metadata = {
  title: "Blog",
  description: "Updates, technical deep-dives, and build-in-public notes from the team building Tessera.",
  openGraph: {
    title: "Tessera Blog",
    description: "Updates, deep-dives, and build-in-public notes.",
  },
};

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export default function BlogPage() {
  return (
    <div className="mx-auto max-w-2xl py-4">
      <header className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight">Blog</h1>
        <p className="mt-3 text-lg text-[color:var(--color-muted-foreground)]">
          What we&apos;re building, how it works, and what we&apos;re learning — written plainly.
        </p>
      </header>

      <div className="space-y-8">
        {posts.map((p) => (
          <article key={p.slug} className="border-b border-[color:var(--color-border)] pb-8 last:border-0">
            <p className="text-xs uppercase tracking-wider text-[color:var(--color-muted-foreground)]">
              {fmtDate(p.date)}
              {p.tags[0] ? <span> · {p.tags[0]}</span> : null}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              <Link href={`/blog/${p.slug}`} className="hover:text-[color:var(--color-primary)]">
                {p.title}
              </Link>
            </h2>
            <p className="mt-2 leading-relaxed text-[color:var(--color-muted-foreground)]">{p.excerpt}</p>
            <Link
              href={`/blog/${p.slug}`}
              className="mt-3 inline-block text-sm font-medium text-[color:var(--color-primary)] hover:opacity-80"
            >
              Read more →
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
