import type { ReactNode } from "react";
import { DepositForm } from "@/components/deposit-form";
import { BorrowForm } from "@/components/borrow-form";
import { AgentControls } from "@/components/agent-controls";
import { addresses } from "@/lib/addresses";

export const metadata = { title: "Borrow" };

/** One guided journey instead of three scattered pages: collateral → borrow → protect. */
export default function BorrowPage() {
  return (
    <div className="space-y-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Borrow against your stocks</h1>
        <p className="max-w-2xl text-sm text-[color:var(--color-muted-foreground)]">
          Three steps: post tokenized-stock collateral, borrow USDC against it, then switch on AI
          protection so an overnight price gap can&apos;t liquidate you. You can stop after step 2 —
          protection is optional, but recommended.
        </p>
      </header>

      <Step
        n={1}
        title="Deposit collateral"
        desc="Pledge tokenized stocks as collateral. This unlocks your USDC borrowing power — you keep the upside."
      >
        <DepositForm tokens={addresses.collateralTokens} />
      </Step>

      <Step
        n={2}
        title="Borrow USDC"
        desc="Choose how much to borrow. Your projected health factor updates live — keep it comfortably above 1.00."
      >
        <BorrowForm />
      </Step>

      <Step
        n={3}
        title="Turn on Active Protection"
        desc="Pre-approve USDC and the agent auto-repays to pull you back to safety before a liquidation. The allowance is your spending cap and your kill switch — revoke it anytime."
      >
        <AgentControls />
      </Step>
    </div>
  );
}

function Step({ n, title, desc, children }: { n: number; title: string; desc: string; children: ReactNode }) {
  return (
    <section className="space-y-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-primary)] text-sm font-semibold text-[color:var(--color-primary-foreground)]"
        >
          {n}
        </span>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-[color:var(--color-muted-foreground)]">{desc}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
