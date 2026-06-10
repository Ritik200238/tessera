import Link from "next/link";
import { DrillClient } from "@/components/drill-client";

export const metadata = { title: "Live Drill" };

export default function DrillPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Live Drill</h1>
        <p className="max-w-2xl text-sm text-[color:var(--color-muted-foreground)]">
          Don&apos;t take our word for it — watch the AI save a position. One click runs a real
          gap-and-rescue on the live vault, performed by the production agent, with every step
          verifiable on-chain. Don&apos;t want to wait for a tick?{" "}
          <Link href="/sandbox" className="font-medium underline">Drag the gap yourself</Link> and see
          the agent&apos;s logic instantly.
        </p>
      </header>
      <DrillClient />
    </div>
  );
}
