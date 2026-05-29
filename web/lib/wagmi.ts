import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { arbitrumSepolia } from "wagmi/chains";
import { getDefaultConfig } from "connectkit";
import { activeChain, supportedChains } from "./chain";
import { env } from "./env";

/**
 * wagmi v2 + ConnectKit configuration.
 *
 * We expose two entry points so non-browser code paths (server components,
 * tests) don't pull WalletConnect's IIFE which expects `window`.
 */

const transports = Object.fromEntries(
  supportedChains.map((c) => [c.id, http()]),
) as Record<number, ReturnType<typeof http>>;

export const wagmiConfig = createConfig(
  getDefaultConfig({
    chains: supportedChains,
    transports: {
      [activeChain.id]: http(activeChain.rpcUrls.default.http[0]),
      [arbitrumSepolia.id]: http(),
      ...transports,
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
