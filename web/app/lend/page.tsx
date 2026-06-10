import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { LendForm } from "@/components/lend-form";
import { LenderEarnings } from "@/components/lender-earnings";
import { ApyComparison } from "@/components/apy-comparison";

export const metadata = { title: "Lend" };

export default function LendPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Lend USDC</h1>
        <p className="text-sm text-[color:var(--color-muted-foreground)] max-w-2xl">
          Supply USDC to the lending pool and earn yield from borrowers. The agent protects the
          pool by liquidating undercollateralized positions before they go bad.
        </p>
      </header>
      <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-brand-wash)] p-4 text-sm">
        <p className="flex items-center gap-1.5 font-medium">
          <ShieldCheck aria-hidden className="size-4" /> Your USDC funds an AI-protected pool.
        </p>
        <p className="mt-1 text-[color:var(--color-muted-foreground)]">
          Every borrower position is watched 24/7 — the agent auto-repays and, only as a last
          resort, liquidates risk <em>before</em> it becomes bad debt. That is what keeps lender
          funds safe and the supply APY real.{" "}
          <Link href="/agent" className="font-medium underline">See live agent activity →</Link>
        </p>
      </div>
      <LenderEarnings />
      <LendForm />
      <ApyComparison />
    </div>
  );
}
