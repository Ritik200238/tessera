"use client";

import { useEffect, useState } from "react";
import { erc20Abi } from "viem";
import { useAccount, useReadContracts } from "wagmi";
import { vault, isVaultDeployed } from "@/lib/contracts";
import { addresses } from "@/lib/addresses";
import { assessRegime, hfToNumber, LIQUIDATION_HF, type RegimeAssessment } from "@/lib/regime";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SafetyBar } from "@/components/safety-bar";

/**
 * "Where you stand" — the agent page personalized to the connected wallet.
 * Live answer to the only question a borrower actually has: how far am I from
 * the AI stepping in, under the CURRENT regime? Pure on-chain reads + the same
 * regime math the agent runs.
 */
export function YourStanding() {
  const { address, isConnected } = useAccount();
  const [reg, setReg] = useState<RegimeAssessment | null>(null);
  useEffect(() => {
    const t = () => setReg(assessRegime(new Date()));
    t();
    const id = setInterval(t, 60_000);
    return () => clearInterval(id);
  }, []);

  const enabled = isConnected && isVaultDeployed() && !!address && !!addresses.usdc;
  const { data } = useReadContracts({
    contracts: enabled
      ? [
          { address: vault.address!, abi: vault.abi, functionName: "getHealthFactor", args: [address!] },
          { address: vault.address!, abi: vault.abi, functionName: "debtOf", args: [address!] },
          { address: addresses.usdc!, abi: erc20Abi, functionName: "allowance", args: [address!, vault.address!] },
        ]
      : [],
    query: { enabled, refetchInterval: 15_000 },
  });

  const hf = (data?.[0]?.result as bigint | undefined) ?? 0n;
  const debt = (data?.[1]?.result as bigint | undefined) ?? 0n;
  const cap = (data?.[2]?.result as bigint | undefined) ?? 0n;

  if (!isConnected || !reg || debt === 0n) return null;

  const hfN = Number(hf) / 1e18;
  const actAt = hfToNumber(reg.alertThresholdHf);
  const liqAt = hfToNumber(LIQUIDATION_HF);
  // Uniform-price-drop distance to the act line: HF scales with collateral price.
  const dropToActPct = hfN > actAt ? Math.round((1 - actAt / hfN) * 100) : 0;
  const protectedOn = cap > 0n;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Where you stand</CardTitle>
        <CardDescription>
          This wallet, right now ({reg.label}) — the same math the agent runs each tick (~10s).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <SafetyBar hf={hfN} actAt={actAt} liqAt={liqAt} protectAt={hfToNumber(reg.protectTargetHf)} />
        <p className="text-[color:var(--color-muted-foreground)]">
          {hfN <= actAt ? (
            <>You are in the act zone — the agent {protectedOn ? "will auto-repay on its next pass." : "is alerting; enable protection below so it can act."}</>
          ) : (
            <>
              Your collateral would have to fall roughly{" "}
              <span className="font-semibold text-[color:var(--color-foreground)] tabular-nums">{dropToActPct}%</span>{" "}
              before the AI steps in{protectedOn ? "" : " — and protection is OFF, so enable it below for the agent to act"} (liquidation only below {liqAt.toFixed(2)}).
            </>
          )}
        </p>
        <p className="text-xs text-[color:var(--color-muted-foreground)]">
          {protectedOn
            ? `Active Protection is ON — the agent may use up to ${(Number(cap) / 1e6).toLocaleString()} USDC of your approved cap, only ever to repay your own loan.`
            : "Active Protection is OFF — the agent can warn you but cannot repay for you until you approve a cap."}
        </p>
      </CardContent>
    </Card>
  );
}
