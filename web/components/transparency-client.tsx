"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { parseAbiItem, type Address, type Hex } from "viem";
import { vault, isVaultDeployed } from "@/lib/contracts";
import { addresses } from "@/lib/addresses";
import { useProtocolStats, formatUsdcUsd } from "@/lib/protocol";
import { formatBps, formatToken } from "@/lib/format";
import { ActionLog, type AgentAction } from "@/components/action-log";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

const LIQUIDATE_EVENT = parseAbiItem(
  "event Liquidate(address indexed borrower, address indexed liquidator, address indexed collateralToken, uint256 repayAmount, uint256 seizeAmount)",
);

interface Liq {
  borrower: string;
  collateralToken: string;
  repay: bigint;
  seize: bigint;
  tx: Hex;
}

const short = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);
const symbolFor = (addr: string) =>
  addresses.collateralTokens.find((t) => t.address.toLowerCase() === addr.toLowerCase())?.symbol ?? short(addr);

function Stat({ label, value, tone }: { label: string; value: string; tone?: "safe" | "brand" }) {
  const color = tone === "safe" ? "var(--color-safe-fg)" : tone === "brand" ? "var(--blue)" : "var(--ink)";
  return (
    <div className="px-5 py-4">
      <div className="text-xs uppercase tracking-wide text-[color:var(--color-muted-foreground)] mono">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold mono tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

export function TransparencyClient({ actions }: { actions: AgentAction[] }) {
  const stats = useProtocolStats();
  const live = stats.deployed && !stats.loading;
  const client = usePublicClient();
  const [liqs, setLiqs] = useState<Liq[] | null>(null);
  const [liqErr, setLiqErr] = useState(false);

  useEffect(() => {
    if (!client || !vault.address) return;
    let cancelled = false;
    (async () => {
      try {
        const head = await client.getBlockNumber();
        const from = head > 100_000n ? head - 100_000n : 0n;
        const logs = await client.getLogs({
          address: vault.address as Address,
          event: LIQUIDATE_EVENT,
          fromBlock: from,
          toBlock: "latest",
        });
        if (cancelled) return;
        setLiqs(
          logs.map((l) => ({
            borrower: String(l.args.borrower),
            collateralToken: String(l.args.collateralToken),
            repay: l.args.repayAmount ?? 0n,
            seize: l.args.seizeAmount ?? 0n,
            tx: l.transactionHash as Hex,
          })),
        );
      } catch {
        if (!cancelled) setLiqErr(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  if (!isVaultDeployed()) {
    return (
      <Alert tone="warning">
        <AlertTitle>Vault not deployed in this environment</AlertTitle>
        <AlertDescription>Transparency data will populate once the contracts are live.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Live protocol numbers</CardTitle>
          <CardDescription>Read straight from the vault — refreshed every 15 seconds.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-2 divide-x divide-y divide-[color:var(--color-border)] sm:grid-cols-3 lg:grid-cols-5 [&>*]:border-[color:var(--color-border)]">
            <Stat label="TVL" value={live ? formatUsdcUsd(stats.tvlUsdc) : "—"} />
            <Stat label="Total borrows" value={live ? formatUsdcUsd(stats.borrowsUsdc) : "—"} />
            <Stat label="Utilization" value={live ? `${(stats.utilBps / 100).toFixed(1)}%` : "—"} />
            <Stat label="Supply APY" value={live ? formatBps(stats.supplyBps) : "—"} tone="safe" />
            <Stat label="Borrow APR" value={live ? formatBps(stats.borrowBps) : "—"} tone="brand" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Liquidations</CardTitle>
            <CardDescription>Every liquidation on this vault, on-chain.</CardDescription>
          </CardHeader>
          <CardContent>
            {liqErr ? (
              <p className="text-sm text-[color:var(--color-muted-foreground)]">
                History is unavailable from the current RPC endpoint.
              </p>
            ) : liqs === null ? (
              <p className="text-sm text-[color:var(--color-muted-foreground)]">Loading…</p>
            ) : liqs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[color:var(--color-border)] p-6 text-center text-sm text-[color:var(--color-muted-foreground)]">
                No liquidations on this vault yet. When one happens, it appears here with its
                transaction — nothing is hidden.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[color:var(--color-border)]">
                <table className="w-full min-w-[420px] text-sm">
                  <thead className="bg-[color:var(--color-muted)] text-left text-xs uppercase tracking-wide text-[color:var(--color-muted-foreground)]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Borrower</th>
                      <th className="px-3 py-2 font-medium">Asset</th>
                      <th className="px-3 py-2 font-medium text-right">Repaid</th>
                      <th className="px-3 py-2 font-medium text-right">Seized</th>
                      <th className="px-3 py-2 font-medium text-right">Tx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liqs.map((l, i) => (
                      <tr key={`${l.tx}-${i}`} className="border-t border-[color:var(--color-border)]">
                        <td className="px-3 py-2 mono text-xs">{short(l.borrower)}</td>
                        <td className="px-3 py-2">{symbolFor(l.collateralToken)}</td>
                        <td className="px-3 py-2 text-right mono tabular-nums">
                          {formatToken(l.repay, 6, { fractionDigits: 2 })} USDC
                        </td>
                        <td className="px-3 py-2 text-right mono tabular-nums">
                          {formatToken(l.seize, 18, { fractionDigits: 4 })}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <a
                            className="mono text-xs text-[color:var(--blue)] hover:underline"
                            href={`https://sepolia.arbiscan.io/tx/${l.tx}`}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            {short(l.tx)}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agent activity</CardTitle>
            <CardDescription>Every alert and protective action the agent has taken.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionLog actions={actions} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Governance & principles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-[color:var(--color-muted-foreground)]">
          <p>
            <span className="font-medium text-[color:var(--color-foreground)]">No token, ever.</span> No airdrops,
            points, governance coin, or fee tiers. There is nothing to farm — only yield and credit.
          </p>
          <p>
            <span className="font-medium text-[color:var(--color-foreground)]">Non-custodial.</span> The smart
            contract holds funds, never Tessera. The agent acts only through permissioned entrypoints and the USDC
            allowances you sign — and can only ever reduce your debt.
          </p>
          <p>
            <span className="font-medium text-[color:var(--color-foreground)]">Conservative by design.</span> Per-asset
            LTVs of 40–60% and liquidation thresholds of 55–70% are sized to absorb overnight and weekend gaps.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
