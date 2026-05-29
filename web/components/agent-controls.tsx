"use client";

import { useMemo, useState } from "react";
import { erc20Abi, formatUnits, parseUnits } from "viem";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { vault, isVaultDeployed } from "@/lib/contracts";
import { addresses } from "@/lib/addresses";
import { ConnectButton } from "./connect-button";

const USDC_DECIMALS = 6;

/**
 * Active Protection control (auto-repay opt-in).
 *
 * "Enabling" protection is a plain USDC approval to the vault: that allowance is
 * the spending cap AND the kill switch (revoke = disable). The agent's
 * `agentRepayFor` can only ever *reduce* the user's debt using these
 * pre-approved funds — never withdraw them. This component makes that boundary
 * legible: code decides *when* to repay; the user decides *how much* it may use.
 */
export function AgentControls() {
  const usdc = addresses.usdc;
  const [amount, setAmount] = useState("");
  const { address, isConnected } = useAccount();
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();
  const { isLoading: isMining, isSuccess: isMined } = useWaitForTransactionReceipt({ hash: txHash });

  const ready = isConnected && !!usdc && vault.address !== null && !!address;

  const { data: allowance } = useReadContract({
    address: usdc ?? undefined,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && vault.address ? [address, vault.address] : undefined,
    query: { enabled: ready },
  });

  const cap = (allowance as bigint | undefined) ?? 0n;
  const protectionOn = cap > 0n;

  const parsed = useMemo(() => {
    if (!amount) return 0n;
    try {
      return parseUnits(amount, USDC_DECIMALS);
    } catch {
      return 0n;
    }
  }, [amount]);

  function setCap(value: bigint) {
    if (!vault.address || !usdc) return;
    reset();
    writeContract({
      address: usdc,
      abi: erc20Abi,
      functionName: "approve",
      args: [vault.address, value],
    });
  }

  const canEnable = ready && isVaultDeployed() && parsed > 0n && !isPending && !isMining;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Protection</CardTitle>
        <CardDescription>
          Let the agent auto-repay from USDC you pre-approve, stopping a liquidation before it happens.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={`size-2.5 rounded-full ${protectionOn ? "bg-emerald-500" : "bg-zinc-400"}`}
          />
          <span className="font-medium">{protectionOn ? "Protected" : "Off"}</span>
          {protectionOn ? (
            <span className="text-[color:var(--color-muted-foreground)] tabular-nums">
              cap {Number(formatUnits(cap, USDC_DECIMALS)).toLocaleString()} USDC
            </span>
          ) : null}
        </div>

        <p className="text-[color:var(--color-muted-foreground)]">
          The agent can <strong>only reduce your debt</strong> with the USDC you approve here — it can
          never withdraw or move your funds. Your approval is the spending cap and the kill switch.{" "}
          <span className="font-medium text-[color:var(--color-foreground)]">
            Code decides when; you decide how much.
          </span>
        </p>

        <div className="space-y-2">
          <label htmlFor="cap" className="font-medium">
            Approve up to (USDC)
          </label>
          <Input
            id="cap"
            inputMode="decimal"
            placeholder="e.g. 5000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoComplete="off"
          />
        </div>

        {!isVaultDeployed() ? (
          <Alert tone="warning">
            <AlertTitle>Vault not deployed</AlertTitle>
            <AlertDescription>
              Protection becomes available once the vault is live in this environment.
            </AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert tone="danger">
            <AlertTitle>Transaction failed</AlertTitle>
            <AlertDescription>{shortenError(error)}</AlertDescription>
          </Alert>
        ) : null}

        {isMined ? (
          <Alert tone="success">
            <AlertTitle>Saved on-chain</AlertTitle>
            <AlertDescription>Your protection setting is now live.</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {!isConnected ? (
            <ConnectButton />
          ) : (
            <>
              <Button onClick={() => setCap(parsed)} disabled={!canEnable}>
                {isPending || isMining
                  ? "Confirming…"
                  : protectionOn
                    ? "Update cap"
                    : "Enable protection"}
              </Button>
              {protectionOn ? (
                <button
                  type="button"
                  onClick={() => setCap(0n)}
                  disabled={!isVaultDeployed() || isPending || isMining}
                  className="inline-flex h-10 items-center rounded-md border border-[color:var(--color-border)] px-4 text-sm font-medium text-[color:var(--color-liquidating-fg)] hover:bg-[color:var(--color-muted)] disabled:opacity-50"
                >
                  Kill switch (disable)
                </button>
              ) : null}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function shortenError(err: { message?: string } | Error): string {
  const msg = "message" in err && err.message ? err.message : "Unknown error";
  return msg.length > 200 ? `${msg.slice(0, 200)}…` : msg;
}
