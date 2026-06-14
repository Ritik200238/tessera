"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useChainGuard } from "@/lib/use-chain-guard";

/**
 * Shown inside a write form when the connected wallet is on the wrong network.
 * Explains why the action is disabled and offers a one-tap switch — so a wrong
 * network is a clear, recoverable state instead of a silently disabled button.
 */
export function WrongChainNotice() {
  const { wrongChain, activeChainName, isSwitching, switchToActive } = useChainGuard();
  if (!wrongChain) return null;
  return (
    <Alert tone="warning">
      <AlertTitle>Wrong network</AlertTitle>
      <AlertDescription>
        Your wallet is on a different network. Tessera runs on <strong>{activeChainName}</strong>.{" "}
        <button
          type="button"
          onClick={switchToActive}
          disabled={isSwitching}
          className="font-medium underline underline-offset-2 disabled:opacity-50"
        >
          {isSwitching ? "Switching…" : `Switch to ${activeChainName}`}
        </button>
      </AlertDescription>
    </Alert>
  );
}
