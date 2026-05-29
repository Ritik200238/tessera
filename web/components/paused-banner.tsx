"use client";

import { useReadContract } from "wagmi";
import { Flame } from "lucide-react";
import { vault } from "@/lib/contracts";

/**
 * Shown when the vault is paused (admin-triggered or auto-paused via
 * emergency switch). All write actions in the app must also disable
 * themselves; this banner is the user-visible signal.
 */
export function PausedBanner() {
  const { data } = useReadContract({
    address: vault.address ?? undefined,
    abi: vault.abi,
    functionName: "paused",
    query: { enabled: vault.address !== null, refetchInterval: 15_000 },
  });

  if (data !== true) return null;

  return (
    <div
      role="alert"
      className="bg-[color:var(--color-liquidating-bg)] text-[color:var(--color-liquidating-fg)] border-b border-[color:var(--color-liquidating-fg)]/20"
    >
      <div className="mx-auto max-w-6xl flex items-center gap-3 px-4 py-2 text-sm">
        <Flame aria-hidden className="size-4 shrink-0" />
        <p>
          <strong>Vault paused.</strong> Deposits, borrows and withdrawals are temporarily disabled
          while the operator investigates. Existing positions remain protected by the agent.
        </p>
      </div>
    </div>
  );
}
