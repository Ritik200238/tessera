"use client";

import { useReadContract } from "wagmi";
import { vault } from "@/lib/contracts";

/**
 * True when the vault is paused (admin/emergency). Every write form gates its
 * submit on this so the action is pre-disabled — not just reverted — when the
 * protocol is paused. Mirrors the global PausedBanner.
 */
export function usePaused(): boolean {
  const { data } = useReadContract({
    address: vault.address ?? undefined,
    abi: vault.abi,
    functionName: "paused",
    query: { enabled: vault.address !== null, refetchInterval: 15_000 },
  });
  return data === true;
}
