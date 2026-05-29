"use client";

import { useMemo, useState } from "react";
import {
  useAccount,
  useReadContracts,
  useWatchContractEvent,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { type Address, parseUnits, type ContractFunctionParameters } from "viem";
import { Download, Flame, RefreshCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { ConnectButton } from "./connect-button";
import { HealthBadge } from "./health-badge";
import { vault, isVaultDeployed } from "@/lib/contracts";
import { env } from "@/lib/env";
import { classify } from "@/lib/health";
import { formatHealthFactor, formatUsd8 } from "@/lib/format";
import { downloadCsv, rowsToCsv } from "@/lib/csv";

interface UserRow {
  user: Address;
  hf: bigint;
  collateral: bigint;
  debt: bigint;
}

/**
 * Admin panel.
 *
 * Privilege model (TDD §5.2): a connected wallet is considered privileged
 * if it matches either the configured owner address or the configured agent
 * address (we read both from NEXT_PUBLIC env). Privileged callers see
 * action buttons (manual liquidate, pause). Everyone else gets the read-only
 * table + CSV export.
 *
 * The per-user list is bootstrapped from `Borrow` events; in MVP we discover
 * borrowers on the client by watching the event stream from contract deploy.
 * For an indexed history we'd back this with a small route handler that
 * queries logs in batches — flagged as a follow-up but not blocking demo.
 */
export function AdminPanel() {
  const { address, isConnected } = useAccount();
  const lowered = (address ?? "").toLowerCase();
  const isPrivileged =
    isConnected &&
    (lowered === env.adminAddress || lowered === env.ownerAddress) &&
    (env.adminAddress !== "" || env.ownerAddress !== "");

  const [users, setUsers] = useState<Address[]>([]);

  useWatchContractEvent({
    address: vault.address ?? undefined,
    abi: vault.abi,
    eventName: "Borrow",
    enabled: vault.address !== null,
    onLogs(logs) {
      setUsers((prev) => {
        const set = new Set(prev);
        for (const log of logs) {
          // log.args is typed by viem from the ABI
          const user = (log as unknown as { args?: { user?: Address } }).args?.user;
          if (user) set.add(user);
        }
        return Array.from(set);
      });
    },
  });

  const reads = useMemo(() => {
    if (!vault.address) return [];
    return users.flatMap((u) => [
      { address: vault.address!, abi: vault.abi, functionName: "getAccountData", args: [u] },
    ]);
  }, [users]);

  const { data: chunkedData, refetch } = useReadContracts({
    // The dynamic length forces us to widen — useReadContracts infers
    // tuple types for static arrays but we need a variable-length list.
    contracts: reads as readonly ContractFunctionParameters[],
    query: { enabled: reads.length > 0 },
  });

  const rows: UserRow[] = useMemo(() => {
    if (!chunkedData) return [];
    const data = chunkedData as Array<{ result?: unknown }>;
    const out: UserRow[] = [];
    for (let i = 0; i < users.length; i += 1) {
      // getAccountData returns [collateralUsd, debtUsd, healthFactor]
      const tuple = data[i]?.result as readonly [bigint, bigint, bigint] | undefined;
      const collateral = tuple?.[0] ?? 0n;
      const debt = tuple?.[1] ?? 0n;
      const hf = tuple?.[2] ?? 0n;
      out.push({ user: users[i]!, hf, collateral, debt });
    }
    return out;
  }, [chunkedData, users]);

  return (
    <div className="space-y-6">
      {!isVaultDeployed() ? (
        <Alert tone="warning">
          <AlertTitle>Vault not yet deployed</AlertTitle>
          <AlertDescription>
            Once contracts ship to this environment the admin tools will activate.
          </AlertDescription>
        </Alert>
      ) : null}

      {!isConnected ? (
        <Card>
          <CardHeader>
            <CardTitle>Connect to view positions</CardTitle>
            <CardDescription>The admin tools require a connected wallet.</CardDescription>
          </CardHeader>
          <CardContent>
            <ConnectButton />
          </CardContent>
        </Card>
      ) : null}

      {isConnected && !isPrivileged ? (
        <Alert tone="info">
          <AlertTitle>Read-only mode</AlertTitle>
          <AlertDescription>
            You are not configured as the protocol owner or agent. Manual liquidation and pause
            controls are disabled. You can still export the positions table.
          </AlertDescription>
        </Alert>
      ) : null}

      <PrivilegedControls disabled={!isPrivileged} onRefresh={() => refetch()} />

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Positions</CardTitle>
            <CardDescription>
              Discovered from on-chain Borrow events. Click refresh to re-poll.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              aria-label="Refresh positions"
            >
              <RefreshCcw aria-hidden className="size-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportRows(rows)}
              aria-label="Download positions as CSV"
            >
              <Download aria-hidden className="size-4" />
              CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <PositionsTable rows={rows} isPrivileged={isPrivileged} />
        </CardContent>
      </Card>
    </div>
  );
}

function exportRows(rows: UserRow[]) {
  const csv = rowsToCsv(rows, [
    { key: "user", header: "user" },
    { key: "hf", header: "health_factor_1e18", format: (v) => (v as bigint).toString() },
    { key: "collateral", header: "collateral_usd_1e8", format: (v) => (v as bigint).toString() },
    { key: "debt", header: "debt_usd_1e8", format: (v) => (v as bigint).toString() },
  ]);
  downloadCsv(`tessera-positions-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}

function PositionsTable({ rows, isPrivileged }: { rows: UserRow[]; isPrivileged: boolean }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-[color:var(--color-muted-foreground)]">
        No borrowers indexed yet. Borrow events will appear here in real time as they occur.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-[color:var(--color-muted-foreground)]">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">User</th>
            <th scope="col" className="px-3 py-2 font-medium">Status</th>
            <th scope="col" className="px-3 py-2 font-medium text-right">Health</th>
            <th scope="col" className="px-3 py-2 font-medium text-right">Collateral</th>
            <th scope="col" className="px-3 py-2 font-medium text-right">Debt</th>
            <th scope="col" className="px-3 py-2 font-medium text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const c = classify(r.hf);
            return (
              <tr key={r.user} className="border-t border-[color:var(--color-border)]">
                <td className="px-3 py-2 font-mono text-xs">{r.user}</td>
                <td className="px-3 py-2">
                  <HealthBadge tone={c.tone} label={c.label} size="sm" />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatHealthFactor(r.hf)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatUsd8(r.collateral)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatUsd8(r.debt)}</td>
                <td className="px-3 py-2 text-right">
                  <ManualLiquidate row={r} disabled={!isPrivileged || c.tone !== "liquidating"} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ManualLiquidate({ row, disabled }: { row: UserRow; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [repay, setRepay] = useState("");
  const [tokenAddr, setTokenAddr] = useState("");
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: mining, isSuccess: mined } = useWaitForTransactionReceipt({ hash });

  function submit() {
    if (!vault.address || !tokenAddr.startsWith("0x")) return;
    reset();
    let repay6: bigint;
    try {
      repay6 = parseUnits(repay, 6); // USDC has 6 decimals
    } catch {
      return;
    }
    writeContract({
      address: vault.address,
      abi: vault.abi,
      functionName: "liquidate",
      args: [row.user, repay6, tokenAddr as Address],
    });
  }

  return (
    <div>
      <Button
        size="sm"
        variant="destructive"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Flame aria-hidden className="size-3.5" />
        Liquidate
      </Button>
      {open ? (
        <div className="mt-2 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-3 text-left">
          <p className="mb-2 text-xs text-[color:var(--color-muted-foreground)]">
            Specify the USDC repay amount and the collateral token to seize. Contract enforces the
            50% close-factor cap.
          </p>
          <div className="grid gap-2">
            <label className="text-xs">USDC repay
              <Input value={repay} onChange={(e) => setRepay(e.currentTarget.value)} inputMode="decimal" placeholder="e.g. 100" />
            </label>
            <label className="text-xs">Collateral token address
              <Input value={tokenAddr} onChange={(e) => setTokenAddr(e.currentTarget.value)} placeholder="0x…" />
            </label>
          </div>
          {error ? <p className="mt-2 text-xs text-[color:var(--color-liquidating-fg)]">{(error as Error).message}</p> : null}
          {mined ? <p className="mt-2 text-xs text-[color:var(--color-safe-fg)]">Liquidation confirmed.</p> : null}
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={submit} disabled={isPending || mining}>
              {isPending || mining ? "Submitting…" : "Submit"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PrivilegedControls({ disabled, onRefresh }: { disabled: boolean; onRefresh: () => void }) {
  const { writeContract, isPending, error, data: hash, reset } = useWriteContract();
  const { isLoading: mining, isSuccess: mined } = useWaitForTransactionReceipt({ hash });

  function emergencyPause() {
    if (!vault.address) return;
    reset();
    writeContract({ address: vault.address, abi: vault.abi, functionName: "pause" });
  }
  function unpause() {
    if (!vault.address) return;
    reset();
    writeContract({ address: vault.address, abi: vault.abi, functionName: "unpause" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Owner controls</CardTitle>
        <CardDescription>Emergency pause is the documented circuit-breaker (TDD §16.3).</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button variant="destructive" disabled={disabled || isPending || mining} onClick={emergencyPause}>
          {isPending || mining ? "Submitting…" : "Emergency pause"}
        </Button>
        <Button variant="outline" disabled={disabled || isPending || mining} onClick={unpause}>
          Unpause
        </Button>
        <Button variant="outline" onClick={onRefresh}>
          <RefreshCcw aria-hidden className="size-4" />
          Refresh positions
        </Button>
        {error ? (
          <Alert tone="danger" className="w-full">
            <AlertTitle>Action failed</AlertTitle>
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        ) : null}
        {mined ? (
          <Alert tone="success" className="w-full">
            <AlertTitle>Confirmed</AlertTitle>
            <AlertDescription>The state change is on-chain.</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
