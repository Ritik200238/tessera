"use client";

import { useState } from "react";
import { type Address } from "viem";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { Droplets, Check } from "lucide-react";
import { faucet, isFaucetAvailable } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { decodeTxError } from "@/lib/errors";
import { ConnectButton } from "./connect-button";

/**
 * "Get test funds" — calls the testnet faucet, minting a bundle of test USDC +
 * tokenized stocks to the connected wallet so anyone can drive the full flow.
 * Rate-limited on-chain by a per-address cooldown. Renders nothing when no
 * faucet is configured (e.g. mainnet).
 */
export function FaucetButton({
  variant = "primary",
  className,
}: {
  variant?: "primary" | "outline";
  className?: string;
}) {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const [done, setDone] = useState(false);

  const { data: nextAt } = useReadContract({
    address: faucet.address ?? undefined,
    abi: faucet.abi,
    functionName: "nextDripAt",
    args: address ? [address] : undefined,
    query: { enabled: isFaucetAvailable() && !!address },
  });

  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();
  const { isLoading: isMining } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  if (!isFaucetAvailable()) return null;

  const nextSec = Number((nextAt as bigint | undefined) ?? 0n);
  const nowSec = Math.floor(Date.now() / 1000);
  const onCooldown = nextSec > nowSec;
  const minsLeft = onCooldown ? Math.ceil((nextSec - nowSec) / 60) : 0;
  const busy = isPending || isMining;

  function drip() {
    if (!faucet.address) return;
    reset();
    setDone(false);
    writeContract(
      { address: faucet.address as Address, abi: faucet.abi, functionName: "drip" },
      {
        onSuccess: () => {
          // Refresh every cached read (balances, allowances, positions) once mined.
          setTimeout(() => {
            void queryClient.invalidateQueries();
            setDone(true);
          }, 2500);
        },
      },
    );
  }

  if (!isConnected) {
    return <ConnectButton />;
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant={variant}
        onClick={drip}
        disabled={busy || onCooldown}
      >
        {done ? (
          <Check aria-hidden className="size-4" />
        ) : (
          <Droplets aria-hidden className="size-4" />
        )}
        {busy
          ? "Sending test funds…"
          : done
            ? "Test funds sent"
            : onCooldown
              ? `Available in ${minsLeft}m`
              : "Get test funds"}
      </Button>
      {error ? (
        <p className="mt-1.5 text-xs text-[color:var(--color-danger-fg)]">{decodeTxError(error)}</p>
      ) : (
        <p className="mt-1.5 text-xs text-[color:var(--color-muted-foreground)]">
          Mints 10,000 test USDC + 100 each of tAAPL / tTSLA / tSPY to your wallet.
        </p>
      )}
    </div>
  );
}
