/**
 * SafetyBar — the "feel safe, don't do math" health display (clarity layer).
 *
 * A green / amber / red bar with a marker at the current health factor and a
 * plain-English status word LEADING, the raw HF trailing. Outsiders read the
 * colour and the word in under a second; DeFi-native users still get the number.
 * Pure presentational — pass the HF and the regime's act/liquidation lines.
 *
 * Bands (match the 3-band protection model):
 *   hf >= actAt           → green  "Protected"        (AI not needed yet)
 *   liqAt <= hf < actAt   → amber  "AI protecting now" (agent auto-repays here)
 *   hf < liqAt            → red    "At risk"          (liquidation territory)
 */
export function SafetyBar({
  hf,
  actAt,
  liqAt = 1,
  protectAt,
  showNumber = true,
  compact = false,
}: {
  hf: number;
  actAt: number;
  liqAt?: number;
  protectAt?: number;
  showNumber?: boolean;
  compact?: boolean;
}) {
  const min = 0.8;
  const max = Math.max(2, (protectAt ?? actAt) + 0.6);
  const toPct = (v: number) => Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));

  const liqPct = toPct(liqAt);
  const actPct = toPct(actAt);
  const markerPct = toPct(Math.min(hf, max));
  const infinite = hf >= 100;

  let tone: "safe" | "watch" | "liquidating";
  let word: string;
  if (hf < liqAt) {
    tone = "liquidating";
    word = "At risk";
  } else if (hf < actAt) {
    tone = "watch";
    word = "AI protecting now";
  } else {
    tone = "safe";
    word = "Protected";
  }
  const fg = `var(--color-${tone}-fg)`;
  const bg = `var(--color-${tone}-bg)`;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ color: fg, background: bg }}
        >
          <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: fg }} />
          {word}
        </span>
        {showNumber && (
          <span className="text-xs text-[color:var(--color-muted-foreground)] tabular-nums">
            Health factor <span className="font-semibold text-[color:var(--color-foreground)]">{infinite ? "∞" : hf.toFixed(2)}</span>
          </span>
        )}
      </div>

      <div
        className={"relative w-full overflow-hidden rounded-full " + (compact ? "h-2" : "h-3")}
        role="img"
        aria-label={`${word} — health factor ${infinite ? "infinite" : hf.toFixed(2)}, liquidation at ${liqAt.toFixed(2)}`}
      >
        {/* zones */}
        <div className="absolute inset-y-0 left-0" style={{ width: `${liqPct}%`, background: "var(--color-liquidating-fg)" }} />
        <div className="absolute inset-y-0" style={{ left: `${liqPct}%`, width: `${actPct - liqPct}%`, background: "var(--color-watch-fg)" }} />
        <div className="absolute inset-y-0" style={{ left: `${actPct}%`, right: 0, background: "var(--color-safe-fg)" }} />
        {/* marker */}
        <div
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${markerPct}%`, background: "#0c1116" }}
        />
      </div>

      {!compact && (
        <div className="flex justify-between text-[10px] text-[color:var(--color-muted-foreground)] tabular-nums">
          <span>liquidation {liqAt.toFixed(2)}</span>
          <span>AI acts {actAt.toFixed(2)}</span>
          <span>safe</span>
        </div>
      )}
    </div>
  );
}
