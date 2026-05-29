import { classify } from "@/lib/health";
import { cn } from "@/lib/utils";

/**
 * Linear meter visualising the Safety Score 0–100. Width is a *genuinely
 * dynamic* value (TDD §5.3), so it must be inline-styled — Tailwind cannot
 * generate arbitrary widths at runtime.
 */
export function HealthMeter({ hf, className }: { hf: bigint; className?: string }) {
  const c = classify(hf);
  const pct = Math.max(2, Math.min(100, c.score)); // a sliver always visible
  return (
    <div
      className={cn("w-full", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={c.score}
      aria-label={`Safety score ${c.score} of 100 (${c.label})`}
    >
      <div className="h-3 w-full overflow-hidden rounded-full bg-[color:var(--color-muted)]">
        <div
          data-tone={c.tone}
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            c.tone === "safe" && "bg-[color:var(--color-safe-fg)]",
            c.tone === "healthy" && "bg-[color:var(--color-healthy-fg)]",
            c.tone === "watch" && "bg-[color:var(--color-watch-fg)]",
            c.tone === "atrisk" && "bg-[color:var(--color-atrisk-fg)]",
            c.tone === "liquidating" && "bg-[color:var(--color-liquidating-fg)]",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-[color:var(--color-muted-foreground)]">
        <span>0</span>
        <span aria-hidden>50</span>
        <span aria-hidden>100</span>
      </div>
    </div>
  );
}
