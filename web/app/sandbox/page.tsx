import Link from "next/link";
import { GapSandbox } from "@/components/gap-sandbox";

export const metadata = { title: "Gap sandbox" };

export default function SandboxPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Gap sandbox</h1>
        <p className="max-w-2xl text-sm text-[color:var(--color-muted-foreground)]">
          Crash a position by any amount and watch exactly what Tessera&apos;s agent would do — the
          same decision it makes on-chain every block. Then{" "}
          <Link href="/drill" className="font-medium underline">run it for real on the Live Drill</Link>.
        </p>
      </header>
      <GapSandbox />
    </div>
  );
}
