import { runGapBacktest } from "@/lib/gap-backtest";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

/**
 * Publishes the reproducible gap-loss proof (scale #5). Pure + deterministic, so
 * it renders server-side; the number is locked by web/test/gap-backtest.test.ts.
 */
export function GapBacktestCard() {
  const r = runGapBacktest();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Does the AI actually protect you?</CardTitle>
        <CardDescription>{r.headline}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
          <Stat label="Liquidations avoided" value={`${r.liquidationsAvoided} / ${r.baselineLiquidations}`} tone="safe" />
          <Stat label="Of baseline liquidations" value={`${r.avoidedOfBaselinePct}%`} tone="safe" />
          <Stat label="Avg extra HF buffer" value={`+${r.avgBufferGain.toFixed(2)}`} />
        </div>

        <div className="overflow-x-auto rounded-xl border border-[color:var(--color-border)]">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-[color:var(--color-muted)] text-left text-xs uppercase tracking-wide text-[color:var(--color-muted-foreground)]">
              <tr>
                <th className="px-3 py-2 font-medium">Modeled gap</th>
                <th className="px-3 py-2 font-medium text-right">Unprotected</th>
                <th className="px-3 py-2 font-medium text-right">Tessera (regime-aware)</th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((row) => {
                const avoided = row.liqBaseline && !row.liqProtected;
                return (
                  <tr key={row.label} className="border-t border-[color:var(--color-border)]">
                    <td className="px-3 py-2">{row.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.liqBaseline ? (
                        <span className="text-[color:var(--color-liquidating-fg)]">liquidated</span>
                      ) : (
                        <span className="text-[color:var(--color-muted-foreground)]">safe</span>
                      )}{" "}
                      <span className="text-xs text-[color:var(--color-muted-foreground)]">
                        HF {row.postHfBaseline.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.liqProtected ? (
                        <span className="text-[color:var(--color-liquidating-fg)]">liquidated</span>
                      ) : (
                        <span className={avoided ? "font-semibold text-[color:var(--color-safe-fg)]" : "text-[color:var(--color-safe-fg)]"}>
                          {avoided ? "saved ✓" : "safe"}
                        </span>
                      )}{" "}
                      <span className="text-xs text-[color:var(--color-muted-foreground)]">
                        HF {row.postHfProtected.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-[color:var(--color-muted-foreground)]">
          A <strong>modeled</strong> result (not historical protocol performance), run through the same deterministic
          regime engine the live agent uses. Protection is not magic — a severe enough gap still liquidates a protected
          position, but always from a higher buffer (less bad debt). Reproduce + verify the number in CI:{" "}
          <code className="font-mono">pnpm --filter @tessera/web test gap-backtest</code>.
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "safe" }) {
  return (
    <div className="rounded-md bg-[color:var(--color-muted)] px-3 py-2">
      <p className="text-xs text-[color:var(--color-muted-foreground)]">{label}</p>
      <p className={"text-lg font-semibold tabular-nums" + (tone === "safe" ? " text-[color:var(--color-safe-fg)]" : "")}>
        {value}
      </p>
    </div>
  );
}
