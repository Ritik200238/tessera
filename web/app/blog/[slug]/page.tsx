import Link from "next/link";
import { notFound } from "next/navigation";
import { Prose } from "@/components/prose";
import { posts, getPost } from "@/content/blog";

export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Post not found" };
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: { title: post.title, description: post.excerpt, type: "article" },
  };
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-2xl py-4">
      <Link href="/blog" className="text-sm text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]">
        ← All posts
      </Link>
      <header className="mt-4 mb-2 border-b border-[color:var(--color-border)] pb-6">
        <p className="text-xs uppercase tracking-wider text-[color:var(--color-muted-foreground)]">
          {fmtDate(post.date)}
          {post.tags.length ? <span> · {post.tags.join(" · ")}</span> : null}
        </p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight">{post.title}</h1>
      </header>
      <Prose blocks={post.blocks} />
    </article>
  );
}
