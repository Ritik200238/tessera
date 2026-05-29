/**
 * Public env access.
 *
 * Only `NEXT_PUBLIC_*` keys may be referenced from client code; this module
 * is the single ingest point so we can swap in stricter validation later
 * without rewriting call sites.
 */

export type ChainEnv = "testnet" | "fallback" | "local";

function readChainEnv(): ChainEnv {
  const raw = process.env.NEXT_PUBLIC_CHAIN_ENV;
  if (raw === "testnet" || raw === "fallback" || raw === "local") return raw;
  // Default to the documented MVP target.
  return "testnet";
}

export const env = {
  chainEnv: readChainEnv(),
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? "",
  rpcChainId: process.env.NEXT_PUBLIC_RPC_CHAIN_ID ?? "",
  rpcChainName: process.env.NEXT_PUBLIC_RPC_CHAIN_NAME ?? "",
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
  agentUrl: process.env.NEXT_PUBLIC_AGENT_URL ?? "",
  adminAddress: (process.env.NEXT_PUBLIC_ADMIN_ADDRESS ?? "").toLowerCase(),
  ownerAddress: (process.env.NEXT_PUBLIC_OWNER_ADDRESS ?? "").toLowerCase(),
} as const;
