"use client";

import { useMemo, useState } from "react";
import { erc20Abi, formatUnits, parseUnits } from "viem";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useChainGuard } from "@/lib/use-chain-guard";
import { useQueryClient } from "@tanstack/react-query";
import { vault, isVaultDeployed } from "@/lib/contracts";
import { addresses } from "@/lib/addresses";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { decodeTxError } from "@/lib/errors";

const USDC_DECIMALS = 6;

/** Repay (partially or fully) the connected wallet's USDC debt. */
export function RepayForm() {
  const { address, isConnected } = useAccount();
  const { writeChainId, wrongChain } = useChainGuard();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const vaultAddr = vault.address ?? undefined;
  const usdcAddr = addresses.usdc ?? undefined;
  const enabled = isConnected && !!vaultAddr && !!address;

  const { data: debt } = useReadContract({
    address: vaultAddr,
    abi: vault.abi,
    functionName: "debtOf",
    args: address ? [address] : undefined,
    query: { enabled },
  });
  const { data: balance } = useReadContract({
    address: usdcAddr,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: enabled && !!usdcAddr },
  });
  const { data: allowance } = useReadContract({
    address: usdcAddr,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && vaultAddr ? [address, vaultAddr] : undefined,
    query: { enabled: enabled && !!usdcAddr },
  });

  const debtBn = (debt as bigint | undefined) ?? 0n;
  const parsed = useMemo(() => {
    if (!amount) return 0n;
    try {
      return parseUnits(amount, USDC_DECIMALS);
    } catch {
      return 0n;
    }
  }, [amount]);

  const needsApproval = parsed > 0n && ((allowance as bigint | undefined) ?? 0n) < parsed;
  const { writeContract, isPending, error, data: txHash, reset } = useWriteContract();
  const { isLoading: isMining, isSuccess: isMined } = useWaitForTransactionReceipt({ hash: txHash });
  const canSubmit = enabled && isVaultDeployed() && parsed > 0n && !isPending && !isMining && !wrongChain;

  function approve() {
    if (!usdcAddr || !vaultAddr) return;
    reset();
    writeContract({ chainId: writeChainId, address: usdcAddr, abi: erc20Abi, functionName: "approve", args: [vaultAddr, parsed] });
  }
  function repay() {
    if (!vaultAddr) return;
    reset();
    writeContract(
      { chainId: writeChainId, address: vaultAddr, abi: vault.abi, functionName: "repay", args: [parsed] },
      { onSuccess: () => setTimeout(() => void queryClient.invalidateQueries(), 2500) },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Repay debt</CardTitle>
        <CardDescription>Pay down or fully close your USDC loan.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-[color:var(--color-muted-foreground)]">Outstanding debt</span>
          <span className="font-medium tabular-nums">{formatUnits(debtBn, USDC_DECIMALS)} USDC</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="repay-amount" className="text-sm font-medium">USDC amount</label>
            <button
              type="button"
              className="text-xs font-medium text-[color:var(--color-primary)] hover:underline disabled:opacity-50"
              onClick={() => setAmount(formatUnits(debtBn, USDC_DECIMALS))}
              disabled={debtBn === 0n}
            >
              Max (full)
            </button>
          </div>
          <Input
            id="repay-amount"
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoComplete="off"
          />
          <p className="text-xs text-[color:var(--color-muted-foreground)]">
            Wallet balance: {balance !== undefined ? `${formatUnits(balance as bigint, USDC_DECIMALS)} USDC` : "—"}
          </p>
        </div>

        {error ? (
          <Alert tone="danger">
            <AlertTitle>Transaction failed</AlertTitle>
            <AlertDescription>{decodeTxError(error)}</AlertDescription>
          </Alert>
        ) : null}
        {isMined ? (
          <Alert tone="success">
            <AlertTitle>Repayment confirmed</AlertTitle>
            <AlertDescription>Your debt has been reduced and your health factor improved.</AlertDescription>
          </Alert>
        ) : null}

        {needsApproval ? (
          <Button onClick={approve} disabled={!canSubmit}>
            {isPending || isMining ? "Approving…" : "Approve USDC"}
          </Button>
        ) : (
          <Button onClick={repay} disabled={!canSubmit || debtBn === 0n}>
            {isPending || isMining ? "Repaying…" : "Repay"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
