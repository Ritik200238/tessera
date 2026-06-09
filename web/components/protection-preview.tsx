"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { vault, isVaultDeployed } from "@/lib/contracts";
import {
  assessRegime,
  hfToNumber,
  BASE_ALERT_HF,
  BASE_PROTECT_HF,
  LIQUIDATION_HF,
  type RegimeAssessment,
} from "@/lib/regime";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

/**
 * Protection preview (B2, honest 3-band rewrite). Shows EXACTLY what the agent
 * does, verified against tick.ts: it alerts + auto-repays when HF falls below the
 * alert line (1.10 + regime bump), restores your HF toward the protect target
 * (1.40 + regime bump), and liquidates only below 1.00. All three lines widen
 * automatically with gap risk (regime). The drop slider shows where your HF lands.
 */
const WAD = 1_000_000_000_000_000_000n;

export function ProtectionPreview() {
  const { address, isConnected } = useAccount();
  const [dropPct, setDropPct] = useState(15);
  const [reg, setReg] = useState<RegimeAssessment | null>(null);
  useEffect(() => {
    const t = () => setReg(assessRegime(new Date()));
    t();
    const id = setInterval(t, 60_000);
    return () => clearInterval(id);
  }, []);

  const { data } = useReadContract({
    address: vault.address ?? undefined,
    abi: vault.abi,
    functionName: "getAccountData",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && isVaultDeployed() && !!address, refetchInterval: 30_000 },
  });
  const acct = data as readonly [bigint, bigint, bigint] | undefined;
  const weighted = acct?.[0] ?? 0n; // risk-weighted collateral, 8-dec
  const debt6 = acct?.[1] ?? 0n; // USDC, 6-dec

  if (!isConnected || debt6 === 0n) return null;

  // Regime-widened bands (fall back to "open" base values before mount).
  const actHf = reg?.alertThresholdHf ?? BASE_ALERT_HF; // AI alerts + auto-repays below this
  const protectHf = reg?.protectTargetHf ?? BASE_PROTECT_HF; // restores HF toward this
  const liqHf = LIQUIDATION_HF; // last-resort liquidation below this

  const debt8 = debt6 * 100n;
  const dropBps = BigInt(Math.round(dropPct * 100));
  const newWeighted = (weighted * (10_000n - dropBps)) / 10_000n;
  const projHf = debt8 > 0n ? (newWeighted * WAD) / debt8 : WAD * 1000n;
  // Repay the agent would make (restore toward the protect target) when it acts.
  const needed8 = projHf < protectHf ? debt8 - (newWeighted * WAD) / protectHf : 0n;
  const repayUsdc = needed8 > 0n ? needed8 / 100n : 0n;

  const fmtHf = (v: bigint) => hfToNumber(v).toFixed(2);
  const fmtUsdc = (v: bigint) => (Number(v) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 });

  let outcome: string;
  if (projHf >= protectHf) outcome = `Comfortable — HF ${fmtHf(projHf)} stays above the protect target.`;
  else if (projHf >= actHf)
    outcome = `Monitored — HF ${fmtHf(projHf)} is above the act line; the AI watches and steps in only if you fall further.`;
  else if (projHf > liqHf)
    outcome = `The AI acts here — at HF ${fmtHf(projHf)} it alerts you and auto-repays ~${fmtUsdc(repayUsdc)} USDC from your approved cap to restore HF toward ${fmtHf(protectHf)}.`;
  else outcome = `Liquidatable at HF ${fmtHf(projHf)} — the AI acts well before this point.`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Protection preview</CardTitle>
        <CardDescription>
          What the agent would do under a drop, at the current market regime{reg ? ` (${reg.label})` : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <label className="block">
          If your collateral drops <span className="font-semibold tabular-nums">{dropPct}%</span>
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={dropPct}
            onChange={(e) => setDropPct(Number(e.currentTarget.value))}
            className="mt-1 w-full accent-[color:var(--color-primary)]"
            aria-label="Collateral price drop"
          />
        </label>

        <div className="space-y-1.5">
          <Band dot="#d97706" label="AI alerts + auto-repays below" value={fmtHf(actHf)} />
          <Band dot="var(--color-safe-fg)" label="Restores your HF toward" value={fmtHf(protectHf)} />
          <Band dot="var(--color-liquidating-fg)" label="Liquidation (last resort) below" value={fmtHf(liqHf)} />
        </div>

        <div className="rounded-md bg-[color:var(--color-muted)] px-3 py-2">
          <p className="text-xs text-[color:var(--color-muted-foreground)]">At −{dropPct}%, your HF would be</p>
          <p className="font-medium tabular-nums">{fmtHf(projHf)}</p>
          <p className="mt-1 text-xs text-[color:var(--color-muted-foreground)]">{outcome}</p>
        </div>

        <p className="text-xs text-[color:var(--color-muted-foreground)]">
          These lines widen automatically as gap risk rises — on a weekend the AI acts at HF 1.40 and restores toward
          1.70 (vs 1.10 / 1.40 when markets are open). It repays only from the USDC allowance you approved — never more.
        </p>
      </CardContent>
    </Card>
  );
}

function Band({ dot, label, value }: { dot: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-[color:var(--color-border)] px-3 py-1.5">
      <span className="flex items-center gap-2">
        <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: dot }} />
        {label}
      </span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
