import { classify } from "@/lib/health";
import { HealthBadge } from "./health-badge";
import { cn } from "@/lib/utils";

/**
 * Headline 0–100 Safety Score (TDD §5.3 / G9).
 *
 * Renders the score, its colour-coded badge, and the human-friendly
 * advisory copy. This is the most prominent metric in the product —
 * retail users have one thing to look at.
 */
export function SafetyScore({
  hf,
  className,
}: {
  hf: bigint;
  className?: string;
}) {
  const c = classify(hf);
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-baseline gap-3">
        <span
          aria-label={`Safety score ${c.score} out of 100`}
          className="text-6xl font-semibold tracking-tight tabular-nums"
          data-tone={c.tone}
        >
          {c.score}
        </span>
        <span className="text-xl text-[color:var(--color-muted-foreground)]">/ 100</span>
      </div>
      <HealthBadge tone={c.tone} label={c.label} size="lg" />
      <p className="text-sm text-[color:var(--color-muted-foreground)] max-w-md">{c.copy}</p>
    </div>
  );
}
