import type { ReactNode } from "react";
import { formatHealthFactor, safetyScore } from "@/lib/format";

/**
 * The Tile — Tessera's signature component (Brand Kit §05). One position, one
 * card: glyph, value, debt, and a Health-Factor bar tinted by its risk zone,
 * with a thin accent rail on the left carrying the zone color. Status is always
 * label + dot + color, never color alone.
 */

const ONE_E18 = 1_000_000_000_000_000_000n;
const HF_120 = (ONE_E18 * 12n) / 10n;

type Zone = { key: "safe" | "warn" | "danger"; label: string; fg: string; bg: string; border: string };

function zoneOf(hf: bigint): Zone {
  if (hf >= HF_120)
    return { key: "safe", label: "Safe", fg: "var(--safe)", bg: "var(--safe-wash)", border: "#CBE6DA" };
  if (hf >= ONE_E18)
    return { key: "warn", label: "Warning", fg: "var(--warn)", bg: "var(--warn-wash)", border: "#EDD9B0" };
  return { key: "danger", label: "At risk", fg: "var(--danger)", bg: "var(--danger-wash)", border: "#EBC7CC" };
}

/** HF → bar fill %. Full bar ≈ HF 2.0; floors at 4% so the rail is always visible. */
function fillPct(hf: bigint): number {
  if (hf >= 2n ** 200n) return 100; // infinite (no debt)
  const pct = (Number(hf) / Number(2n * ONE_E18)) * 100;
  return Math.max(4, Math.min(100, pct));
}

export interface PositionTileProps {
  /** Glyph in the ink tile — ticker initials or the brand mark. */
  glyph: ReactNode;
  title: string;
  subtitle: string;
  /** Pre-formatted risk-adjusted collateral value (the caller owns the scale). */
  collateral: string;
  /** Pre-formatted outstanding debt (the caller owns the scale). */
  debt: string;
  /** Health factor, 1e18-scaled. */
  hf: bigint;
}

export function PositionTile({ glyph, title, subtitle, collateral, debt, hf }: PositionTileProps) {
  const z = zoneOf(hf);
  const score = safetyScore(hf);

  return (
    <div
      className="relative overflow-hidden rounded-[14px] border bg-[color:var(--surface)] p-5 shadow-[var(--shadow)]"
      style={{ borderColor: "var(--line-2)" }}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: z.fg }} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-[42px] items-center justify-center rounded-[11px] bg-[color:var(--ink)] text-[15px] font-bold tracking-tight text-white">
            {glyph}
          </div>
          <div>
            <div className="text-[17px] font-bold tracking-tight">{title}</div>
            <div className="text-xs text-[color:var(--muted)]">{subtitle}</div>
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 mono text-[11px] font-medium"
          style={{ color: z.fg, background: z.bg, borderColor: z.border }}
        >
          <span aria-hidden className="size-[7px] rounded-[2px]" style={{ background: z.fg }} />
          {z.label}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3.5 border-t border-[color:var(--line)] pt-[18px]">
        <Stat k="Collateral backing" v={collateral} />
        <Stat k="Debt" v={debt} />
        <Stat k="Safety score" v={`${score} / 100`} />
        <Stat k="Health factor" v={formatHealthFactor(hf)} color={z.fg} />
      </div>

      <div className="mt-[18px]">
        <div className="mb-[7px] flex justify-between">
          <span className="mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--faint)]">HF headroom</span>
          <span className="mono text-[11px] text-[color:var(--muted)]">liq. at 1.00</span>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-[color:var(--surface-2)]">
          <div className="h-full rounded-full" style={{ width: `${fillPct(hf)}%`, background: z.fg }} />
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div>
      <div className="mono text-[10.5px] uppercase tracking-[0.08em] text-[color:var(--faint)]">{k}</div>
      <div className="mt-[3px] mono text-[17px] font-medium tabular-nums" style={color ? { color } : undefined}>
        {v}
      </div>
    </div>
  );
}
