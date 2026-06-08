import { NextResponse } from "next/server";

/**
 * Live USDC supply APYs for the major money markets, from DefiLlama's free yields
 * API (no key). Cached 1h. Used by the /lend APY comparison — the PRD's #1
 * adoption lever for the Aave Migrator. Always returns 200 (pools may be empty +
 * carry an error) so the client degrades gracefully.
 */
export const revalidate = 3600;

const TARGETS = [
  { key: "aave", label: "Aave v3", project: "aave-v3", chains: ["Arbitrum", "Ethereum"] },
  { key: "spark", label: "Spark", project: "spark", chains: ["Ethereum"] },
  { key: "morpho", label: "Morpho", project: "morpho-blue", chains: ["Ethereum", "Base"] },
];

interface LlamaPool {
  project: string;
  symbol: string;
  chain: string;
  tvlUsd: number;
  apyBase?: number | null;
  apy?: number | null;
}

export async function GET() {
  try {
    const res = await fetch("https://yields.llama.fi/pools", { next: { revalidate: 3600 } });
    if (!res.ok) return NextResponse.json({ pools: [], error: `upstream ${res.status}` });
    const json = (await res.json()) as { data?: LlamaPool[] };
    const data = json.data ?? [];
    const pools = TARGETS.map((t) => {
      const cands = data.filter(
        (p) => p.project === t.project && p.symbol?.toUpperCase() === "USDC" && t.chains.includes(p.chain),
      );
      if (cands.length === 0) return { key: t.key, label: t.label, apy: null as number | null };
      const best = cands.slice().sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0))[0]!;
      const apy = best.apyBase ?? best.apy ?? null;
      return { key: t.key, label: t.label, apy: apy != null ? Math.round(apy * 100) / 100 : null };
    });
    return NextResponse.json({ pools });
  } catch (e) {
    return NextResponse.json({ pools: [], error: (e as Error).message });
  }
}
