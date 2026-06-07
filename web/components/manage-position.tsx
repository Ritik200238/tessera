"use client";

import { useAccount, useReadContract } from "wagmi";
import { vault } from "@/lib/contracts";
import { addresses } from "@/lib/addresses";
import { RepayForm } from "./repay-form";
import { WithdrawCollateralForm } from "./withdraw-collateral-form";

/**
 * Repay + withdraw exits, shown on the Borrow journey only when the connected
 * wallet actually has debt — so the de-risking path is as discoverable as the
 * risk-taking one, without cluttering a first-time borrower's view.
 */
export function ManagePosition() {
  const { address, isConnected } = useAccount();
  const { data: debt } = useReadContract({
    address: vault.address ?? undefined,
    abi: vault.abi,
    functionName: "debtOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!vault.address && !!address },
  });
  const hasDebt = ((debt as bigint | undefined) ?? 0n) > 0n;
  if (!hasDebt) return null;

  return (
    <section className="space-y-4 border-t border-[color:var(--color-border)] pt-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Manage your position</h2>
        <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
          Pay down your loan or take back collateral, any time.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <RepayForm />
        <WithdrawCollateralForm tokens={addresses.collateralTokens} />
      </div>
    </section>
  );
}
