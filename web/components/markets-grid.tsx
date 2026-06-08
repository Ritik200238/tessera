"use client";

import { useReadContracts, useWatchBlockNumber } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { addresses } from "@/lib/addresses";
import { vault, oracle, isVaultDeployed } from "@/lib/contracts";
import { assetMeta } from "@/lib/equities";
import { formatUsd8, formatBps } from "@/lib/format";

/**
 * Live markets grid for the landing page (replaces the old hardcoded 5-asset
 * grid with invented prices). Reads ONLY the collateral actually listed on-chain
 * (`shared/addresses` → 3 assets) and shows each asset's LIVE oracle price
 * (`oracle.getFeed`) and on-chain risk params (`vault.assetParams`), refreshed
 * every block. Each card links to the token on Arbiscan. Nothing here is faked —
 * values render "—" until the reads resolve.
 */
const EXPLORER = "https://sepolia.arbiscan.io";

export function MarketsGrid() {
  const tokens = addresses.collateralTokens;
  const enabled = isVaultDeployed() && oracle.address !== null && tokens.length > 0;

  const { data, queryKey } = useReadContracts({
    contracts: enabled
      ? tokens.flatMap((t) => [
          { address: oracle.address!, abi: oracle.abi, functionName: "getFeed", args: [t.address] } as const,
          { address: vault.address!, abi: vault.abi, functionName: "assetParams", args: [t.address] } as const,
        ])
      : [],
    query: { enabled, refetchInterval: 30_000 },
  });

  const queryClient = useQueryClient();
  useWatchBlockNumber({
    enabled,
    onBlockNumber: () => void queryClient.invalidateQueries({ queryKey }),
  });

  return (
    <div className="mkt-grid">
      {tokens.map((t, i) => {
        const meta = assetMeta(t.symbol);
        const ticker = t.symbol.replace(/^t/, "");
        const feed = data?.[i * 2]?.result as readonly [bigint, bigint, bigint, boolean] | undefined;
        const params = data?.[i * 2 + 1]?.result as readonly [boolean, number, number, number, number] | undefined;
        const price = feed ? formatUsd8(feed[0] > 0n ? feed[0] : 0n) : "—";
        const ltv = params ? formatBps(params[2]) : "—";
        const liq = params ? formatBps(params[3]) : "—";

        return (
          <div className="mcard reveal" key={t.symbol}>
            <div className="mh">
              <div className="gl">{ticker.slice(0, 2)}</div>
              <span className="ut">{meta.sector}</span>
            </div>
            <div className="tk">{ticker}</div>
            <div className="nm">{meta.name}</div>
            <div className="px">{price}</div>
            <div className="row">
              <span className="k">LTV</span>
              <span className="v">{ltv}</span>
            </div>
            <div className="row" style={{ borderTop: 0, paddingTop: 6 }}>
              <span className="k">Liq. threshold</span>
              <span className="v">{liq}</span>
            </div>
            <a
              href={`${EXPLORER}/address/${t.address}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-block", marginTop: 12, fontSize: "0.75rem", opacity: 0.7, textDecoration: "underline" }}
            >
              View on Arbiscan ↗
            </a>
          </div>
        );
      })}
    </div>
  );
}
