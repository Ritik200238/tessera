"use client";

import { ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { ConnectKitProvider } from "connectkit";
import { wagmiConfig } from "@/lib/wagmi";

/**
 * Client-side providers: wagmi (RPC + wallet state), react-query (data
 * cache), and ConnectKit (wallet selector UI). Mounted once at the root
 * layout.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Block subscriptions push fresh data; a moderate stale time
            // keeps the dashboard snappy without thrashing the RPC.
            staleTime: 10_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          options={{
            initialChainId: 0,
            enforceSupportedChains: false,
          }}
          theme="auto"
        >
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
