import { createPublicClient, fallback, http, type PublicClient } from "viem";
import { arbitrumSepolia } from "viem/chains";

/**
 * Server-side viem client for API routes (the public Risk API). Spreads reads
 * across several public Arb Sepolia endpoints so a single provider outage can't
 * take the API down. Distinct from the browser wagmi config in lib/wagmi.ts.
 */
const RPCS = [
  process.env.NEXT_PUBLIC_RPC_URL,
  "https://sepolia-rollup.arbitrum.io/rpc",
  "https://arbitrum-sepolia-rpc.publicnode.com",
  "https://arbitrum-sepolia.drpc.org",
].filter((u, i, a): u is string => !!u && a.indexOf(u) === i);

export const serverPublicClient: PublicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: fallback(RPCS.map((u) => http(u))),
});
