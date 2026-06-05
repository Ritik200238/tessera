"use client";

import { useEffect, useState } from "react";
import { useReadContracts } from "wagmi";
import { vault, oracle, isVaultDeployed } from "@/lib/contracts";
import { addresses } from "@/lib/addresses";
import { assetMeta } from "@/lib/equities";
import { formatUsd8 } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketBadge } from "@/components/market-badge";

const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;

function rel(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export function RiskClient() {
  const tokens = addresses.collateralTokens;
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    setNowMs(Date.now());
    const i = setInterval(() => setNowMs(Date.now()), 5000);
    return () => clearInterval(i);
  }, []);

  const { data: params, isLoading: paramsLoading } = useReadContracts({
    contracts: vault.address
      ? tokens.map((t) => ({ address: vault.address!, abi: vault.abi, functionName: "assetParams", args: [t.address] }))
      : [],
    query: { enabled: !!vault.address && tokens.length > 0, refetchInterval: 30_000 },
  });

  const { data: feeds } = useReadContracts({
    contracts:
      oracle.address && tokens.length
        ? [
            { address: oracle.address, abi: oracle.abi, functionName: "maxAge" },
            ...tokens.map((t) => ({ address: oracle.address!, abi: oracle.abi, functionName: "getFeed", args: [t.address] })),
          ]
        : [],
    query: { enabled: !!oracle.address && tokens.length > 0, refetchInterval: 15_000 },
  });
  const maxAge = Number((feeds?.[0]?.result as bigint | undefined) ?? 0n);

  if (!isVaultDeployed()) {
    return (
      <Alert tone="warning">
        <AlertTitle>Vault not deployed in this environment</AlertTitle>
        <AlertDescription>Per-asset risk parameters will populate once the contracts are live.</AlertDescription>
      </Alert>
    );
  }

  const loading = paramsLoading || (params === undefined && tokens.length > 0);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Collateral risk parameters</CardTitle>
          <CardDescription>
            Conservative, per-asset limits that account for overnight and weekend gap risk. Read live
            from the vault.
          </CardDescription>
        </div>
        <MarketBadge />
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-[color:var(--color-muted-foreground)]">
              <tr>
                <th className="py-2 pr-3 font-medium">Asset</th>
                <th className="py-2 px-3 font-medium">Sector</th>
                <th className="py-2 px-3 font-medium text-right">Price</th>
                <th className="py-2 px-3 font-medium text-right">Max LTV</th>
                <th className="py-2 px-3 font-medium text-right">Liq. threshold</th>
                <th className="py-2 px-3 font-medium text-right">Liq. bonus</th>
                <th className="py-2 pl-3 font-medium text-right">Oracle</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t, i) => {
                const meta = assetMeta(t.symbol);
                const p = params?.[i]?.result as
                  | readonly [boolean, number, number, number, number]
                  | undefined;
                const feed = feeds?.[i + 1]?.result as
                  | readonly [bigint, bigint, bigint, boolean]
                  | undefined;
                const price = feed?.[0] ?? 0n;
                const updatedAt = feed ? Number(feed[1]) : 0;
                const initialized = feed?.[3] ?? false;
                const ageMs = nowMs !== null && updatedAt ? nowMs - updatedAt * 1000 : null;
                const stale = !initialized || (maxAge > 0 && ageMs !== null && ageMs / 1000 > maxAge);
                return (
                  <tr key={t.symbol} className="border-t border-[color:var(--color-border)]">
                    <td className="py-3 pr-3">
                      <div className="font-medium">{t.symbol}</div>
                      <div className="text-xs text-[color:var(--color-muted-foreground)]">{meta.name}</div>
                    </td>
                    <td className="py-3 px-3 text-[color:var(--color-muted-foreground)]">{meta.sector}</td>
                    <td className="py-3 px-3 text-right mono tabular-nums">
                      {loading ? <Skeleton className="h-4 w-16" /> : initialized ? formatUsd8(price) : "—"}
                    </td>
                    <td className="py-3 px-3 text-right mono tabular-nums">
                      {loading || !p ? <Skeleton className="h-4 w-10" /> : pct(p[2])}
                    </td>
                    <td className="py-3 px-3 text-right mono tabular-nums">
                      {loading || !p ? <Skeleton className="h-4 w-10" /> : pct(p[3])}
                    </td>
                    <td className="py-3 px-3 text-right mono tabular-nums">
                      {loading || !p ? <Skeleton className="h-4 w-8" /> : pct(p[4])}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="size-2 rounded-full"
                          style={{ background: stale ? "var(--color-liquidating-fg)" : "var(--color-safe-fg)" }}
                        />
                        {ageMs !== null ? rel(ageMs) : "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-[color:var(--color-muted-foreground)]">
          Health factor = (collateral × liquidation threshold) ÷ debt. Below 1.0 a position can be
          liquidated; the AI agent acts well before that. Prices use the last close — equities gap
          overnight and on weekends, which is why LTVs are deliberately conservative.
        </p>
      </CardContent>
    </Card>
  );
}
