import { NextResponse } from "next/server";

/**
 * Live USDC supply APYs for the major money markets, from DefiLlama's free
 * yields API (no key). Used by the /lend APY comparison — the PRD's #1 adoption
 * lever for the Aave Migrator.
 *
 * Robustness (QA M2): the route is FORCE-DYNAMIC — with static rendering a
 * failed build-time fetch gets frozen into the deployment as `pools: []` for
 * the life of the build, which is exactly what shipped. The ~14MB upstream
 * response also exceeds Next's 2MB data-cache limit, so we memoize in module
 * scope (1h TTL) instead and fetch with no-store. Slugs verified against the
 * live API (spark is `sparklend`, not `spark`); chain filter falls back to
 * any-chain so a venue never silently vanishes. Always returns 200 — the
 * client renders whatever rows exist.
 */
export const dynamic = "force-dynamic";

const TARGETS = [
  { key: "aave", label: "Aave v3", projects: ["aave-v3"], chains: ["Arbitrum", "Ethereum"] },
  { key: "spark", label: "Spark", projects: ["sparklend", "spark-savings"], chains: ["Ethereum"] },
  { key: "morpho", label: "Morpho", projects: ["morpho-blue", "morpho"], chains: ["Ethereum", "Base"] },
];

interface LlamaPool {
  project: string;
  symbol: string;
  chain: string;
  tvlUsd: number;
  apyBase?: number | null;
  apy?: number | null;
}

interface PoolRow {
  key: string;
  label: string;
  apy: number | null;
}

let cache: { at: number; pools: PoolRow[] } | null = null;
const TTL_MS = 60 * 60 * 1000;

function pick(data: LlamaPool[], t: (typeof TARGETS)[number]): PoolRow {
  const usdc = data.filter(
    (p) => t.projects.includes(p.project) && p.symbol?.toUpperCase() === "USDC",
  );
  const preferred = usdc.filter((p) => t.chains.includes(p.chain));
  const cands = preferred.length > 0 ? preferred : usdc; // any-chain fallback
  if (cands.length === 0) return { key: t.key, label: t.label, apy: null };
  const best = cands.slice().sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0))[0]!;
  const apy = best.apyBase ?? best.apy ?? null;
  return { key: t.key, label: t.label, apy: apy != null ? Math.round(apy * 100) / 100 : null };
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json({ pools: cache.pools, cached: true });
  }
  try {
    const res = await fetch("https://yields.llama.fi/pools", { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ pools: cache?.pools ?? [], error: `upstream ${res.status}` });
    }
    const json = (await res.json()) as { data?: LlamaPool[] };
    const pools = TARGETS.map((t) => pick(json.data ?? [], t));
    cache = { at: Date.now(), pools };
    return NextResponse.json({ pools });
  } catch (e) {
    return NextResponse.json({ pools: cache?.pools ?? [], error: (e as Error).message });
  }
}
