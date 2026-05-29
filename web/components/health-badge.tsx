import { ShieldCheck, Shield, Eye, AlertTriangle, Flame } from "lucide-react";
import type { HealthTone } from "@/lib/health";
import { cn } from "@/lib/utils";

/**
 * Accessible health badge.
 *
 * The badge is intentionally redundant: each tone is conveyed by colour
 * AND by a distinct lucide icon AND by the text label. Users with any
 * form of colour-blindness can still tell "Safe" from "Liquidating" by
 * shape alone (TDD residual gap R2).
 */

interface Variant {
  icon: typeof ShieldCheck;
  bg: string;
  fg: string;
  ring: string;
}

const VARIANTS: Record<HealthTone, Variant> = {
  safe: {
    icon: ShieldCheck,
    bg: "bg-[color:var(--color-safe-bg)]",
    fg: "text-[color:var(--color-safe-fg)]",
    ring: "ring-[color:var(--color-safe-fg)]/30",
  },
  healthy: {
    icon: Shield,
    bg: "bg-[color:var(--color-healthy-bg)]",
    fg: "text-[color:var(--color-healthy-fg)]",
    ring: "ring-[color:var(--color-healthy-fg)]/30",
  },
  watch: {
    icon: Eye,
    bg: "bg-[color:var(--color-watch-bg)]",
    fg: "text-[color:var(--color-watch-fg)]",
    ring: "ring-[color:var(--color-watch-fg)]/30",
  },
  atrisk: {
    icon: AlertTriangle,
    bg: "bg-[color:var(--color-atrisk-bg)]",
    fg: "text-[color:var(--color-atrisk-fg)]",
    ring: "ring-[color:var(--color-atrisk-fg)]/30",
  },
  liquidating: {
    icon: Flame,
    bg: "bg-[color:var(--color-liquidating-bg)]",
    fg: "text-[color:var(--color-liquidating-fg)]",
    ring: "ring-[color:var(--color-liquidating-fg)]/30",
  },
};

interface HealthBadgeProps {
  tone: HealthTone;
  label: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function HealthBadge({ tone, label, size = "md", className }: HealthBadgeProps) {
  const variant = VARIANTS[tone];
  const Icon = variant.icon;
  return (
    <span
      role="status"
      aria-label={`Position status: ${label}`}
      data-tone={tone}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium ring-1",
        variant.bg,
        variant.fg,
        variant.ring,
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-2.5 py-1 text-sm",
        size === "lg" && "px-3 py-1.5 text-base",
        className,
      )}
    >
      <Icon aria-hidden className={size === "lg" ? "size-5" : "size-4"} />
      <span>{label}</span>
    </span>
  );
}
