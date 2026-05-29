"use client";

import { useEffect, useState } from "react";
import { useReadContracts } from "wagmi";
import { oracle, isVaultDeployed } from "@/lib/contracts";
import { addresses } from "@/lib/addresses";
import { activeChain } from "@/lib/chain";
import { useProtocolStats } from "@/lib/protocol";
import { formatUsd8 } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import type { AgentHealth } from "@/lib/agent";

function rel(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
const short = (a?: string | null) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : (a ?? "—"));

function Dot({ tone }: { tone: "safe" | "warn" | "danger" | "muted" }) {
  const c =
    tone === "safe"
      ? "var(--color-safe-fg)"
      : tone === "warn"
        ? "var(--color-watch-fg)"
        : tone === "danger"
          ? "var(--color-liquidating-fg)"
          : "var(--faint)";
  return <span aria-hidden className="inline-block size-2.5 rounded-[3px]" style={{ background: c }} />;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[color:var(--color-border)] py-2.5 last:border-none">
      <span className="text-[color:var(--color-muted-foreground)]">{label}</span>
      <span className="flex items-center gap-2 font-medium">{children}</span>
    </div>
  );
}

export function StatusClient({ agentHealth }: { agentHealth: AgentHealth }) {
  const stats = useProtocolStats();
  const tokens = addresses.collateralTokens;
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    setNowMs(Date.now());
    const i = setInterval(() => setNowMs(Date.now()), 5000);
    return () => clearInterval(i);
  }, []);

  const { data: oracleData } = useReadContracts({
    contracts:
      oracle.address && tokens.length
        ? [
            { address: oracle.address, abi: oracle.abi, functionName: "maxAge" },
            ...tokens.map((t) => ({
              address: oracle.address!,
              abi: oracle.abi,
              functionName: "getFeed",
              args: [t.address],
            })),
          ]
        : [],
    query: { enabled: !!oracle.address && tokens.length > 0, refetchInterval: 15_000 },
  });
  const maxAge = Number((oracleData?.[0]?.result as bigint | undefined) ?? 0n);

  const explorer = (a: string) => `https://sepolia.arbiscan.io/address/${a}`;
  const agentTone: "safe" | "warn" | "muted" = agentHealth.available
    ? agentHealth.ok
      ? "safe"
      : "warn"
    : "muted";
  const agentLabel = agentHealth.available ? (agentHealth.ok ? "Healthy" : "Degraded") : "Offline";

  if (!isVaultDeployed()) {
    return (
      <Alert tone="warning">
        <AlertTitle>Vault not deployed in this environment</AlertTitle>
        <AlertDescription>System status will populate once the contracts are live.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dot tone={stats.paused ? "danger" : "safe"} />
            Vault
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <Row label="State">
            <Dot tone={stats.paused ? "danger" : "safe"} />
            {stats.paused ? "Paused" : "Operational"}
          </Row>
          <Row label="Listed assets">
            <span className="mono">{stats.deployed ? stats.listedAssets : "—"}</span>
          </Row>
          <Row label="Contract">
            <a
              className="mono text-[color:var(--blue)] hover:underline"
              href={explorer(addresses.vault!)}
              target="_blank"
              rel="noreferrer noopener"
            >
              {short(addresses.vault)}
            </a>
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dot tone={agentTone} />
            Risk agent
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <Row label="Heartbeat">
            <Dot tone={agentTone} />
            {agentLabel}
          </Row>
          <Row label="Last tick">
            <span className="mono">
              {agentHealth.lastTickAt && nowMs !== null
                ? rel(nowMs - Date.parse(agentHealth.lastTickAt))
                : "—"}
            </span>
          </Row>
          <Row label="Errors (24h)">
            <span className="mono">{agentHealth.available ? agentHealth.errors24h : "—"}</span>
          </Row>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Oracle freshness</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {tokens.length === 0 ? (
            <p className="text-[color:var(--color-muted-foreground)]">No collateral assets configured.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px]">
                <thead className="text-left text-xs uppercase tracking-wide text-[color:var(--color-muted-foreground)]">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Asset</th>
                    <th className="py-2 px-3 font-medium text-right">Price</th>
                    <th className="py-2 px-3 font-medium text-right">Updated</th>
                    <th className="py-2 pl-3 font-medium text-right">State</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((t, i) => {
                    const feed = oracleData?.[i + 1]?.result as
                      | readonly [bigint, bigint, bigint, boolean]
                      | undefined;
                    const answer = feed?.[0] ?? 0n;
                    const updatedAt = feed ? Number(feed[1]) : 0;
                    const initialized = feed?.[3] ?? false;
                    const ageMs = nowMs !== null && updatedAt ? nowMs - updatedAt * 1000 : null;
                    const stale = !initialized || (maxAge > 0 && ageMs !== null && ageMs / 1000 > maxAge);
                    return (
                      <tr key={t.symbol} className="border-t border-[color:var(--color-border)]">
                        <td className="py-2.5 pr-3 font-medium">{t.symbol}</td>
                        <td className="py-2.5 px-3 text-right mono tabular-nums">
                          {initialized ? formatUsd8(answer) : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right mono text-[color:var(--color-muted-foreground)]">
                          {ageMs !== null ? rel(ageMs) : "—"}
                        </td>
                        <td className="py-2.5 pl-3 text-right">
                          <span className="inline-flex items-center gap-1.5">
                            <Dot tone={stale ? "danger" : "safe"} />
                            {stale ? "Stale" : "Fresh"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {maxAge > 0 ? (
            <p className="mt-3 text-xs text-[color:var(--color-muted-foreground)]">
              Reads older than the staleness window ({maxAge}s) are rejected on-chain.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Network</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <Row label="Chain">
            <span>
              {activeChain.name} <span className="mono text-[color:var(--color-muted-foreground)]">· {activeChain.id}</span>
            </span>
          </Row>
          <Row label="Oracle">
            {oracle.address ? (
              <a
                className="mono text-[color:var(--blue)] hover:underline"
                href={explorer(oracle.address)}
                target="_blank"
                rel="noreferrer noopener"
              >
                {short(oracle.address)}
              </a>
            ) : (
              "—"
            )}
          </Row>
        </CardContent>
      </Card>
    </div>
  );
}
