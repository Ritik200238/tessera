"use client";

import { ConnectKitButton } from "connectkit";
import { cn } from "@/lib/utils";

/**
 * Top-nav wallet button. Renders a custom-styled trigger via ConnectKit's
 * render-props API so we keep our visual language consistent.
 */
export function ConnectButton({ className }: { className?: string }) {
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, isConnecting, show, address, ensName, chain }) => {
        const label = isConnected
          ? ensName ?? `${address?.slice(0, 6)}…${address?.slice(-4)}`
          : isConnecting
            ? "Connecting…"
            : "Connect wallet";
        return (
          <button
            type="button"
            onClick={show}
            aria-label={isConnected ? `Connected as ${label}` : "Connect a wallet"}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              "bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)] hover:opacity-90",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              className,
            )}
          >
            <span
              aria-hidden
              className={cn(
                "inline-block size-2 rounded-full",
                isConnected ? "bg-[color:var(--color-safe-fg)]" : "bg-[color:var(--faint)]",
              )}
            />
            <span>{label}</span>
            {isConnected && chain ? (
              <span className="hidden sm:inline text-xs opacity-80">· {chain.name}</span>
            ) : null}
          </button>
        );
      }}
    </ConnectKitButton.Custom>
  );
}
