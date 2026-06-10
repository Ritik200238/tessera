import { createConfig, http } from "wagmi";
import { fallback } from "viem";
import { injected, walletConnect } from "wagmi/connectors";
import { arbitrumSepolia, mainnet } from "wagmi/chains";
import { getDefaultConfig } from "connectkit";
import { activeChain, supportedChains } from "./chain";
import { env } from "./env";

/**
 * wagmi v2 + ConnectKit configuration.
 *
 * We expose two entry points so non-browser code paths (server components,
 * tests) don't pull WalletConnect's IIFE which expects `window`.
 *
 * Privacy/resilience: reads/writes are spread across several RPC providers via
 * fallback() so no single provider sees every user's (IP, wallet, query) and a
 * single provider can't censor or break the app. Set NEXT_PUBLIC_RPC_URL to your
 * own node to keep your traffic fully private (it is tried first).
 */

// Public Arbitrum Sepolia endpoints used as fallbacks behind the configured RPC.
const SEPOLIA_RPCS = [
  env.rpcUrl,
  activeChain.rpcUrls.default.http[0],
  "https://arbitrum-sepolia-rpc.publicnode.com",
  "https://arbitrum-sepolia.drpc.org",
].filter((u, i, a): u is string => !!u && a.indexOf(u) === i);

const activeTransport = fallback(SEPOLIA_RPCS.map((u) => http(u)));

const transports = Object.fromEntries(
  supportedChains.map((c) => [c.id, http()]),
) as Record<number, ReturnType<typeof http>>;

export const wagmiConfig = createConfig(
  getDefaultConfig({
    chains: supportedChains,
    transports: {
      ...transports,
      [activeChain.id]: activeTransport,
      [arbitrumSepolia.id]: activeTransport,
      // ConnectKit adds mainnet for ENS lookups; without an explicit transport
      // viem falls back to eth.merkle.io, which blocks browser CORS and litters
      // the console with failed requests (QA M6). Route ENS through a
      // CORS-friendly public endpoint instead.
      [mainnet.id]: http("https://ethereum-rpc.publicnode.com"),
    },
    walletConnectProjectId: env.walletConnectProjectId || "tessera-dev",
    appName: "Tessera",
    appDescription: "AI-protected lending on tokenized stocks.",
    appUrl: "https://tessera.finance",
    connectors: [
      injected({ shimDisconnect: true }),
      ...(env.walletConnectProjectId
        ? [walletConnect({ projectId: env.walletConnectProjectId, showQrModal: false })]
        : []),
    ],
    ssr: true,
  }),
);

declare module "wagmi" {
  // Strongly type the active config so `useAccount` etc. return the right chains.
  interface Register {
    config: typeof wagmiConfig;
  }
}
