import { DocsLayout } from "@/components/docs-layout";
import { docGroups } from "@/content/docs";

export const metadata = {
  title: "Docs",
  description: "How Tessera works: lending, borrowing, the health factor, the AI Watcher, risks, and the architecture.",
  openGraph: {
    title: "Tessera Docs",
    description: "How lending, borrowing, and the AI risk layer work.",
  },
};

export default function DocsPage() {
  return (
    <div className="py-4">
      <header className="mb-10 max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight">Documentation</h1>
        <p className="mt-3 text-lg text-[color:var(--color-muted-foreground)]">
          Everything you need to understand Tessera — how to lend and borrow, how the AI Watcher protects
          positions, and the risks and architecture behind it. Plain-English first, with the precise detail
          underneath.
        </p>
      </header>
      <DocsLayout groups={docGroups} />
    </div>
  );
}
