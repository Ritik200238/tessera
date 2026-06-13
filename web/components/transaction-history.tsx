"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { formatUnits, parseEventLogs } from "viem";
import { vault } from "@/lib/contracts";
import { addresses } from "@/lib/addresses";
import { getTxUrl } from "@/lib/chain";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

/**
 * Per-user on-chain history (A5) — the core trust artifact for a wallet that has
 * granted the agent a spend allowance. Indexes the vault's events for the
 * connected wallet via chunked getLogs (public RPCs cap the range, so we scan a
 * bounded recent window), decodes them, and lists supplies/withdraws/borrows/
 * repays/collateral moves/liquidations with active-chain explorer tx links. Agent
 * auto-repays surface here too (they emit Repay).
 */
const LOOKBACK = 45_000n;
const CHUNK = 9_000n;

interface Row {
  kind: string;
  detail: string;
  block: bigint;
  tx: string;
}

const LABELS: Record<string, string> = {
  Deposit: "Supply",
  Withdraw: "Withdraw",
  Borrow: "Borrow",
  Repay: "Repay",
  CollateralDeposit: "Collateral in",
  CollateralWithdraw: "Collateral out",
  Liquidate: "Liquidation",
};

function tokenSymbol(addr: string): string {
  const t = addresses.collateralTokens.find((x) => x.address.toLowerCase() === addr.toLowerCase());
  return t?.symbol ?? "collateral";
}

function summarize(name: string, a: Record<string, unknown>): string {
  const num = (v: unknown, dec: number) =>
    typeof v === "bigint" ? Number(formatUnits(v, dec)).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "";
  switch (name) {
    case "Deposit":
      return `Supplied ${num(a.assets, 6)} USDC`;
    case "Withdraw":
      return `Withdrew ${num(a.assets, 6)} USDC`;
    case "Borrow":
      return `Borrowed ${num(a.amount, 6)} USDC`;
    case "Repay":
      return `Repaid ${num(a.amount, 6)} USDC`;
    case "CollateralDeposit":
      return `Deposited ${num(a.amount, 18)} ${tokenSymbol(String(a.token ?? ""))}`;
    case "CollateralWithdraw":
      return `Withdrew ${num(a.amount, 18)} ${tokenSymbol(String(a.token ?? ""))}`;
    case "Liquidate":
      return `Liquidation · ${num(a.repayAmount, 6)} USDC repaid`;
    default:
      return name;
  }
}

export function TransactionHistory() {
  const { address, isConnected } = useAccount();
  const client = usePublicClient();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected || !address || !client || !vault.address) {
      setRows(null);
      return;
    }
    const pc = client;
    const vaultAddr = vault.address;
    const user = address.toLowerCase();
    let cancelled = false;
    setRows(null);
    setErr(null);
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
        const out: Row[] = [];
        for (const ev of parsed) {
          const name = ev.eventName as string;
          if (!(name in LABELS)) continue;
          const a = (ev.args ?? {}) as Record<string, unknown>;
          const involves = Object.values(a).some(
            (v) => typeof v === "string" && v.toLowerCase() === user,
          );
          if (!involves) continue;
          out.push({
            kind: LABELS[name]!,
            detail: summarize(name, a),
            block: ev.blockNumber ?? 0n,
            tx: ev.transactionHash ?? "",
          });
        }
        out.sort((x, y) => (y.block > x.block ? 1 : y.block < x.block ? -1 : 0));
        if (!cancelled) setRows(out.slice(0, 50));
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, isConnected, client]);

  if (!isConnected) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your history</CardTitle>
        <CardDescription>
          Your on-chain activity (recent ~{Number(LOOKBACK / 1000n)}k blocks), newest first — agent auto-repays included.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {err ? (
          <p className="text-[color:var(--color-muted-foreground)]">Couldn&apos;t load history: {err}</p>
        ) : rows === null ? (
          <p className="text-[color:var(--color-muted-foreground)]">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-[color:var(--color-muted-foreground)]">
            No activity yet. Your supplies, borrows, repays, and any agent auto-repays will appear here.
          </p>
        ) : (
          <ul className="divide-y divide-[color:var(--color-border)]">
            {rows.map((r, i) => (
              <li key={`${r.tx}-${i}`} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <span className="rounded bg-[color:var(--color-muted)] px-1.5 py-0.5 text-xs font-medium">{r.kind}</span>{" "}
                  <span className="tabular-nums">{r.detail}</span>
                </div>
                {r.tx ? (
                  <a
                    href={getTxUrl(r.tx)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs underline text-[color:var(--color-muted-foreground)]"
                  >
                    tx ↗
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
