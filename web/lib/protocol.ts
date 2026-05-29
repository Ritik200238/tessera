"use client";

/**
 * Live protocol stats, read straight from the deployed vault. This is the
 * single source of truth for headline numbers (TVL, borrows, rates,
 * utilization) so the landing and the transparency/status pages never show
 * invented figures — only what is true on-chain right now.
 */

import { useReadContracts } from "wagmi";
import { vault, isVaultDeployed } from "./contracts";

export interface ProtocolStats {
  deployed: boolean;
  loading: boolean;
  /** USDC supplied to the pool (6 decimals). ERC-4626 totalAssets. */
  tvlUsdc: bigint;
  /** Outstanding borrow principal (6 decimals). */
  borrowsUsdc: bigint;
  /** Supply APY, basis points. */
  supplyBps: number;
  /** Borrow APR, basis points. */
  borrowBps: number;
  /** Utilization, basis points. */
  utilBps: number;
  /** Number of listed collateral assets. */
  listedAssets: number;
  paused: boolean;
}

export function useProtocolStats(): ProtocolStats {
  const deployed = isVaultDeployed();
  const v = vault.address ?? undefined;

  const { data, isLoading } = useReadContracts({
    contracts: deployed
      ? [
          { address: v, abi: vault.abi, functionName: "totalAssets" },
          { address: v, abi: vault.abi, functionName: "totalPrincipal" },
          { address: v, abi: vault.abi, functionName: "supplyRateBps" },
          { address: v, abi: vault.abi, functionName: "borrowRateBps" },
          { address: v, abi: vault.abi, functionName: "utilizationBps" },
          { address: v, abi: vault.abi, functionName: "listedAssetCount" },
          { address: v, abi: vault.abi, functionName: "paused" },
        ]
      : [],
    query: { enabled: deployed, refetchInterval: 15_000 },
  });

  const num = (i: number) => Number((data?.[i]?.result as bigint | number | undefined) ?? 0);

  return {
    deployed,
    loading: deployed && isLoading,
    tvlUsdc: (data?.[0]?.result as bigint | undefined) ?? 0n,
    borrowsUsdc: (data?.[1]?.result as bigint | undefined) ?? 0n,
    supplyBps: num(2),
    borrowBps: num(3),
    utilBps: num(4),
    listedAssets: num(5),
    paused: (data?.[6]?.result as boolean | undefined) ?? false,
  };
}

/** USDC base units (6 decimals) → adaptive USD string. $1,234.56 under $1M, $48.2M above. */
export function formatUsdcUsd(value: bigint, opts: { compact?: boolean } = {}): string {
  const dollars = Number(value) / 1e6;
  if (opts.compact) {
    if (dollars >= 1_000_000_000) return `$${(dollars / 1e9).toFixed(2)}B`;
    if (dollars >= 1_000_000) return `$${(dollars / 1e6).toFixed(1)}M`;
    if (dollars >= 1_000) return `$${(dollars / 1e3).toFixed(1)}K`;
  }
  return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
