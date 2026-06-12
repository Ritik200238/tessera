"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { activeChain } from "./chain";

/**
 * Wallet-on-wrong-network guard.
 *
 * Reads (balanceOf, etc.) always hit the app's active chain RPC, but a *write*
 * goes to whatever chain the wallet is on. If those differ, a tx is submitted on
 * the wrong chain while `useWaitForTransactionReceipt` watches the active chain —
 * so the UI hangs on "Approving…/Depositing…" forever with no error, and
 * balances read 0.
 *
 * Every form that writes should: (1) block its action when `wrongChain` and
 * offer `switchToActive`, and (2) pass `writeChainId` to `writeContract` so even
 * a slipped-through write fails loudly (ChainMismatchError) instead of hanging.
 */
export function useChainGuard() {
  const { isConnected, chainId: walletChainId } = useAccount();
  const { switchChain, switchChainAsync, isPending } = useSwitchChain();

  const wrongChain =
    isConnected && walletChainId !== undefined && walletChainId !== activeChain.id;

  return {
    /** True when connected but on a network other than the app's active chain. */
    wrongChain,
    /** The chain id every writeContract call should pin. */
    writeChainId: activeChain.id,
    activeChainName: activeChain.name,
    isSwitching: isPending,
    switchToActive: () => switchChain({ chainId: activeChain.id }),
    switchToActiveAsync: () => switchChainAsync({ chainId: activeChain.id }),
  };
}
