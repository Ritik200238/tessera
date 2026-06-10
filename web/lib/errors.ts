/**
 * Decode on-chain / wallet errors into plain English for end users.
 *
 * wagmi surfaces raw viem `BaseError`s whose `.message` is a multi-line developer
 * dump ("execution reverted: 0x...", ABI traces, docs links). Showing that to a
 * borrower is hostile. This walks the error chain to find the meaningful cause —
 * a user rejection, a known vault custom error, or a revert reason — and maps it
 * to a short, human sentence. Vault error names come from the canonical ABI
 * (shared/abis/TesseraVault.json).
 */

import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError, keccak256, toBytes } from "viem";
import { vault } from "@/lib/contracts";

/**
 * Custom-error SELECTOR → name, built from the canonical ABI. Gas-estimation
 * reverts (eth_estimateGas) surface as a raw `0x12345678` selector with no
 * decoded errorName — the path QA M9 hit — so we decode it ourselves.
 */
const SELECTOR_TO_NAME: Record<string, string> = {};
for (const item of vault.abi as readonly { type: string; name?: string; inputs?: { type: string }[] }[]) {
  if (item.type === "error" && item.name) {
    const sig = `${item.name}(${(item.inputs ?? []).map((i) => i.type).join(",")})`;
    SELECTOR_TO_NAME[keccak256(toBytes(sig)).slice(0, 10)] = item.name;
  }
}

/** Map any embedded custom-error selector in a message to its plain-English text. */
function fromSelector(message: string): string | null {
  for (const m of message.matchAll(/0x[0-9a-fA-F]{8}\b/g)) {
    const name = SELECTOR_TO_NAME[m[0].toLowerCase()];
    if (name && VAULT_ERRORS[name]) return VAULT_ERRORS[name];
  }
  return null;
}

/** Vault custom errors → plain-English guidance. Keep in sync with the contract. */
const VAULT_ERRORS: Record<string, string> = {
  NotOwner: "Only the protocol owner can do that.",
  NotAgent: "Only the AI agent is allowed to call this.",
  Paused: "The protocol is paused right now — try again later.",
  NotPaused: "The protocol isn't paused.",
  Reentrancy: "The transaction was blocked as a reentrant call.",
  AssetNotEnabled: "That asset isn't currently accepted as collateral.",
  AssetAlreadyListed: "That asset is already listed.",
  InvalidParameter: "One of the values was invalid.",
  ZeroAddress: "A required address was missing.",
  ZeroAmount: "Enter an amount greater than zero.",
  InsufficientBalance: "You don't have enough balance for that.",
  InsufficientLiquidity: "The pool doesn't have enough available USDC to withdraw right now.",
  TokenTransferFailed: "The token transfer failed — check your balance and approval.",
  StalePrice: "The price feed is stale. It refreshes shortly — please try again.",
  OracleFailure: "The price oracle is unavailable right now. Please try again soon.",
  HealthFactorTooLow: "That would push your position below the safe threshold. Borrow less, repay some debt, or add collateral.",
  PositionHealthy: "This position is healthy, so it can't be liquidated.",
  ZeroShares: "That amount is too small — it rounds to zero. Try a larger amount.",
  Overflow: "That number is out of the supported range.",
};

/** ERC-20 style failures that bubble up as plain revert strings. */
function fromReason(reason: string): string | null {
  const r = reason.toLowerCase();
  if (r.includes("insufficient allowance")) return "You need to approve the token first.";
  if (r.includes("transfer amount exceeds balance") || r.includes("insufficient balance")) {
    return "You don't have enough balance for that.";
  }
  if (r.includes("erc20: insufficient")) return "Token balance or approval is too low.";
  return null;
}

export function decodeTxError(err: unknown): string {
  if (!err) return "Something went wrong. Please try again.";

  if (err instanceof BaseError) {
    // 1. User declined in their wallet — the most common "error".
    if (err.walk((e) => e instanceof UserRejectedRequestError)) {
      return "You rejected the request in your wallet.";
    }

    // 2. A contract revert — prefer a named custom error, then a reason string.
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName;
      if (name && VAULT_ERRORS[name]) return VAULT_ERRORS[name];
      if (revert.reason) {
        const mapped = fromReason(revert.reason);
        if (mapped) return mapped;
        return revert.reason;
      }
      if (name) return `Transaction reverted (${name}).`;
    }

    // 3. Custom-error selector embedded in the message (gas-estimation reverts
    // carry the raw selector instead of a decoded errorName — QA M9).
    const bySelector = fromSelector(err.message ?? "");
    if (bySelector) return bySelector;

    // 4. Gas / funds heuristics from the short message.
    const short = err.shortMessage ?? err.message;
    if (short) {
      const s = short.toLowerCase();
      if (s.includes("insufficient funds")) return "Not enough ETH in your wallet to pay for gas.";
      if (s.includes("gas required exceeds") || s.includes("out of gas")) {
        return "The transaction would run out of gas. It may revert — check your inputs.";
      }
      const mapped = fromReason(short);
      if (mapped) return mapped;
      // Last resort: never show a multi-line viem dump in a user-facing alert.
      const firstLine = short.split("\n")[0]!;
      return firstLine.length > 200 ? `${firstLine.slice(0, 200)}…` : firstLine;
    }
  }

  const msg = (err as { message?: string })?.message ?? String(err);
  return msg.length > 160 ? `${msg.slice(0, 160)}…` : msg;
}
