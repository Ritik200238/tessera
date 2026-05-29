"use client";

import Link from "next/link";
import { useAccount, useReadContract, useReadContracts, useWatchBlockNumber } from "wagmi";
import { ArrowRight, Activity } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { vault, isVaultDeployed } from "@/lib/contracts";
import { activeChain } from "@/lib/chain";
import { env } from "@/lib/env";
import { formatBps, formatUsd8 } from "@/lib/format";
import { formatUsdcUsd } from "@/lib/protocol";
import { PositionTile } from "@/components/position-tile";
import { Mark } from "@/components/mark";
import { ValueCard } from "@/components/value-card";
import { ConnectButton } from "@/components/connect-button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Dashboard client island. Three states:
 *   1. Vault not deployed in this env -> read-only landing copy.
 *   2. Wallet not connected -> marketing copy + connect button.
 *   3. Wallet connected -> live Safety Score + position summary, refreshed
 *      every new block via useWatchBlockNumber.
 */
export function DashboardClient({ agentStatus }: { agentStatus: AgentStatusSummary }) {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const vaultAddress = vault.address ?? undefined;
  const enabled = isConnected && vaultAddress !== undefined && address !== undefined;

  const { data: hfData, queryKey: hfKey } = useReadContract({
    address: vaultAddress,
    abi: vault.abi,
    functionName: "getHealthFactor",
    args: address ? [address] : undefined,
    query: { enabled },
  });

  const { data: aggregate, queryKey: aggKey } = useReadContracts({
    contracts: enabled
      ? [
          { address: vaultAddress, abi: vault.abi, functionName: "getAccountData", args: [address!] },
          { address: vaultAddress, abi: vault.abi, functionName: "debtOf", args: [address!] },
          { address: vaultAddress, abi: vault.abi, functionName: "supplyRateBps" },
          { address: vaultAddress, abi: vault.abi, functionName: "utilizationBps" },
        ]
      : [],
    query: { enabled },
  });

  useWatchBlockNumber({
    enabled,
    onBlockNumber: () => {
      // Invalidate the two read queries on every new block so the
      // headline Safety Score and aggregates update in real time.
      void queryClient.invalidateQueries({ queryKey: hfKey });
      void queryClient.invalidateQueries({ queryKey: aggKey });
    },
  });

  if (!isVaultDeployed()) {
    return <NotDeployed />;
  }

  if (!isConnected) {
    return <Landing />;
  }

  const hf = (hfData as bigint | undefined) ?? 0n;
  // getAccountData returns [collateralUsd, debtUsd, healthFactor]
  const accountData = aggregate?.[0]?.result as readonly [bigint, bigint, bigint] | undefined;
  const collateralValue = accountData?.[0] ?? 0n;
  const debt = (aggregate?.[1]?.result as bigint | undefined) ?? 0n;
  const supplyBps = (aggregate?.[2]?.result as bigint | undefined) ?? 0n;
  const util = (aggregate?.[3]?.result as bigint | undefined) ?? 0n;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-3">
        <PositionTile
          glyph={<Mark size={22} color="#fff" />}
          title="Your borrow position"
          subtitle={activeChain.name}
          collateral={formatUsd8(collateralValue)}
          debt={formatUsdcUsd(debt)}
          hf={hf}
        />
        <div className="grid grid-cols-2 gap-3">
          <ValueCard label="Lending APY" value={formatBps(supplyBps)} tone="muted" />
          <ValueCard label="Utilization" value={formatBps(util)} tone="muted" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity aria-hidden className="size-5" />
            Agent status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <AgentStatusRow status={agentStatus} />
          <div className="text-[color:var(--color-muted-foreground)]">Network · {activeChain.name}</div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              href="/borrow"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[color:var(--color-primary)] px-4 text-sm font-medium text-[color:var(--color-primary-foreground)] hover:opacity-90"
            >
              Borrow
              <ArrowRight aria-hidden className="size-4" />
            </Link>
            <Link
              href="/lend"
              className="inline-flex h-10 items-center rounded-md border border-[color:var(--color-border)] px-4 text-sm font-medium hover:bg-[color:var(--color-muted)]"
            >
              Lend
            </Link>
            <Link
              href="/agent"
              className="inline-flex h-10 items-center rounded-md border border-[color:var(--color-border)] px-4 text-sm font-medium hover:bg-[color:var(--color-muted)]"
            >
              Activity
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export interface AgentStatusSummary {
  ok: boolean;
  lastTickAt: string | null;
  errors24h: number;
  available: boolean;
}

function AgentStatusRow({ status }: { status: AgentStatusSummary }) {
  const dot = status.available
    ? status.ok
      ? "bg-[color:var(--color-safe-fg)]"
      : "bg-[color:var(--color-watch-fg)]"
    : "bg-[color:var(--faint)]";
  const label = status.available ? (status.ok ? "Active — protecting" : "Degraded") : "Offline";
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className={`size-2.5 rounded-full ${dot}`} />
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-[color:var(--color-muted-foreground)]">
          {status.lastTickAt
            ? `Last tick ${new Date(status.lastTickAt).toLocaleTimeString()} · ${status.errors24h} errors in 24h`
            : "No telemetry from the agent yet."}
        </p>
      </div>
    </div>
  );
}

function NotDeployed() {
  return (
    <div className="space-y-6">
      <Alert tone="warning">
        <AlertTitle>Vault not yet deployed for {env.chainEnv}</AlertTitle>
        <AlertDescription>
          The contracts haven&apos;t been deployed to this environment. Once the deploy pipeline
          finishes, <code className="font-mono">shared/addresses/{env.chainEnv}.json</code> will be
          populated and this dashboard will come online.
        </AlertDescription>
      </Alert>
      <Landing />
    </div>
  );
}

function Landing() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Deposit. Earn. AI protects.</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed text-[color:var(--color-muted-foreground)]">
          <p>
            Tessera turns your tokenized stocks into productive collateral. Borrow stablecoins
            against tAAPL, tTSLA, and tSPY — while our autonomous risk agent watches your
            position 24/7, including weekends when traditional markets are closed.
          </p>
          <p>
            Connect a wallet to see your portfolio Safety Score in real time. Everything you can do
            on this site reads and writes directly to the on-chain vault on {activeChain.name}.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <ConnectButton />
            <Link
              href="/deposit"
              className="inline-flex h-10 items-center rounded-md border border-[color:var(--color-border)] px-4 text-sm font-medium hover:bg-[color:var(--color-muted)]"
            >
              Explore depositing
            </Link>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>How protection works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Step n={1} title="Deposit tokenized stocks">
            Use tAAPL, tTSLA, or tSPY as collateral.
          </Step>
          <Step n={2} title="Borrow USDC">
            Up to 40–60% of your collateral value — a conservative, per-asset limit that
            accounts for overnight and weekend gap risk — at a dynamic rate.
          </Step>
          <Step n={3} title="AI keeps an eye on it — 24/7">
            The agent watches your health factor every block and alerts you in plain English
            when risk rises. Switch on{" "}
            <span className="font-medium text-[color:var(--color-foreground)]">Active Protection</span>{" "}
            and it can auto-repay from USDC you pre-approve, restoring your position before a
            liquidation. It can only ever reduce your debt with funds you approved — revoke anytime.
          </Step>
        </CardContent>
      </Card>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-primary)] text-xs font-semibold text-[color:var(--color-primary-foreground)]"
      >
        {n}
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-[color:var(--color-muted-foreground)]">{children}</p>
      </div>
    </div>
  );
}

