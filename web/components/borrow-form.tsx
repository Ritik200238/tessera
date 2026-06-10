"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { vault, oracle, isVaultDeployed } from "@/lib/contracts";
import { addresses } from "@/lib/addresses";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SafetyScore } from "./safety-score";
import { HealthBadge } from "./health-badge";
import { ConnectButton } from "./connect-button";
import { GapAckModal } from "./gap-ack-modal";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { classify, projectHealthFactor } from "@/lib/health";
import { formatBps, formatHealthFactor, formatUsd8 } from "@/lib/format";
import { decodeTxError } from "@/lib/errors";
import { track } from "@/lib/analytics";

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

  const tokens = addresses.collateralTokens;
  const BASE = 4; // index where the per-token reads begin
  const enabled = isConnected && vault.address !== null && address !== undefined;
  const { data } = useReadContracts({
    contracts: enabled
      ? [
          { address: vault.address!, abi: vault.abi, functionName: "getAccountData", args: [address!] },
          { address: vault.address!, abi: vault.abi, functionName: "debtOf", args: [address!] },
          { address: vault.address!, abi: vault.abi, functionName: "borrowRateBps" },
          { address: vault.address!, abi: vault.abi, functionName: "getHealthFactor", args: [address!] },
          ...tokens.flatMap((t) => [
            { address: vault.address!, abi: vault.abi, functionName: "collateralOf", args: [address!, t.address] },
            ...(oracle.address
              ? [{ address: oracle.address, abi: oracle.abi, functionName: "getFeed", args: [t.address] }]
              : []),
          ]),
        ]
      : [],
    query: { enabled },
  });

  const accountData = data?.[0]?.result as readonly [bigint, bigint, bigint] | undefined;
  // getAccountData[0] is collateral ALREADY weighted by each asset's liquidation
  // threshold — that's borrowing power (risk-adjusted), not raw market value.
  const weightedCollateral = accountData?.[0] ?? 0n;
  const currentDebt = (data?.[1]?.result as bigint | undefined) ?? 0n;
  const borrowRateBps = (data?.[2]?.result as bigint | undefined) ?? 0n;
  const currentHf = (data?.[3]?.result as bigint | undefined) ?? 2n ** 200n;
  // debtOf returns 6-dec USDC; ×100 converts to the 8-dec USD scale used by the
  // collateral values, the HF projection, and the LTV slider math.
  const currentDebt8 = currentDebt * 100n;

  // Raw market value = Σ collateralOf × oracle price (USD, 8-dec). This is what
  // the user actually deposited and the correct denominator for an LTV slider.
  const rawCollateral = useMemo(() => {
    if (!oracle.address) return weightedCollateral; // no oracle wired -> fall back
    let sum = 0n;
    tokens.forEach((t, i) => {
      const bal = data?.[BASE + i * 2]?.result as bigint | undefined;
      const feed = data?.[BASE + i * 2 + 1]?.result as
        | readonly [bigint, bigint, bigint, boolean]
        | undefined;
      if (!bal || !feed) return;
      const price8 = feed[0] > 0n ? feed[0] : 0n;
      sum += (bal * price8) / 10n ** BigInt(t.decimals);
    });
    return sum;
  }, [data, tokens, weightedCollateral]);

  const additionalUsd8 = useMemo(() => {
    // Target borrow = LTV% of RAW market value (standard LTV semantics).
    const target = (rawCollateral * BigInt(ltvBps)) / 10_000n;
    if (target <= currentDebt8) return 0n;
    return target - currentDebt8;
  }, [rawCollateral, currentDebt8, ltvBps]);

  const projectedHf = useMemo(
    () =>
      projectHealthFactor({
        collateralValueUsd8: weightedCollateral, // HF uses the risk-weighted value
        currentDebtUsd8: currentDebt8,
        additionalBorrowUsd8: additionalUsd8,
      }),
    [weightedCollateral, currentDebt8, additionalUsd8],
  );

  // Liquidation prices: the position liquidates when its risk-weighted collateral
  // falls to the debt. Under a uniform price move the multiplier is
  // debt / weightedCollateral, so each held asset liquidates at currentPrice × that
  // (exact for a single collateral; the proportional-basket case otherwise).
  const projectedDebt8 = currentDebt8 + additionalUsd8;
  const liqPrices = useMemo(() => {
    if (projectedDebt8 <= 0n || weightedCollateral <= projectedDebt8) return [];
    return tokens
      .map((t, i) => {
        const bal = data?.[BASE + i * 2]?.result as bigint | undefined;
        const feed = data?.[BASE + i * 2 + 1]?.result as
          | readonly [bigint, bigint, bigint, boolean]
          | undefined;
        if (!bal || bal === 0n || !feed) return null;
        const price8 = feed[0] > 0n ? feed[0] : 0n;
        if (price8 === 0n) return null;
        return { symbol: t.symbol, price8, liqPrice8: (price8 * projectedDebt8) / weightedCollateral };
      })
      .filter((x): x is { symbol: string; price8: bigint; liqPrice8: bigint } => x !== null);
  }, [data, tokens, projectedDebt8, weightedCollateral]);
  const liqDropPct =
    weightedCollateral > projectedDebt8 && projectedDebt8 > 0n
      ? Number(((weightedCollateral - projectedDebt8) * 10_000n) / weightedCollateral) / 100
      : 0;

  const projected = classify(projectedHf);
  const willBeUnsafe = projectedHf < 1_100_000_000_000_000_000n; // <1.1e18 = Watch or worse

  const { writeContract, isPending, error, data: txHash, reset } = useWriteContract();
  const { isLoading: isMining, isSuccess: isMined } = useWaitForTransactionReceipt({ hash: txHash });

  // Freshness: refetch all reads once the borrow mines so debt / HF / account
  // data update in place without a reload (QA M5/M7).
  const queryClient = useQueryClient();
  useEffect(() => {
    if (isMined) void queryClient.invalidateQueries();
  }, [isMined, queryClient]);

  // USDC is 6 decimals; collateralValue is 1e8 USD. Convert before the call.
  const borrowAmount6 = useMemo(() => {
    // additionalUsd8 / 1e2 == 6-decimals
    return additionalUsd8 / 100n;
  }, [additionalUsd8]);

  const canBorrow =
    isConnected && isVaultDeployed() && borrowAmount6 > 0n && !isPending && !isMining;

  // Mandatory gap-risk acknowledgment before a FIRST borrow (debt == 0). The
  // modal models off-hours drops on the exact position being signed.
  const [showGapAck, setShowGapAck] = useState(false);

  function sendBorrowTx() {
    if (!vault.address) return;
    reset();
    track("first_action", { kind: "borrow" });
    writeContract({
      address: vault.address,
      abi: vault.abi,
      functionName: "borrow",
      args: [borrowAmount6],
    });
  }

  function borrow() {
    if (!vault.address) return;
    if (currentDebt === 0n) {
      setShowGapAck(true);
      return;
    }
    sendBorrowTx();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <GapAckModal
        open={showGapAck}
        projectedHf={projectedHf}
        onConfirm={() => {
          setShowGapAck(false);
          sendBorrowTx();
        }}
        onCancel={() => setShowGapAck(false)}
      />
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
            <Stat label="Collateral value" value={formatUsd8(rawCollateral)} />
            <Stat label="Borrowing power" value={formatUsd8(weightedCollateral)} hint="risk-adjusted" />
            <Stat label="Current debt" value={formatUsd8(currentDebt8)} />
            <Stat label="Current health" value={formatHealthFactor(currentHf)} />
            <Stat label="Borrow APR" value={formatBps(borrowRateBps)} />
          </div>

          {isConnected && rawCollateral === 0n ? (
            <Alert tone="warning">
              <AlertTitle>No collateral yet</AlertTitle>
              <AlertDescription>
                Deposit tAAPL, tTSLA, or tSPY as collateral first — that unlocks your USDC
                borrowing power. Each $100 of collateral lets you borrow roughly $40–60 depending
                on the asset.{" "}
                <Link href="/borrow" className="font-medium underline">Deposit collateral</Link>{" "}
                in step 1 above.
              </AlertDescription>
            </Alert>
          ) : null}

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

          {liqPrices.length > 0 ? (
            <div className="rounded-lg border border-[color:var(--color-border)] p-4">
              <p className="text-xs text-[color:var(--color-muted-foreground)]">
                Liquidation price{liqPrices.length > 1 ? "s" : ""} after this borrow
                {liqDropPct > 0 ? ` · roughly a ${liqDropPct.toFixed(0)}% drop away` : ""}
              </p>
              <ul className="mt-1 space-y-1 text-sm">
                {liqPrices.map((p) => (
                  <li key={p.symbol} className="flex items-baseline justify-between tabular-nums">
                    <span className="font-medium">{p.symbol}</span>
                    <span>
                      {formatUsd8(p.liqPrice8)}{" "}
                      <span className="text-xs text-[color:var(--color-muted-foreground)]">
                        from {formatUsd8(p.price8)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-[color:var(--color-muted-foreground)]">
                If a held asset falls to the price shown, the position becomes liquidatable — the AI
                agent acts before that.
              </p>
            </div>
          ) : null}

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
              <AlertDescription>{decodeTxError(error)}</AlertDescription>
            </Alert>
          ) : null}
          {isMined ? (
            <Alert tone="success">
              <AlertTitle>Borrow confirmed</AlertTitle>
              <AlertDescription>
                USDC has been sent to your wallet.{" "}
                <Link href="/dashboard" className="inline-flex items-center gap-1 font-medium underline">
                  View your position <ArrowRight aria-hidden className="size-3.5" />
                </Link>
              </AlertDescription>
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

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md bg-[color:var(--color-muted)] px-3 py-2">
      <p className="text-xs text-[color:var(--color-muted-foreground)]">
        {label}
        {hint ? <span className="ml-1 opacity-70">· {hint}</span> : null}
      </p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}
