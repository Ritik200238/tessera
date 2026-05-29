"use client";

import { useMemo, useState } from "react";
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits } from "viem";
import { vault, isVaultDeployed } from "@/lib/contracts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SafetyScore } from "./safety-score";
import { HealthBadge } from "./health-badge";
import { ConnectButton } from "./connect-button";
import { classify, projectHealthFactor } from "@/lib/health";
import { formatBps, formatHealthFactor, formatUsd8 } from "@/lib/format";

/**
 * Borrow form.
 *
 * Slider expresses target borrow as a percentage of collateral value up to
 * the protocol's 70% max LTV. Projected health factor is recomputed on
 * every drag via lib/health.projectHealthFactor — fully client-side so
 * there is no RPC roundtrip per slider tick.
 */
const MAX_LTV_BPS = 7000n; // 70% — TDD §7.3

export function BorrowForm() {
  const { address, isConnected } = useAccount();
  const [ltvBps, setLtvBps] = useState<number>(2500); // start at 25%

  const enabled = isConnected && vault.address !== null && address !== undefined;
  const { data } = useReadContracts({
    contracts: enabled
      ? [
          { address: vault.address!, abi: vault.abi, functionName: "getAccountData", args: [address!] },
          { address: vault.address!, abi: vault.abi, functionName: "debtOf", args: [address!] },
          { address: vault.address!, abi: vault.abi, functionName: "borrowRateBps" },
          { address: vault.address!, abi: vault.abi, functionName: "getHealthFactor", args: [address!] },
        ]
      : [],
    query: { enabled },
  });

  const accountData = data?.[0]?.result as readonly [bigint, bigint, bigint] | undefined;
  const collateralValue = accountData?.[0] ?? 0n;
  const currentDebt = (data?.[1]?.result as bigint | undefined) ?? 0n;
  const borrowRateBps = (data?.[2]?.result as bigint | undefined) ?? 0n;
  const currentHf = (data?.[3]?.result as bigint | undefined) ?? 2n ** 200n;

  const additionalUsd8 = useMemo(() => {
    // ltvBps% of collateralValueUsd is the max user can borrow under
    // protocol limits — we just project from there.
    const target = (collateralValue * BigInt(ltvBps)) / 10_000n;
    if (target <= currentDebt) return 0n;
    return target - currentDebt;
  }, [collateralValue, currentDebt, ltvBps]);

  const projectedHf = useMemo(
    () =>
      projectHealthFactor({
        collateralValueUsd8: collateralValue,
        currentDebtUsd8: currentDebt,
        additionalBorrowUsd8: additionalUsd8,
      }),
    [collateralValue, currentDebt, additionalUsd8],
  );

  const projected = classify(projectedHf);
  const willBeUnsafe = projectedHf < 1_100_000_000_000_000_000n; // <1.1e18 = Watch or worse

  const { writeContract, isPending, error, data: txHash, reset } = useWriteContract();
  const { isLoading: isMining, isSuccess: isMined } = useWaitForTransactionReceipt({ hash: txHash });

  // USDC is 6 decimals; collateralValue is 1e8 USD. Convert before the call.
  const borrowAmount6 = useMemo(() => {
    // additionalUsd8 / 1e2 == 6-decimals
    return additionalUsd8 / 100n;
  }, [additionalUsd8]);

  const canBorrow =
    isConnected && isVaultDeployed() && borrowAmount6 > 0n && !isPending && !isMining;

  function borrow() {
    if (!vault.address) return;
    reset();
    writeContract({
      address: vault.address,
      abi: vault.abi,
      functionName: "borrow",
      args: [borrowAmount6],
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Borrow USDC</CardTitle>
          <CardDescription>
            Pick a target loan-to-value. We&apos;ll show how it affects your Safety Score before
            you sign.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Collateral value" value={formatUsd8(collateralValue)} />
            <Stat label="Current debt" value={formatUsd8(currentDebt)} />
            <Stat label="Current health" value={formatHealthFactor(currentHf)} />
            <Stat label="Borrow APR" value={formatBps(borrowRateBps)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <label htmlFor="ltv" className="font-medium">
                Target LTV
              </label>
              <span className="tabular-nums font-medium">{(ltvBps / 100).toFixed(0)}%</span>
            </div>
            <input
              id="ltv"
              type="range"
              min={0}
              max={Number(MAX_LTV_BPS)}
              step={100}
              value={ltvBps}
              onChange={(e) => setLtvBps(Number(e.currentTarget.value))}
              className="w-full accent-[color:var(--color-primary)]"
              aria-valuemin={0}
              aria-valuemax={Number(MAX_LTV_BPS)}
              aria-valuenow={ltvBps}
              aria-label="Target loan-to-value"
            />
            <div className="flex justify-between text-xs text-[color:var(--color-muted-foreground)]">
              <span>0%</span>
              <span>35%</span>
              <span>70% (max)</span>
            </div>
          </div>

          <div className="rounded-lg border border-[color:var(--color-border)] p-4">
            <p className="text-xs text-[color:var(--color-muted-foreground)]">You will borrow</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatUnits(borrowAmount6, 6)} USDC
            </p>
            <div className="mt-2 flex items-center gap-2">
              <HealthBadge tone={projected.tone} label={`After borrow: ${projected.label}`} size="sm" />
            </div>
          </div>

          {willBeUnsafe && additionalUsd8 > 0n ? (
            <Alert tone="warning">
              <AlertTitle>This borrow leaves a slim safety buffer</AlertTitle>
              <AlertDescription>
                Markets can move fast — the AI agent will alert you and step in if needed, but
                you may want to leave more headroom.
              </AlertDescription>
            </Alert>
          ) : null}

          {!isVaultDeployed() ? (
            <Alert tone="warning">
              <AlertTitle>Vault not yet deployed</AlertTitle>
              <AlertDescription>The borrow button will be enabled after deploy.</AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <Alert tone="danger">
              <AlertTitle>Transaction failed</AlertTitle>
              <AlertDescription>{(error as Error).message}</AlertDescription>
            </Alert>
          ) : null}
          {isMined ? (
            <Alert tone="success">
              <AlertTitle>Borrow confirmed</AlertTitle>
              <AlertDescription>USDC has been sent to your wallet.</AlertDescription>
            </Alert>
          ) : null}

          <div>
            {isConnected ? (
              <Button onClick={borrow} disabled={!canBorrow}>
                {isPending || isMining ? "Borrowing…" : "Borrow USDC"}
              </Button>
            ) : (
              <ConnectButton />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Projected position</CardTitle>
          <CardDescription>How the borrow changes your Safety Score.</CardDescription>
        </CardHeader>
        <CardContent>
          <SafetyScore hf={projectedHf} />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[color:var(--color-muted)] px-3 py-2">
      <p className="text-xs text-[color:var(--color-muted-foreground)]">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}
