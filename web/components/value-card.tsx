import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Generic surface for "Total Deposits", "Yield Earned", "Lending APY", etc.
 * Composable: pass headline + optional subline/icon.
 */
export function ValueCard({
  label,
  value,
  hint,
  icon,
  className,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
  tone?: "default" | "muted";
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-[color:var(--color-border)] p-5",
        tone === "muted" ? "bg-[color:var(--color-muted)]" : "bg-[color:var(--color-card)]",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 text-sm text-[color:var(--color-muted-foreground)]">
        <span>{label}</span>
        {icon ? <span aria-hidden>{icon}</span> : null}
      </header>
      <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      {hint ? <p className="mt-1 text-xs text-[color:var(--color-muted-foreground)]">{hint}</p> : null}
    </section>
  );
}
