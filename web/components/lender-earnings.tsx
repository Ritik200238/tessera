"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient, useReadContracts } from "wagmi";
import { formatUnits, parseEventLogs } from "viem";
import { vault } from "@/lib/contracts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatBps } from "@/lib/format";

/**
 * Lender position + earnings/P&L (A4). The primary persona is a lender, so show
 * the live redeemable value (the contract's virtual-offset convertToAssets,
 * computed client-side), the net amount deposited (cost basis from on-chain
 * Deposit/Withdraw events — robust to cache clears), earnings since deposit, and
 * the projected annual yield at the current supply APY.
 */
const LOOKBACK = 45_000n;
const CHUNK = 9_000n;
const VIRTUAL_SHARES = 1_000_000n; // matches the vault's decimals_offset = 6

export function LenderEarnings() {
  const { address, isConnected } = useAccount();
  const client = usePublicClient();
  const [basis, setBasis] = useState<bigint | null>(null);

  const enabled = isConnected && vault.address !== null && address !== undefined;
  const { data } = useReadContracts({
    contracts: enabled
      ? [
          { address: vault.address!, abi: vault.abi, functionName: "balanceOf", args: [address!] },
          { address: vault.address!, abi: vault.abi, functionName: "totalSupply" },
          { address: vault.address!, abi: vault.abi, functionName: "totalAssets" },
          { address: vault.address!, abi: vault.abi, functionName: "supplyRateBps" },
        ]
      : [],
    query: { enabled },
  });
  const shares = (data?.[0]?.result as bigint | undefined) ?? 0n;
  const totalSupply = (data?.[1]?.result as bigint | undefined) ?? 0n;
  const totalAssets = (data?.[2]?.result as bigint | undefined) ?? 0n;
  // supplyRateBps is a small uint, so viem decodes it as a JS number — coerce to
  // bigint before any bigint arithmetic (mixing the two throws at runtime).
  const supplyBps = BigInt((data?.[3]?.result as bigint | number | undefined) ?? 0);

  // convertToAssets, round-down, with the vault's virtual offset.
  const value = (shares * (totalAssets + 1n)) / (totalSupply + VIRTUAL_SHARES);

  // Cost basis = Σ Deposit.assets − Σ Withdraw.assets for this wallet (6dp USDC).
  useEffect(() => {
    if (!enabled || !client || !vault.address) {
      setBasis(null);
      return;
    }
    const pc = client;
    const vaultAddr = vault.address;
    const user = address!.toLowerCase();
    let cancelled = false;
    setBasis(null);
    (async () => {
      try {
        const head = await pc.getBlockNumber();
        const start = head > LOOKBACK ? head - LOOKBACK : 0n;
        const logs: Awaited<ReturnType<typeof pc.getLogs>> = [];
        for (let from = start; from <= head; from = from + CHUNK + 1n) {
          const to = from + CHUNK > head ? head : from + CHUNK;
          logs.push(...(await pc.getLogs({ address: vaultAddr, fromBlock: from, toBlock: to })));
        }
        const parsed = parseEventLogs({ abi: vault.abi, logs });
        let net = 0n;
        for (const ev of parsed) {
          const a = (ev.args ?? {}) as Record<string, unknown>;
          if (typeof a.owner !== "string" || a.owner.toLowerCase() !== user) continue;
          if (ev.eventName === "Deposit" && typeof a.assets === "bigint") net += a.assets;
          else if (ev.eventName === "Withdraw" && typeof a.assets === "bigint") net -= a.assets;
        }
        if (!cancelled) setBasis(net > 0n ? net : 0n);
      } catch {
        if (!cancelled) setBasis(0n);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, enabled, client]);

  if (!isConnected || shares === 0n) return null;

  const earnings = basis !== null ? (value > basis ? value - basis : 0n) : null;
  const annual = (value * supplyBps) / 10_000n;
  const fmt = (v: bigint) => Number(formatUnits(v, 6)).toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your supplied position</CardTitle>
        <CardDescription>Live value, earnings since deposit, and projected yield at the current APY.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Metric label="Current value" value={`$${fmt(value)}`} />
        <Metric label="Net deposited" value={basis !== null ? `$${fmt(basis)}` : "…"} />
        <Metric label="Earnings" value={earnings !== null ? `+$${fmt(earnings)}` : "…"} tone="safe" />
        <Metric label="Projected / yr" value={`~$${fmt(annual)} · ${formatBps(supplyBps)}`} />
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "safe" }) {
  return (
    <div className="rounded-md bg-[color:var(--color-muted)] px-3 py-2">
      <p className="text-xs text-[color:var(--color-muted-foreground)]">{label}</p>
      <p className={"font-medium tabular-nums" + (tone === "safe" ? " text-[color:var(--color-safe-fg)]" : "")}>
        {value}
      </p>
    </div>
  );
}
