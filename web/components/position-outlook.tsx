"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { vault, isVaultDeployed } from "@/lib/contracts";
import { addresses } from "@/lib/addresses";
import { EARNINGS_CALENDAR, getGapRiskState, formatCountdown, hfToNumber, type GapRiskState } from "@/lib/regime";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

/**
 * Predictive position outlook — the "tap here before the event" surface. For
 * each collateral asset the user actually holds, surfaces the next known risk
 * event (earnings from the curated calendar; the next weekend gap window from
 * the market clock) and what the AI will do about it (regime-widened bands).
 * Deterministic and honest: the same calendar + regime math the agent runs —
 * no sentiment feeds, no invented signals.
 */
interface Outlook {
  symbol: string;
  event: string;
  inText: string;
  urgency: "soon" | "later";
}

export function PositionOutlook() {
  const { address, isConnected } = useAccount();
  const [gap, setGap] = useState<GapRiskState | null>(null);
  useEffect(() => {
    const t = () => setGap(getGapRiskState(new Date()));
    t();
    const id = setInterval(t, 60_000);
    return () => clearInterval(id);
  }, []);

  const tokens = addresses.collateralTokens;
  const enabled = isConnected && isVaultDeployed() && !!address;
  const { data } = useReadContracts({
    contracts: enabled
      ? tokens.map((t) => ({
          address: vault.address!,
          abi: vault.abi,
          functionName: "collateralOf" as const,
          args: [address!, t.address] as const,
        }))
      : [],
    query: { enabled, refetchInterval: 60_000 },
  });

  if (!isConnected || !gap) return null;

  const held = tokens.filter((_, i) => ((data?.[i]?.result as bigint | undefined) ?? 0n) > 0n);
  if (held.length === 0) return null;

  const now = Date.now();
  const outlooks: Outlook[] = [];
  for (const t of held) {
    const underlying = t.symbol.replace(/^t/, "");
    const dates = EARNINGS_CALENDAR[underlying] ?? [];
    const next = dates
      .map((d) => Date.parse(d))
      .filter((ms) => !Number.isNaN(ms) && ms > now)
      .sort((a, b) => a - b)[0];
    if (next !== undefined) {
      const days = Math.ceil((next - now) / 86_400_000);
      outlooks.push({
        symbol: t.symbol,
        event: `${underlying} earnings`,
        inText: days <= 1 ? "within a day" : `in ${days} days`,
        urgency: days <= 7 ? "soon" : "later",
      });
    }
  }
  // The next weekend gap window applies to every held equity.
  if (gap.regime === "weekend") {
    outlooks.unshift({ symbol: "All holdings", event: "weekend gap window", inText: "now", urgency: "soon" });
  } else if (gap.next.kind === "closes" && gap.next.regimeAfter === "weekend") {
    outlooks.unshift({
      symbol: "All holdings",
      event: "weekend gap window",
      inText: `in ${formatCountdown(gap.next.msUntil)}`,
      urgency: "soon",
    });
  }

  if (outlooks.length === 0) return null;

  const protectNow = hfToNumber(gap.protectTargetHf).toFixed(2);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk outlook</CardTitle>
        <CardDescription>
          Known events ahead for what you hold — from the same calendar + market clock the agent uses.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ul className="space-y-1.5">
          {outlooks.map((o) => (
            <li
              key={`${o.symbol}-${o.event}`}
              className="flex items-baseline justify-between rounded-md border border-[color:var(--color-border)] px-3 py-1.5"
            >
              <span>
                <span className="font-medium">{o.symbol}</span> · {o.event}
              </span>
              <span
                className={
                  "text-xs font-medium tabular-nums " +
                  (o.urgency === "soon" ? "text-[color:var(--color-liquidating-fg)]" : "text-[color:var(--color-muted-foreground)]")
                }
              >
                {o.inText}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-[color:var(--color-muted-foreground)]">
          Around these windows the AI raises its bands automatically (protect target now {protectNow}; +0.30 near
          earnings) and acts earlier. To give it room, top up your{" "}
          <Link href="/agent" className="font-medium underline">
            Active Protection cap
          </Link>{" "}
          or repay a little ahead of the event.
        </p>
      </CardContent>
    </Card>
  );
}
