"use client";

import { useMemo, useState } from "react";
import { type Address, formatUnits, parseUnits } from "viem";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { vault, isVaultDeployed } from "@/lib/contracts";
import { useChainGuard } from "@/lib/use-chain-guard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { decodeTxError } from "@/lib/errors";

interface CollateralToken {
  symbol: string;
  address: `0x${string}`;
  decimals: number;
}

/** Withdraw deposited collateral. The vault rejects withdrawals that would push
 *  health below the safe threshold — that revert is decoded into plain English. */
export function WithdrawCollateralForm({ tokens }: { tokens: CollateralToken[] }) {
  const { address, isConnected } = useAccount();
  const { writeChainId, wrongChain } = useChainGuard();
  const queryClient = useQueryClient();
  const [tokenIdx, setTokenIdx] = useState(0);
  const [amount, setAmount] = useState("");
  const token = tokens[tokenIdx];
  const vaultAddr = vault.address ?? undefined;
  const enabled = isConnected && !!vaultAddr && !!address && !!token;

  const { data: deposited } = useReadContract({
    address: vaultAddr,
    abi: vault.abi,
    functionName: "collateralOf",
    args: address && token ? [address, token.address] : undefined,
    query: { enabled },
  });

  const depositedBn = (deposited as bigint | undefined) ?? 0n;
  const parsed = useMemo(() => {
    if (!amount || !token) return 0n;
    try {
      return parseUnits(amount, token.decimals);
    } catch {
      return 0n;
    }
  }, [amount, token]);

  const { writeContract, isPending, error, data: txHash, reset } = useWriteContract();
  const { isLoading: isMining, isSuccess: isMined } = useWaitForTransactionReceipt({ hash: txHash });
  const canSubmit = enabled && isVaultDeployed() && parsed > 0n && !isPending && !isMining && !wrongChain;

  function withdraw() {
    if (!vaultAddr || !token) return;
    reset();
    writeContract(
      { chainId: writeChainId, address: vaultAddr, abi: vault.abi, functionName: "withdrawCollateral", args: [token.address as Address, parsed] },
      { onSuccess: () => setTimeout(() => void queryClient.invalidateQueries(), 2500) },
    );
  }

  if (tokens.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Withdraw collateral</CardTitle>
        <CardDescription>Take back collateral, as long as your loan stays healthy.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {tokens.map((t, i) => (
            <button
              type="button"
              key={t.symbol}
              onClick={() => { setTokenIdx(i); setAmount(""); }}
              aria-pressed={i === tokenIdx}
              className={
                "rounded-md border px-3 py-2 text-sm font-medium transition-colors " +
                (i === tokenIdx
                  ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]"
                  : "border-[color:var(--color-border)] hover:bg-[color:var(--color-muted)]")
              }
            >
              {t.symbol}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="wc-amount" className="text-sm font-medium">Amount</label>
            <button
              type="button"
              className="text-xs font-medium text-[color:var(--color-primary)] hover:underline disabled:opacity-50"
              onClick={() => token && setAmount(formatUnits(depositedBn, token.decimals))}
              disabled={depositedBn === 0n}
            >
              Max
            </button>
          </div>
          <Input
            id="wc-amount"
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoComplete="off"
          />
          <p className="text-xs text-[color:var(--color-muted-foreground)]">
            Deposited: {token ? `${formatUnits(depositedBn, token.decimals)} ${token.symbol}` : "—"}
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
            <AlertTitle>Collateral withdrawn</AlertTitle>
            <AlertDescription>The tokens are back in your wallet.</AlertDescription>
          </Alert>
        ) : null}

        <Button onClick={withdraw} disabled={!canSubmit || depositedBn === 0n}>
          {isPending || isMining ? "Withdrawing…" : "Withdraw"}
        </Button>
      </CardContent>
    </Card>
  );
}
