import { Prose } from "@/components/prose";
import { privacyBlocks } from "@/content/legal";

export const metadata = {
  title: "Privacy Policy",
  description: "What Tessera collects (almost nothing), how it's used, and your choices. Interim testnet version.",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl py-4">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <Prose blocks={privacyBlocks} className="mt-2" />
    </article>
  );
}
