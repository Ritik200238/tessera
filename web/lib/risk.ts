import type { Address } from "viem";
import { serverPublicClient } from "./server-rpc";
import { activeChain } from "./chain";
import { vault, lens, oracle } from "./contracts";
import { addresses } from "./addresses";
import { assessRegime, hfToNumber } from "./regime";

/**
 * Tessera public Risk API surface (scale T3). Tessera's whole thesis is being
 * the AI risk layer for tokenized equities, so we expose that risk read-only and
 * machine-readable — for other apps, dashboards, and (via the MCP server) AI
 * agents. All values are real on-chain reads + the same deterministic regime
 * engine the agent uses. Read-only; never moves funds.
 */
const STALE_WINDOW_SECS = 86_400;

export interface MarketRisk {
  chain: string;
  asOf: string;
  regime: string;
  regimeLabel: string;
  earningsNear: boolean;
  aiActsBelowHf: number;
  restoresTowardHf: number;
  liquidationHf: number;
  assets: { symbol: string; address: string; priceUsd: number | null; oracleAgeSecs: number | null; stale: boolean }[];
  explanation: string;
}

export interface PositionRisk {
  address: string;
  asOf: string;
  exists: boolean;
  healthFactor: number | null;
  safetyScore: number | null;
  debtUsdc: number | null;
  regime: string;
  aiActsBelowHf: number;
  restoresTowardHf: number;
  liquidationHf: number;
  atRisk: boolean;
  dropToAiActPct: number;
  verdict: string;
}

export async function getMarketRisk(): Promise<MarketRisk> {
  const reg = assessRegime(new Date());
  const nowSec = Math.floor(Date.now() / 1000);
  const assets = await Promise.all(
    addresses.collateralTokens.map(async (t) => {
      let priceUsd: number | null = null;
      let oracleAgeSecs: number | null = null;
      if (oracle.address) {
        try {
          const f = (await serverPublicClient.readContract({
            address: oracle.address,
            abi: oracle.abi,
            functionName: "getFeed",
            args: [t.address as Address],
          })) as readonly [bigint, bigint, bigint, boolean];
          priceUsd = Number(f[0]) / 1e8;
          oracleAgeSecs = nowSec - Number(f[1]);
        } catch {
          /* feed unavailable */
        }
      }
      return {
        symbol: t.symbol,
        address: t.address,
        priceUsd,
        oracleAgeSecs,
        stale: oracleAgeSecs !== null && oracleAgeSecs > STALE_WINDOW_SECS,
      };
    }),
  );
  return {
    chain: activeChain.name,
    asOf: new Date().toISOString(),
    regime: reg.regime,
    regimeLabel: reg.label,
    earningsNear: reg.earningsNear,
    aiActsBelowHf: hfToNumber(reg.alertThresholdHf),
    restoresTowardHf: hfToNumber(reg.protectTargetHf),
    liquidationHf: 1,
    assets,
    explanation: `Tessera's AI raises its protection bands with gap risk. Right now (${reg.label}) it auto-repays a covered position when its health factor falls below ${hfToNumber(reg.alertThresholdHf).toFixed(2)}, restoring toward ${hfToNumber(reg.protectTargetHf).toFixed(2)}; liquidation only below 1.00.`,
  };
}

export async function getPositionRisk(address: Address): Promise<PositionRisk> {
  if (!vault.address) throw new Error("vault not deployed in this environment");
  const reg = assessRegime(new Date());
  const actAt = hfToNumber(reg.alertThresholdHf);
  const protectAt = hfToNumber(reg.protectTargetHf);

  const res = await serverPublicClient.multicall({
    contracts: [
      { address: vault.address, abi: vault.abi, functionName: "getHealthFactor", args: [address] },
      { address: vault.address, abi: vault.abi, functionName: "debtOf", args: [address] },
      // getSafetyScore moved to the Lens (falls back to the vault on older deploys).
      { address: lens.address ?? vault.address, abi: lens.abi, functionName: "getSafetyScore", args: [address] },
    ],
    allowFailure: true,
  });
  const hfRaw = res[0]?.status === "success" ? (res[0].result as bigint) : null;
  const debtRaw = res[1]?.status === "success" ? (res[1].result as bigint) : null;
  const scoreRaw = res[2]?.status === "success" ? Number(res[2].result as bigint) : null;

  const hf = hfRaw !== null ? hfToNumber(hfRaw) : null;
  const debtUsdc = debtRaw !== null ? Number(debtRaw) / 1e6 : null;
  const exists = (debtUsdc ?? 0) > 0;
  const atRisk = hf !== null && exists && hf < actAt;
  const dropToAiActPct = hf !== null && hf > actAt ? Math.round((1 - actAt / hf) * 100) : 0;

  let verdict: string;
  if (!exists) verdict = "No open debt for this address.";
  else if (hf === null)
    verdict = "Health factor temporarily unavailable (an oracle refresh is pending) — the debt is real; check back shortly.";
  else if (atRisk) verdict = `At-risk: the AI auto-repays a covered position here, restoring toward ${protectAt.toFixed(2)}.`;
  else verdict = `Healthy: collateral would have to fall ~${dropToAiActPct}% before the AI steps in (regime: ${reg.regime}).`;

  return {
    address,
    asOf: new Date().toISOString(),
    exists,
    healthFactor: hf !== null && hf > 1e6 ? null : hf, // suppress the "no debt" sentinel
    safetyScore: scoreRaw,
    debtUsdc,
    regime: reg.regime,
    aiActsBelowHf: actAt,
    restoresTowardHf: protectAt,
    liquidationHf: 1,
    atRisk,
    dropToAiActPct,
    verdict,
  };
}
