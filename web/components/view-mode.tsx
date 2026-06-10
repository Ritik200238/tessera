"use client";

import { useEffect, useState } from "react";
import { Gauge, Sparkles } from "lucide-react";

/**
 * Simple ⇄ Advanced view mode (the brief's "three-surface" idea, scoped safely).
 * Default is Advanced — our primary persona (and judges) are DeFi-native and
 * want the metrics, so we never hide anything by default. Simple mode hides the
 * jargon-heavy panels wrapped in <AdvancedOnly>. Implemented as a data attribute
 * + CSS (display:contents → none), so there's no hydration mismatch and no
 * layout shift: the content is always in the DOM, just CSS-hidden.
 */
const KEY = "tessera-view";
type Mode = "advanced" | "simple";

export function ViewModeToggle() {
  const [mode, setMode] = useState<Mode>("advanced");
  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as Mode | null) ?? "advanced";
    setMode(saved);
    document.documentElement.dataset.view = saved;
  }, []);

  function toggle() {
    const next: Mode = mode === "advanced" ? "simple" : "advanced";
    setMode(next);
    localStorage.setItem(KEY, next);
    document.documentElement.dataset.view = next;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${mode === "advanced" ? "simple" : "advanced"} view`}
      title={mode === "advanced" ? "Showing advanced metrics — switch to Simple" : "Simple view — switch to Advanced"}
      className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-[color:var(--color-border)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-muted)] hover:text-[color:var(--color-foreground)]"
    >
      {mode === "advanced" ? <Gauge aria-hidden className="size-3.5" /> : <Sparkles aria-hidden className="size-3.5" />}
      {mode === "advanced" ? "Advanced" : "Simple"}
    </button>
  );
}

/** Renders children only in Advanced view (CSS-gated, layout-transparent). */
export function AdvancedOnly({ children }: { children: React.ReactNode }) {
  return <div className="tessera-advanced">{children}</div>;
}
