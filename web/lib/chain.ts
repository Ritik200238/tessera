import { defineChain, type Chain } from "viem";
import { arbitrumSepolia, foundry } from "viem/chains";
import { env } from "./env";

/**
 * Chain registry.
 *
 * NOTE on Robinhood Chain (TDD §5.4 / §20):
 *   At the time of writing the official Robinhood Chain testnet chain ID
 *   and RPC are not published in the cloned Arbitrum docs (`docs/`) — we
 *   deliberately do NOT hard-code a chain ID we cannot verify. Instead the
 *   testnet chain is parameterised through `NEXT_PUBLIC_RPC_CHAIN_ID`,
 *   `NEXT_PUBLIC_RPC_URL`, and `NEXT_PUBLIC_RPC_CHAIN_NAME` so the agent
 *   handling the network bring-up can wire the real values without code
 *   changes. The fallback path uses Arbitrum Sepolia (421614), which is
 *   the documented MVP fallback (TDD §10).
 */

const ROBINHOOD_CHAIN_ID_FALLBACK = 0; // unset — see note above
const DEFAULT_ROBINHOOD_RPC = "https://rpc.testnet.robinhood.chain"; // placeholder

function robinhoodChainTestnet(): Chain {
  const idStr = env.rpcChainId;
  const id = idStr ? Number(idStr) : ROBINHOOD_CHAIN_ID_FALLBACK;
  if (!Number.isInteger(id) || id <= 0) {
    // We surface a loud, structured warning rather than throwing — the
    // landing page still has to render so the user can read the docs.
    if (typeof window === "undefined") {
      console.warn(
        "[tessera/chain] NEXT_PUBLIC_RPC_CHAIN_ID is not set. " +
          "Robinhood Chain config will be unusable until it is provided. " +
          "Set NEXT_PUBLIC_CHAIN_ENV=fallback to use Arbitrum Sepolia for local dev.",
      );
    }
  }
  return defineChain({
    id: id > 0 ? id : 1, // viem requires id > 0; UI will detect this state and show a banner
    name: env.rpcChainName || "Robinhood Chain Testnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: [env.rpcUrl || DEFAULT_ROBINHOOD_RPC] },
    },
    testnet: true,
  });
}

export const robinhoodTestnet: Chain = robinhoodChainTestnet();

export const localFoundry: Chain = {
  ...foundry,
  rpcUrls: {
    default: { http: [env.rpcUrl || foundry.rpcUrls.default.http[0]] },
  },
};

/** The chain currently active for this build, based on NEXT_PUBLIC_CHAIN_ENV. */
export function getActiveChain(): Chain {
  switch (env.chainEnv) {
    case "fallback":
      return arbitrumSepolia;
    case "local":
      return localFoundry;
    case "testnet":
    default:
      return robinhoodTestnet;
  }
}

export const activeChain = getActiveChain();

/** All chains we configure connectors for. */
export const supportedChains: readonly [Chain, ...Chain[]] = [
  activeChain,
  arbitrumSepolia,
];

export function isChainConfigured(): boolean {
  // True when we have at least an RPC + a positive chain id distinct from
  // the placeholder fallback (id=1 on Robinhood path).
  if (env.chainEnv !== "testnet") return true;
  return env.rpcChainId !== "" && Number(env.rpcChainId) > 0 && env.rpcUrl !== "";
}
