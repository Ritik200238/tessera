"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { vault, isVaultDeployed } from "@/lib/contracts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

/**
 * Protection preview (B2) — a client-side dry-run that turns the abstract "I gave
 * the agent an allowance" into a concrete promise: under a chosen drop, here is
 * the HF your position would hit and roughly how much the agent would repay from
 * YOUR approved cap to restore it. Uses the same math the contract + agent use.
 */
const WAD = 1_000_000_000_000_000_000n;
const PROTECT_TARGET = 1_400_000_000_000_000_000n; // base; the agent raises it on weekends / near earnings

export function ProtectionPreview() {
  const { address, isConnected } = useAccount();
  const [dropPct, setDropPct] = useState(15);

  const { data } = useReadContract({
    address: vault.address ?? undefined,
    abi: vault.abi,
    functionName: "getAccountData",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && isVaultDeployed() && !!address, refetchInterval: 30_000 },
  });
  const acct = data as readonly [bigint, bigint, bigint] | undefined;
  const weighted = acct?.[0] ?? 0n; // risk-weighted collateral, 8-dec
  const debt6 = acct?.[1] ?? 0n; // USDC, 6-dec

  if (!isConnected || debt6 === 0n) return null;

  const debt8 = debt6 * 100n;
  const dropBps = BigInt(Math.round(dropPct * 100));
  const newWeighted = (weighted * (10_000n - dropBps)) / 10_000n;
  const newHf = debt8 > 0n ? (newWeighted * WAD) / debt8 : WAD * 1000n;
  // Repay to restore to the protect target: R8 = debt8 − newWeighted·WAD/target.
  const needed8 = newHf < PROTECT_TARGET ? debt8 - (newWeighted * WAD) / PROTECT_TARGET : 0n;
  const repayUsdc = needed8 > 0n ? needed8 / 100n : 0n;

  const fmtHf = (v: bigint) => (Number(v) / 1e18).toFixed(2);
  const fmtUsdc = (v: bigint) => (Number(v) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 });
  const liquidatable = newHf < WAD;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Protection preview</CardTitle>
        <CardDescription>See what the agent would do under a drop — before you rely on it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <label className="block">
          If your collateral drops <span className="font-semibold tabular-nums">{dropPct}%</span>
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={dropPct}
            onChange={(e) => setDropPct(Number(e.currentTarget.value))}
            className="mt-1 w-full accent-[color:var(--color-primary)]"
            aria-label="Collateral price drop"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md bg-[color:var(--color-muted)] px-3 py-2">
            <p className="text-xs text-[color:var(--color-muted-foreground)]">Your HF would fall to</p>
            <p className="font-medium tabular-nums">{fmtHf(newHf)}</p>
          </div>
          <div className="rounded-md bg-[color:var(--color-muted)] px-3 py-2">
            <p className="text-xs text-[color:var(--color-muted-foreground)]">Agent repays from your cap</p>
            <p className="font-medium tabular-nums">{repayUsdc > 0n ? `~${fmtUsdc(repayUsdc)} USDC` : "nothing — still safe"}</p>
          </div>
        </div>
        <p className="text-xs text-[color:var(--color-muted-foreground)]">
          {liquidatable
            ? "At this drop the position would be liquidatable — the agent acts well before this, repaying to restore health."
            : "The agent restores your position toward a ~1.40 health factor (higher on weekends / near earnings), repaying only from the USDC allowance you approved — never more."}
        </p>
      </CardContent>
    </Card>
  );
}
