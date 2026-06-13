"use client";

/** Opens the browser print dialog so a print-optimized page can be saved as PDF. */
export function PrintButton({ label = "Download as PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center rounded-md border border-[color:var(--color-border)] px-4 text-sm font-medium transition-colors hover:bg-[color:var(--color-muted)] print:hidden"
    >
      {label} ↓
    </button>
  );
}
