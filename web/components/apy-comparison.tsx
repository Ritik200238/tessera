"use client";

import { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { vault, isVaultDeployed } from "@/lib/contracts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

/**
 * APY comparison (A3) — Tessera's live USDC supply APY vs Aave/Spark/Morpho.
 * The Aave Migrator switches on yield-vs-Aave-at-comparable-risk, so this is the
 * single most important adoption signal. Competitor APYs come from the cached
 * /api/yields route (DefiLlama). Honest about the risk delta; degrades to just
 * Tessera's number if the upstream is unavailable.
 */
interface PoolApy {
  key: string;
  label: string;
  apy: number | null;
}

export function ApyComparison() {
  const { data: supplyBps } = useReadContract({
    address: vault.address ?? undefined,
    abi: vault.abi,
    functionName: "supplyRateBps",
    query: { enabled: isVaultDeployed(), refetchInterval: 30_000 },
  });
  const tesseraApy = supplyBps !== undefined ? Number(supplyBps as bigint) / 100 : null;

  const [pools, setPools] = useState<PoolApy[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/yields")
      .then((r) => r.json())
      .then((j: { pools?: PoolApy[] }) => {
        if (!cancelled) setPools(j.pools ?? []);
      })
      .catch(() => {
        if (!cancelled) setPools([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows: PoolApy[] = [
    { key: "tessera", label: "Tessera", apy: tesseraApy },
    ...(pools ?? []),
  ];
  const max = Math.max(1, ...rows.map((r) => r.apy ?? 0));

  return (
    <Card>
      <CardHeader>
        <CardTitle>USDC supply APY · vs the market</CardTitle>
        <CardDescription>
          Live Tessera supply rate next to the major money markets (Aave / Spark / Morpho, via
          DefiLlama). Tessera&apos;s yield comes from tokenized-equity borrow demand — a different,
          agent-protected risk profile, not a free lunch.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-3 text-sm">
            <span className={"w-20 shrink-0" + (r.key === "tessera" ? " font-semibold" : "")}>{r.label}</span>
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-[color:var(--color-muted)]">
              <div
                className={
                  "h-full rounded-full " +
                  (r.key === "tessera"
                    ? "bg-[color:var(--color-primary)]"
                    : "bg-[color:var(--color-muted-foreground)]/40")
                }
                style={{ width: `${r.apy != null ? Math.max(2, (r.apy / max) * 100) : 0}%` }}
              />
            </div>
            <span className="w-16 shrink-0 text-right font-medium tabular-nums">
              {r.apy != null ? `${r.apy.toFixed(2)}%` : pools === null && r.key !== "tessera" ? "…" : "—"}
            </span>
          </div>
        ))}
        <p className="pt-1 text-xs text-[color:var(--color-muted-foreground)]">
          Comparison APYs are live supply rates from DefiLlama and move with the market. Tessera is
          testnet + unaudited — see <a className="underline" href="/security">Security</a>.
        </p>
      </CardContent>
    </Card>
  );
}
