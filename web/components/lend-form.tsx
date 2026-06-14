"use client";

import { useEffect, useMemo, useState } from "react";
import { parseUnits, formatUnits, erc20Abi } from "viem";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useChainGuard } from "@/lib/use-chain-guard";
import { usePaused } from "@/lib/use-paused";
import { useQueryClient } from "@tanstack/react-query";
import { vault, isVaultDeployed } from "@/lib/contracts";
import { addresses } from "@/lib/addresses";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { WrongChainNotice } from "@/components/wrong-chain-notice";
import { ValueCard } from "./value-card";
import { ConnectButton } from "./connect-button";
import { formatBps } from "@/lib/format";
import { decodeTxError } from "@/lib/errors";
import { track } from "@/lib/analytics";
import { AdvancedOnly } from "@/components/view-mode";

type Mode = "deposit" | "withdraw";

const USDC_DECIMALS = 6;

export function LendForm() {
  const { address, isConnected } = useAccount();
  const { writeChainId, wrongChain } = useChainGuard();
  const paused = usePaused();
  const [mode, setMode] = useState<Mode>("deposit");
  const [amount, setAmount] = useState("");

  const vaultAddr = vault.address ?? undefined;
  const usdcAddr = addresses.usdc ?? undefined;

  const { data: poolData } = useReadContracts({
    contracts: vaultAddr
      ? [
          { address: vaultAddr, abi: vault.abi, functionName: "supplyRateBps" },
          { address: vaultAddr, abi: vault.abi, functionName: "utilizationBps" },
          { address: vaultAddr, abi: vault.abi, functionName: "totalAssets" },
          { address: vaultAddr, abi: vault.abi, functionName: "idleAssets" },
        ]
      : [],
    query: { enabled: vaultAddr !== undefined },
  });

  const supplyBps = (poolData?.[0]?.result as bigint | undefined) ?? 0n;
  const utilBps = (poolData?.[1]?.result as bigint | undefined) ?? 0n;
  const totalAssets = (poolData?.[2]?.result as bigint | undefined) ?? 0n;
  const idleAssets = (poolData?.[3]?.result as bigint | undefined) ?? 0n;
  const utilPct = Math.min(100, Math.max(0, Number(utilBps) / 100));

  const { data: balance } = useReadContract({
    address: usdcAddr,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && usdcAddr !== undefined },
  });

  const { data: allowance } = useReadContract({
    address: usdcAddr,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && vaultAddr ? [address, vaultAddr] : undefined,
    query: { enabled: isConnected && usdcAddr !== undefined && vaultAddr !== undefined },
  });

  const parsed = useMemo(() => {
    if (!amount) return 0n;
    try {
      return parseUnits(amount, USDC_DECIMALS);
    } catch {
      return 0n;
    }
  }, [amount]);

  const needsApproval = mode === "deposit" && parsed > 0n && (allowance as bigint | undefined ?? 0n) < parsed;

  const { writeContract, isPending, error, data: txHash, reset } = useWriteContract();
  const { isLoading: isMining, isSuccess: isMined } = useWaitForTransactionReceipt({ hash: txHash });

  // Freshness: once a tx mines (approve OR deposit/withdraw), refetch every
  // cached read so the allowance-gated button advances and pool numbers update
  // without a manual reload (QA M5/M7).
  const queryClient = useQueryClient();
  useEffect(() => {
    if (isMined) void queryClient.invalidateQueries();
  }, [isMined, queryClient]);

  function approve() {
    if (!usdcAddr || !vaultAddr) return;
    reset();
    writeContract({
      chainId: writeChainId,
      address: usdcAddr,
      abi: erc20Abi,
      functionName: "approve",
      args: [vaultAddr, parsed],
    });
  }

  function submit() {
    if (!vaultAddr || !address) return;
    reset();
    if (mode === "deposit") {
      track("first_action", { kind: "lend" });
      writeContract({
        chainId: writeChainId,
        address: vaultAddr,
        abi: vault.abi,
        functionName: "deposit",
        args: [parsed, address],
      });
    } else {
      writeContract({
        chainId: writeChainId,
        address: vaultAddr,
        abi: vault.abi,
        functionName: "withdraw",
        args: [parsed, address, address],
      });
    }
  }

  // Withdrawals can only draw on idle (un-borrowed) USDC. Block before submit so
  // the user gets a clear message instead of an on-chain InsufficientLiquidity revert.
  const exceedsLiquidity = mode === "withdraw" && parsed > 0n && parsed > idleAssets;
  const canSubmit =
    isConnected && isVaultDeployed() && parsed > 0n && !exceedsLiquidity && !isPending && !isMining && !wrongChain && !paused;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>{mode === "deposit" ? "Supply USDC" : "Withdraw USDC"}</CardTitle>
          <CardDescription>
            Switch between supplying liquidity and withdrawing your share.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div
            role="tablist"
            aria-label="Lend action"
            className="inline-flex rounded-md border border-[color:var(--color-border)] p-1"
          >
            {(["deposit", "withdraw"] as Mode[]).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                type="button"
                className={
                  "rounded px-3 py-1.5 text-sm font-medium " +
                  (mode === m
                    ? "bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]"
                    : "text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]")
                }
              >
                {m === "deposit" ? "Supply" : "Withdraw"}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label htmlFor="lend-amount" className="text-sm font-medium">
              USDC amount
            </label>
            <Input
              id="lend-amount"
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-xs text-[color:var(--color-muted-foreground)]">
              Wallet balance:{" "}
              {balance !== undefined
                ? `${formatUnits(balance as bigint, USDC_DECIMALS)} USDC`
                : "—"}
            </p>
            {mode === "withdraw" ? (
              <p className="text-xs text-[color:var(--color-muted-foreground)]">
                Available in pool now: {formatUnits(idleAssets, USDC_DECIMALS)} USDC
              </p>
            ) : null}
          </div>

          {!isVaultDeployed() ? (
            <Alert tone="warning">
              <AlertTitle>Vault not yet deployed</AlertTitle>
              <AlertDescription>
                Lending will go live the moment the vault ships to this environment.
              </AlertDescription>
            </Alert>
          ) : null}

          {exceedsLiquidity ? (
            <Alert tone="warning">
              <AlertTitle>Exceeds available liquidity</AlertTitle>
              <AlertDescription>
                Only {formatUnits(idleAssets, USDC_DECIMALS)} USDC is idle in the pool right now
                (the rest is lent out). Withdraw that much or less, or wait for borrowers to repay.
              </AlertDescription>
            </Alert>
          ) : null}
          <WrongChainNotice />

          {error ? (
            <Alert tone="danger">
              <AlertTitle>Transaction failed</AlertTitle>
              <AlertDescription>{decodeTxError(error)}</AlertDescription>
            </Alert>
          ) : null}
          {isMined ? (
            <Alert tone="success">
              <AlertTitle>{mode === "deposit" ? "Supplied" : "Withdrawn"}</AlertTitle>
              <AlertDescription>
                {mode === "deposit"
                  ? "You're now earning the supply APY. Your USDC keeps earning until you withdraw."
                  : "The withdrawal confirmed on-chain."}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex gap-3">
            {!isConnected ? (
              <ConnectButton />
            ) : needsApproval ? (
              <Button onClick={approve} disabled={!canSubmit}>
                {isPending || isMining ? "Approving…" : "Approve USDC"}
              </Button>
            ) : (
              <Button onClick={submit} disabled={!canSubmit}>
                {isPending || isMining
                  ? "Submitting…"
                  : mode === "deposit"
                    ? "Supply USDC"
                    : "Withdraw USDC"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <ValueCard label="Current supply APY" value={formatBps(supplyBps)} />
        <AdvancedOnly>
          <Card>
            <CardHeader>
              <CardTitle>Utilization</CardTitle>
              <CardDescription>Share of supplied USDC currently borrowed.</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(utilPct)}
                aria-label={`Utilization ${utilPct.toFixed(1)}%`}
                className="h-3 w-full overflow-hidden rounded-full bg-[color:var(--color-muted)]"
              >
                <div
                  className="h-full rounded-full bg-[color:var(--color-primary)]"
                  style={{ width: `${utilPct}%` }}
                />
              </div>
              <p className="mt-2 text-sm tabular-nums">{utilPct.toFixed(1)}%</p>
              <p className="mt-1 text-xs text-[color:var(--color-muted-foreground)]">
                Pool size: {formatUnits(totalAssets, USDC_DECIMALS)} USDC
              </p>
            </CardContent>
          </Card>
        </AdvancedOnly>
      </div>
    </div>
  );
}
