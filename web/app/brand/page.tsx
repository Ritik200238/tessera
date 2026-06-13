import { Prose } from "@/components/prose";
import { brandBlocks } from "@/content/legal";

export const metadata = {
  title: "Brand & License",
  description: "How to reference Tessera, use of the name and marks, and the open-source license.",
};

export default function BrandPage() {
  return (
    <article className="mx-auto max-w-2xl py-4">
      <h1 className="text-3xl font-semibold tracking-tight">Brand &amp; License</h1>
      <Prose blocks={brandBlocks} className="mt-2" />
    </article>
  );
}
