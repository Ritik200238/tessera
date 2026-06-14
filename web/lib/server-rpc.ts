import { createPublicClient, fallback, http, type PublicClient } from "viem";
import { activeChain } from "./chain";

/**
 * Server-side viem client for API routes (the public Risk API). Reads the SAME
 * active chain the browser app uses (driven by NEXT_PUBLIC_CHAIN_ENV), so the
 * Risk API can never serve a different chain's vault than the UI shows. Spreads
 * reads across the active chain's endpoints so one provider outage can't take
 * the API down. Distinct from the browser wagmi config in lib/wagmi.ts.
 */
const RPCS = [
  process.env.NEXT_PUBLIC_RPC_URL,
  ...(activeChain.rpcUrls.default.http ?? []),
].filter((u, i, a): u is string => !!u && a.indexOf(u) === i);

export const serverPublicClient: PublicClient = createPublicClient({
  chain: activeChain,
  transport: fallback(RPCS.map((u) => http(u))),
});
