import { Prose } from "@/components/prose";
import { disclaimerBlocks } from "@/content/legal";

export const metadata = {
  title: "Disclaimer",
  description: "Tessera is experimental, unaudited, testnet-only software. Not financial advice. Interim version.",
};

export default function DisclaimerPage() {
  return (
    <article className="mx-auto max-w-2xl py-4">
      <h1 className="text-3xl font-semibold tracking-tight">Disclaimer</h1>
      <Prose blocks={disclaimerBlocks} className="mt-2" />
    </article>
  );
}
