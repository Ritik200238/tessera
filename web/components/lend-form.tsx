"use client";

import { useMemo, useState } from "react";
import { parseUnits, formatUnits, erc20Abi } from "viem";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { vault, isVaultDeployed } from "@/lib/contracts";
import { addresses } from "@/lib/addresses";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ValueCard } from "./value-card";
import { ConnectButton } from "./connect-button";
import { formatBps } from "@/lib/format";

type Mode = "deposit" | "withdraw";

const USDC_DECIMALS = 6;

export function LendForm() {
  const { address, isConnected } = useAccount();
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
        ]
      : [],
    query: { enabled: vaultAddr !== undefined },
  });

  const supplyBps = (poolData?.[0]?.result as bigint | undefined) ?? 0n;
  const utilBps = (poolData?.[1]?.result as bigint | undefined) ?? 0n;
  const totalAssets = (poolData?.[2]?.result as bigint | undefined) ?? 0n;
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

  function approve() {
    if (!usdcAddr || !vaultAddr) return;
    reset();
    writeContract({
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
      writeContract({
        address: vaultAddr,
        abi: vault.abi,
        functionName: "deposit",
        args: [parsed, address],
      });
    } else {
      writeContract({
        address: vaultAddr,
        abi: vault.abi,
        functionName: "withdraw",
        args: [parsed, address, address],
      });
    }
  }

  const canSubmit = isConnected && isVaultDeployed() && parsed > 0n && !isPending && !isMining;

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
          </div>

          {!isVaultDeployed() ? (
            <Alert tone="warning">
              <AlertTitle>Vault not yet deployed</AlertTitle>
              <AlertDescription>
                Lending will go live the moment the vault ships to this environment.
              </AlertDescription>
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
              <AlertTitle>{mode === "deposit" ? "Supplied" : "Withdrawn"}</AlertTitle>
              <AlertDescription>The action confirmed on-chain.</AlertDescription>
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
      </div>
    </div>
  );
}
