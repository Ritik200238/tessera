"use client";

import { useEffect, useState } from "react";
import { marketStatus, type MarketStatus } from "@/lib/equities";

/** Live US-market open/closed pill. Renders only after mount to avoid an
 *  SSR/client hydration mismatch around the session boundary. */
export function MarketBadge({ className = "" }: { className?: string }) {
  const [status, setStatus] = useState<MarketStatus | null>(null);
  useEffect(() => {
    setStatus(marketStatus());
    const i = setInterval(() => setStatus(marketStatus()), 30_000);
    return () => clearInterval(i);
  }, []);

  if (!status) {
    return (
      <span
        className={
          "inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border)] px-2.5 py-1 text-xs " +
          className
        }
      >
        <span className="size-2 rounded-full bg-[color:var(--faint)]" />
        Markets
      </span>
    );
  }

  const color = status.isOpen
    ? "var(--color-safe-fg)"
    : status.state === "closed"
      ? "var(--faint)"
      : "var(--color-watch-fg)";

  return (
    <span
      title="US equities regular session: 9:30–16:00 ET, Mon–Fri. Tessera operates 24/7 on last close."
      className={
        "inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border)] px-2.5 py-1 text-xs " +
        className
      }
    >
      <span aria-hidden className="size-2 rounded-full" style={{ background: color }} />
      {status.label}
    </span>
  );
}
