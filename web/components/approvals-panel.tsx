"use client";

import { useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { erc20Abi, formatUnits } from "viem";
import { vault } from "@/lib/contracts";
import { addresses } from "@/lib/addresses";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Your approvals (B6) — the universal kill switch. Shows the USDC allowance the
 * connected wallet has granted the vault (the agent's auto-repay spending cap)
 * and a one-tap revoke (approve 0), so turning AI protection off is always
 * immediate and on-chain — never gated behind the agent being reachable.
 */
export function ApprovalsPanel() {
  const { address, isConnected } = useAccount();
  const usdc = addresses.usdc;
  const { data: allowance, refetch } = useReadContract({
    address: usdc ?? undefined,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && vault.address ? [address, vault.address] : undefined,
    query: { enabled: isConnected && !!usdc && !!vault.address && !!address },
  });
  const { writeContract, isPending, data: hash, reset, error } = useWriteContract();
  const { isLoading: mining, isSuccess: mined } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (mined) void refetch();
  }, [mined, refetch]);

  if (!isConnected) return null;
  const current = (allowance as bigint | undefined) ?? 0n;

  function revoke() {
    if (!usdc || !vault.address) return;
    reset();
    writeContract({ address: usdc, abi: erc20Abi, functionName: "approve", args: [vault.address, 0n] });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your approvals</CardTitle>
        <CardDescription>
          The USDC allowance you grant the vault is the agent&apos;s auto-repay cap — and your kill
          switch. Revoke any time to disable AI protection instantly, on-chain.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-baseline justify-between border-b border-[color:var(--color-border)] pb-2">
          <span className="text-[color:var(--color-muted-foreground)]">USDC approved to the vault</span>
          <span className="font-medium tabular-nums">
            {current === 0n
              ? "None · protection off"
              : `${Number(formatUnits(current, 6)).toLocaleString()} USDC`}
          </span>
        </div>
        <Button variant="destructive" onClick={revoke} disabled={current === 0n || isPending || mining}>
          {isPending || mining ? "Revoking…" : "Revoke (disable protection)"}
        </Button>
        {error ? (
          <p className="text-xs text-[color:var(--color-liquidating-fg)]">{(error as Error).message}</p>
        ) : null}
        {mined ? <p className="text-xs text-[color:var(--color-safe-fg)]">Allowance updated on-chain.</p> : null}
      </CardContent>
    </Card>
  );
}
