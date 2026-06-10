"use client";

import { useEffect, useRef } from "react";
import { assessRegime, hfToNumber, LIQUIDATION_HF } from "@/lib/regime";
import { Button } from "@/components/ui/button";

/**
 * Mandatory gap-risk acknowledgment before a FIRST borrow (blueprint Stage C
 * §12). Tokenized stocks gap while the underlying market is closed — this modal
 * models exactly what an off-hours drop does to the user's REAL projected
 * position (no invented numbers: it scales the projected HF they configured),
 * and shows where the AI steps in for the current regime. The user must
 * explicitly acknowledge before the borrow tx is sent.
 */
const WAD = 1e18;
const MODELED_DROPS = [10, 20, 30] as const;

export function GapAckModal({
  open,
  projectedHf,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  /** 1e18-scaled projected HF after the borrow being signed. */
  projectedHf: bigint;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const reg = assessRegime(new Date());
  const hf = Number(projectedHf) / WAD;
  const actAt = hfToNumber(reg.alertThresholdHf);
  const liqAt = hfToNumber(LIQUIDATION_HF);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gap-ack-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-[color:var(--color-border)] bg-[color:var(--canvas,white)] p-6 shadow-xl">
        <h2 id="gap-ack-title" className="text-lg font-semibold tracking-tight">
          Stocks gap. Here&apos;s what that means for this loan.
        </h2>
        <p className="mt-2 text-sm text-[color:var(--color-muted-foreground)]">
          Tokenized stocks trade 24/7, but the underlying only reprices while the market is open —
          prices can jump overnight, over a weekend, or on earnings. Your position after this borrow
          (HF {hf.toFixed(2)}) under a modeled off-hours drop:
        </p>

        <ul className="mt-3 space-y-1.5 text-sm">
          {MODELED_DROPS.map((d) => {
            const post = hf * (1 - d / 100);
            const state =
              post < liqAt
                ? { text: "liquidatable — AI acts before this", cls: "text-[color:var(--color-liquidating-fg)]" }
                : post < actAt
                  ? { text: "AI alerts + auto-repays here", cls: "text-[color:var(--color-safe-fg)]" }
                  : { text: "still safe", cls: "text-[color:var(--color-muted-foreground)]" };
            return (
              <li
                key={d}
                className="flex items-baseline justify-between rounded-md border border-[color:var(--color-border)] px-3 py-1.5"
              >
                <span className="tabular-nums">−{d}% gap → HF {post.toFixed(2)}</span>
                <span className={"text-xs font-medium " + state.cls}>{state.text}</span>
              </li>
            );
          })}
        </ul>

        <p className="mt-3 text-xs text-[color:var(--color-muted-foreground)]">
          Right now ({reg.label}) the AI acts below HF {actAt.toFixed(2)} — and only if you enable
          Active Protection in step 3, repaying from USDC you pre-approve. A severe enough gap can
          still liquidate an unprotected or under-buffered position.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-medium text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-muted)]"
          >
            Go back
          </button>
          <Button ref={confirmRef} onClick={onConfirm}>
            I understand gap risk — borrow
          </Button>
        </div>
      </div>
    </div>
  );
}
