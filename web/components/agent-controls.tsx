"use client";

import { useEffect, useMemo, useState } from "react";
import { erc20Abi, formatUnits, parseUnits } from "viem";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useChainGuard } from "@/lib/use-chain-guard";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { vault, isVaultDeployed } from "@/lib/contracts";
import { addresses } from "@/lib/addresses";
import { decodeTxError } from "@/lib/errors";
import { track } from "@/lib/analytics";
import { ConnectButton } from "./connect-button";

const USDC_DECIMALS = 6;
const fmtUsdc = (v: bigint) => Number(formatUnits(v, USDC_DECIMALS)).toLocaleString("en-US", { maximumFractionDigits: 2 });

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
  const { writeChainId } = useChainGuard();
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();
  const { isLoading: isMining, isSuccess: isMined } = useWaitForTransactionReceipt({ hash: txHash });

  // Freshness: refetch reads once the approve mines so the Protected state,
  // ApprovalsPanel, and ProtectionPreview all update without a reload (QA M5/M7).
  const queryClient = useQueryClient();
  useEffect(() => {
    if (isMined) void queryClient.invalidateQueries();
  }, [isMined, queryClient]);

  const ready = isConnected && !!usdc && vault.address !== null && !!address;

  const { data: allowance } = useReadContract({
    address: usdc ?? undefined,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && vault.address ? [address, vault.address] : undefined,
    query: { enabled: ready },
  });

  const { data: debt } = useReadContract({
    address: vault.address ?? undefined,
    abi: vault.abi,
    functionName: "debtOf",
    args: address ? [address] : undefined,
    query: { enabled: ready },
  });

  const cap = (allowance as bigint | undefined) ?? 0n;
  const protectionOn = cap > 0n;
  const debtBn = (debt as bigint | undefined) ?? 0n;
  // Recommended cap: ~125% of current debt — enough headroom for the agent to
  // restore health after a gap, without a scary unbounded approval.
  const suggested = debtBn > 0n ? (debtBn * 125n) / 100n : 0n;

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
    if (value > 0n) track("protection_enabled");
    writeContract({
      chainId: writeChainId,
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
            className="size-2.5 rounded-full"
            style={{ background: protectionOn ? "var(--color-safe-fg)" : "var(--faint)" }}
          />
          <span className="font-medium">{protectionOn ? "Protected — this wallet is covered" : "Off"}</span>
          {protectionOn ? (
            <span className="text-[color:var(--color-muted-foreground)] tabular-nums">
              cap {fmtUsdc(cap)} USDC
            </span>
          ) : null}
        </div>
        {protectionOn ? (
          <p className="text-xs text-[color:var(--color-muted-foreground)]">
            The agent can draw up to {fmtUsdc(cap)} USDC from your wallet, and only ever to repay your
            own loan. Enforced on-chain — revoke any time with the kill switch below.
          </p>
        ) : null}

        <p className="text-[color:var(--color-muted-foreground)]">
          The agent can <strong>only reduce your debt</strong> with the USDC you approve here — it can
          never withdraw or move your funds. Your approval is the spending cap and the kill switch.{" "}
          <span className="font-medium text-[color:var(--color-foreground)]">
            Code decides when; you decide how much.
          </span>
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="cap" className="font-medium">
              Approve up to (USDC)
            </label>
            {suggested > 0n ? (
              <button
                type="button"
                onClick={() => setAmount(formatUnits(suggested, USDC_DECIMALS))}
                className="rounded-full border border-[color:var(--color-border)] px-2.5 py-0.5 text-xs font-medium hover:bg-[color:var(--color-muted)]"
              >
                Recommended · {fmtUsdc(suggested)}
              </button>
            ) : null}
          </div>
          <Input
            id="cap"
            inputMode="decimal"
            placeholder={suggested > 0n ? fmtUsdc(suggested) : "e.g. 5000"}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoComplete="off"
          />
          <p className="text-xs text-[color:var(--color-muted-foreground)]">
            {suggested > 0n
              ? `Recommended ≈ 125% of your current debt (${fmtUsdc(debtBn)} USDC) — leaves the agent room to restore your health after a gap.`
              : "Tip: approve a little more than your loan so the agent has room to act."}
          </p>
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
            <AlertDescription>{decodeTxError(error)}</AlertDescription>
          </Alert>
        ) : null}

        {isMined ? (
          <Alert tone="success">
            <AlertTitle>Protection is live for this wallet</AlertTitle>
            <AlertDescription>
              The agent is now watching this position and can auto-repay up to your approved cap to
              prevent a liquidation. You can revoke any time.
            </AlertDescription>
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
