"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { activeChain, isChainConfigured } from "@/lib/chain";
import { AlertTriangle } from "lucide-react";

/**
 * Persistent banner shown when:
 *   1. The active chain ID could not be resolved from env (Robinhood Chain
 *      ID is still TBD — see lib/chain.ts), OR
 *   2. The connected wallet is on a different network than the active chain.
 */
export function ChainBanner() {
  const { chain: walletChain, isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (!isChainConfigured()) {
    return (
      <Banner>
        <AlertTriangle aria-hidden className="size-4 shrink-0" />
        <p>
          Network not configured. Set <code className="font-mono">NEXT_PUBLIC_RPC_URL</code> and{" "}
          <code className="font-mono">NEXT_PUBLIC_RPC_CHAIN_ID</code> in your env, or set{" "}
          <code className="font-mono">NEXT_PUBLIC_CHAIN_ENV=fallback</code> to use Arbitrum Sepolia.
        </p>
      </Banner>
    );
  }

  if (!isConnected || !walletChain) return null;
  if (walletChain.id === activeChain.id) return null;

  return (
    <Banner>
      <AlertTriangle aria-hidden className="size-4 shrink-0" />
      <p className="flex-1">
        You are connected to <strong>{walletChain.name}</strong>. Tessera runs on{" "}
        <strong>{activeChain.name}</strong>.
      </p>
      <button
        type="button"
        onClick={() => switchChain({ chainId: activeChain.id })}
        disabled={isPending}
        className="rounded-md border border-current px-2 py-1 text-xs font-medium hover:bg-black/5 disabled:opacity-50"
      >
        {isPending ? "Switching…" : `Switch to ${activeChain.name}`}
      </button>
    </Banner>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="bg-[color:var(--color-watch-bg)] text-[color:var(--color-watch-fg)] border-b border-[color:var(--color-watch-fg)]/20"
    >
      <div className="mx-auto max-w-6xl flex items-center gap-3 px-4 py-2 text-sm">{children}</div>
    </div>
  );
}
