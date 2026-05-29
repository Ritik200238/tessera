"use client";

import { useMemo, useState } from "react";
import { type Address, erc20Abi, parseUnits } from "viem";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { vault, isVaultDeployed } from "@/lib/contracts";
import { formatBps, formatToken } from "@/lib/format";
import { ConnectButton } from "./connect-button";

interface CollateralToken {
  symbol: string;
  address: `0x${string}`;
  decimals: number;
}

// Conservative defaults the UI can show before the deploy has happened.
// All write actions become disabled when `isVaultDeployed()` is false.
const FALLBACK_TOKENS: CollateralToken[] = [
  { symbol: "tAAPL", address: "0x0000000000000000000000000000000000000000", decimals: 18 },
  { symbol: "tTSLA", address: "0x0000000000000000000000000000000000000000", decimals: 18 },
  { symbol: "tSPY",  address: "0x0000000000000000000000000000000000000000", decimals: 18 },
];

export function DepositForm({ tokens }: { tokens: CollateralToken[] }) {
  const list = tokens.length > 0 ? tokens : FALLBACK_TOKENS;
  const [tokenIdx, setTokenIdx] = useState(0);
  const [amount, setAmount] = useState("");
  const token = list[tokenIdx]!;

  const { address, isConnected } = useAccount();
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();
  const { isLoading: isMining, isSuccess: isMined } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const { data: balance } = useReadContract({
    address: token.address as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && token.address !== "0x0000000000000000000000000000000000000000" },
  });

  const { data: allowance } = useReadContract({
    address: token.address as Address,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && vault.address ? [address, vault.address] : undefined,
    query: {
      enabled:
        isConnected &&
        token.address !== "0x0000000000000000000000000000000000000000" &&
        vault.address !== null,
    },
  });

  const { data: supplyBps } = useReadContract({
    address: vault.address ?? undefined,
    abi: vault.abi,
    functionName: "supplyRateBps",
    query: { enabled: vault.address !== null },
  });

  const parsedAmount = useMemo(() => {
    if (!amount) return 0n;
    try {
      return parseUnits(amount, token.decimals);
    } catch {
      return 0n;
    }
  }, [amount, token.decimals]);

  const needsApproval =
    parsedAmount > 0n && (allowance as bigint | undefined ?? 0n) < parsedAmount;

  const canSubmit =
    isConnected && isVaultDeployed() && parsedAmount > 0n && !isPending && !isMining;

  function approve() {
    if (!vault.address) return;
    reset();
    writeContract({
      address: token.address as Address,
      abi: erc20Abi,
      functionName: "approve",
      args: [vault.address, parsedAmount],
    });
  }

  function deposit() {
    if (!vault.address) return;
    reset();
    writeContract({
      address: vault.address,
      abi: vault.abi,
      functionName: "depositCollateral",
      args: [token.address, parsedAmount],
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Deposit</CardTitle>
          <CardDescription>Select a token, choose an amount, and approve + deposit.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <fieldset>
            <legend className="text-sm font-medium">Asset</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {list.map((t, i) => (
                <button
                  type="button"
                  key={t.symbol}
                  onClick={() => setTokenIdx(i)}
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
          </fieldset>

          <div className="space-y-2">
            <label htmlFor="amount" className="text-sm font-medium">
              Amount
            </label>
            <Input
              id="amount"
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-[color:var(--color-muted-foreground)]">
              Balance: {balance !== undefined ? formatToken(balance as bigint, token.decimals, { symbol: token.symbol }) : "—"}
            </p>
          </div>

          {!isVaultDeployed() && (
            <Alert tone="warning">
              <AlertTitle>Vault not yet deployed</AlertTitle>
              <AlertDescription>
                The deposit transaction will be enabled as soon as the contracts ship to this
                environment. You can still pick an asset and an amount to preview the flow.
              </AlertDescription>
            </Alert>
          )}

          {error ? (
            <Alert tone="danger">
              <AlertTitle>Transaction failed</AlertTitle>
              <AlertDescription>{shortenError(error)}</AlertDescription>
            </Alert>
          ) : null}

          {isMined ? (
            <Alert tone="success">
              <AlertTitle>Deposit confirmed</AlertTitle>
              <AlertDescription>Your collateral is now backing your borrowing power.</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            {!isConnected ? (
              <ConnectButton />
            ) : needsApproval ? (
              <Button onClick={approve} disabled={!canSubmit}>
                {isPending || isMining ? "Approving…" : `Approve ${token.symbol}`}
              </Button>
            ) : (
              <Button onClick={deposit} disabled={!canSubmit}>
                {isPending || isMining ? "Depositing…" : "Deposit"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Expected return</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Current supply APY">
            {supplyBps !== undefined ? formatBps(supplyBps as bigint) : "—"}
          </Row>
          <Row label="Liquidation threshold">80%</Row>
          <Row label="Max LTV">70%</Row>
          <p className="pt-3 text-xs text-[color:var(--color-muted-foreground)]">
            Yields are variable and depend on lender-pool utilization. Your collateral does not
            earn yield directly — it unlocks USDC borrow power. The AI agent watches your
            position around the clock.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between border-b border-[color:var(--color-border)] pb-2 last:border-none last:pb-0">
      <span className="text-[color:var(--color-muted-foreground)]">{label}</span>
      <span className="font-medium tabular-nums">{children}</span>
    </div>
  );
}

function shortenError(err: { message?: string } | Error): string {
  const msg = "message" in err && err.message ? err.message : "Unknown error";
  return msg.length > 200 ? `${msg.slice(0, 200)}…` : msg;
}
