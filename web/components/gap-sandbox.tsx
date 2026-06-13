"use client";

import { useEffect, useMemo, useState } from "react";
import { assessRegime, hfToNumber, LIQUIDATION_HF, type RegimeAssessment } from "@/lib/regime";
import { SafetyBar } from "@/components/safety-bar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

/**
 * Drag-the-gap sandbox — interactive proof of the agent's logic, no wallet, no
 * spend. Drag a crash from 0 to −50% and watch the SAME deterministic decision
 * the live agent makes every block: at what point it alerts, how much it would
 * repay, where liquidation sits. Runs on the browser mirror of the regime engine
 * (lib/regime.ts), so the bands are the live, regime-aware ones.
 *
 * Decision logic mirrors tick.ts exactly:
 *   hf >= alertThreshold        → healthy, no action
 *   liq <= hf < alertThreshold  → auto-repay, sized to restore toward protectTarget
 *   hf < liq (1.0)              → liquidation (last resort, 50% close factor)
 */

// The three listed assets, with the real on-chain LTV / liquidation thresholds
// and testnet oracle prices (match lib/addresses + the deployed assetParams).
const ASSETS = {
  tTSLA: { name: "Tesla", liq: 0.55, px: 250 },
  tAAPL: { name: "Apple", liq: 0.65, px: 200 },
  tSPY: { name: "S&P 500 ETF", liq: 0.75, px: 500 },
} as const;
type AssetKey = keyof typeof ASSETS;

const usd = (v: number) => "$" + Math.round(v).toLocaleString("en-US");

export function GapSandbox() {
  const [asset, setAsset] = useState<AssetKey>("tTSLA");
  const [collateral, setCollateral] = useState(10_000);
  const [debt, setDebt] = useState(3_000);
  const [gap, setGap] = useState(35);
  const [reg, setReg] = useState<RegimeAssessment | null>(null);
  useEffect(() => {
    const t = () => setReg(assessRegime(new Date()));
    t();
    const id = setInterval(t, 60_000);
    return () => clearInterval(id);
  }, []);

  const a = ASSETS[asset];
  const out = useMemo(() => {
    const alertAt = reg ? hfToNumber(reg.alertThresholdHf) : 1.1;
    const protectAt = reg ? hfToNumber(reg.protectTargetHf) : 1.4;
    const liqAt = hfToNumber(LIQUIDATION_HF);
    const postColl = collateral * (1 - gap / 100);
    const riskAdj = postColl * a.liq;
    const hf = debt > 0 ? riskAdj / debt : 99;

    let kind: "healthy" | "repay" | "liquidate";
    let repay = 0;
    if (hf < liqAt) kind = "liquidate";
    else if (hf < alertAt) {
      kind = "repay";
      // Same sizing as the agent: repay = debt * (target - hf) / target.
      repay = Math.max(0, debt * (protectAt - hf)) / protectAt;
    } else kind = "healthy";

    return { hf, alertAt, protectAt, liqAt, kind, repay, restored: protectAt };
  }, [reg, asset, collateral, debt, gap, a.liq]);

  const maxDebtAtStart = Math.round(collateral * a.liq * 0.9); // keep start HF >~1.1

  return (
    <Card>
      <CardHeader>
        <CardTitle>Drag the gap — watch the agent decide</CardTitle>
        <CardDescription>
          No wallet, no spend. This runs the exact decision the live agent makes each tick (~10s),
          on the regime-aware bands{reg ? ` (${reg.label})` : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ASSETS) as AssetKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setAsset(k)}
              aria-pressed={asset === k}
              className={
                "rounded-md border px-3 py-1.5 text-sm font-medium " +
                (asset === k
                  ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]"
                  : "border-[color:var(--color-border)] hover:bg-[color:var(--color-muted)]")
              }
            >
              {k}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Slider
            label="Collateral"
            value={collateral}
            display={usd(collateral)}
            min={2000}
            max={50000}
            step={500}
            onChange={(v) => {
              setCollateral(v);
              setDebt((d) => Math.min(d, Math.round(v * a.liq * 0.9)));
            }}
          />
          <Slider
            label="USDC borrowed"
            value={debt}
            display={usd(debt)}
            min={0}
            max={maxDebtAtStart}
            step={100}
            onChange={setDebt}
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">Overnight gap</span>
            <span className="tabular-nums font-semibold text-[color:var(--color-liquidating-fg)]">−{gap}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={50}
            step={1}
            value={gap}
            onChange={(e) => setGap(Number(e.currentTarget.value))}
            aria-label="Overnight gap size"
            className="mt-1 w-full accent-[color:var(--color-liquidating-fg)]"
          />
          <div className="flex justify-between text-[10px] text-[color:var(--color-muted-foreground)]">
            <span>0%</span>
            <span>−25%</span>
            <span>−50%</span>
          </div>
        </div>

        <SafetyBar hf={out.hf} actAt={out.alertAt} liqAt={out.liqAt} protectAt={out.protectAt} />

        <div className="rounded-lg bg-[color:var(--color-muted)] p-3 text-sm">
          {out.kind === "healthy" && (
            <p>
              <span className="font-semibold text-[color:var(--color-safe-fg)]">Healthy.</span> At a −{gap}% gap your
              health factor is {out.hf.toFixed(2)} — above the agent&apos;s act line ({out.alertAt.toFixed(2)}). The
              agent watches, but doesn&apos;t need to do anything.
            </p>
          )}
          {out.kind === "repay" && (
            <p>
              <span className="font-semibold" style={{ color: "var(--color-watch-fg)" }}>Agent acts.</span> A −{gap}% gap
              drops your health factor to {out.hf.toFixed(2)}, under the {out.alertAt.toFixed(2)} act line. The agent
              auto-repays <span className="font-semibold tabular-nums">{usd(out.repay)}</span> from your approved cap,
              restoring it toward {out.restored.toFixed(2)} — <strong>before</strong> liquidation.
            </p>
          )}
          {out.kind === "liquidate" && (
            <p>
              <span className="font-semibold text-[color:var(--color-liquidating-fg)]">Liquidation territory.</span> A
              −{gap}% gap pushes your health factor to {out.hf.toFixed(2)}, below 1.00. This is why the agent acts
              early — once you&apos;re here, it can only liquidate (50% of the debt) to protect lenders. With Active
              Protection on, it would have repaid well before this point.
            </p>
          )}
        </div>
        <p className="text-xs text-[color:var(--color-muted-foreground)]">
          Same engine as the live agent (browser mirror of the regime logic). The act + restore lines widen
          automatically as gap risk rises — weekends and earnings move them up.
        </p>
      </CardContent>
    </Card>
  );
}

function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        aria-label={label}
        className="mt-1 w-full accent-[color:var(--color-primary)]"
      />
    </label>
  );
}
