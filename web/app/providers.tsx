"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useAccount } from "wagmi";
import { ConnectKitProvider } from "connectkit";
import { wagmiConfig } from "@/lib/wagmi";
import { track } from "@/lib/analytics";

/** Fires the `wallet_connected` funnel event once per connection. */
function FunnelTracker() {
  const { isConnected, address } = useAccount();
  const fired = useRef(false);
  useEffect(() => {
    if (isConnected && address && !fired.current) {
      fired.current = true;
      track("wallet_connected");
    }
    if (!isConnected) fired.current = false;
  }, [isConnected, address]);
  return null;
}

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
          <FunnelTracker />
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
