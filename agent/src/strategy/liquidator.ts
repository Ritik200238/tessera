/**
 * Liquidator — builds, simulates, and submits liquidate txs (TDD §4.3).
 *
 * Safety order:
 *   1. Pre-flight HF re-read (caller's responsibility — passed via `classifier`)
 *   2. Pre-flight USDC balance check
 *   3. Pre-flight gas cap check (against maxGasGwei)
 *   4. `eth_call` simulation of liquidate(...)
 *   5. ONLY on success: send tx
 *
 * Any failure short-circuits and logs a `skipped` or `reverted` action.
 */

import type {
  Account,
  Address,
  Hex,
  PublicClient,
  WalletClient,
} from "viem";
import { parseGwei } from "viem";
import { vaultAbi } from "../vault-client.js";
import { action } from "../log/action.js";
import type { JsonlLog } from "../log/jsonl.js";
import type { AgentDB } from "../db/index.js";

export interface LiquidateInput {
  borrower: Address;
  repayAmount: bigint;
  collateralToken: Address;
}

export interface LiquidatorDeps {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Account;
  vaultAddress: Address;
  /** Returns the agent wallet's USDC balance (raw units). */
  getUsdcBalance: () => Promise<bigint>;
  log: JsonlLog;
  db: AgentDB;
  /** Max gas price the agent will pay, in gwei. */
  maxGasGwei: number;
}

export type LiquidationOutcome =
  | { kind: "skipped"; reason: string }
  | { kind: "submitted"; tx: Hex; seizedEstimate: bigint }
  | { kind: "reverted"; reason: string };

const ZERO_HASH: Hex = "0x0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Try to liquidate `input.borrower`. Idempotent per (user, block):
 * a second call in the same block is rejected via the SQLite idempotency
 * table.
 */
export async function tryLiquidate(
  deps: LiquidatorDeps,
  input: LiquidateInput,
  blockNumber: number,
): Promise<LiquidationOutcome> {
  // 1. idempotency
  if (!deps.db.recordIdempotency(input.borrower, blockNumber, "attempt")) {
    const outcome: LiquidationOutcome = { kind: "skipped", reason: "already attempted this block" };
    deps.log.append(
      action.liquidate({
        user: input.borrower,
        tx: ZERO_HASH,
        repay: input.repayAmount,
        seized: 0n,
        token: input.collateralToken,
        status: "skipped",
        reason: outcome.reason,
      }),
    );
    return outcome;
  }

  // 2. USDC balance check
  const balance = await deps.getUsdcBalance();
  if (balance < input.repayAmount) {
    const reason = `insufficient USDC float: have ${balance}, need ${input.repayAmount}`;
    deps.log.append(
      action.liquidate({
        user: input.borrower,
        tx: ZERO_HASH,
        repay: input.repayAmount,
        seized: 0n,
        token: input.collateralToken,
        status: "skipped",
        reason,
      }),
    );
    return { kind: "skipped", reason };
  }

  // 3. Gas cap check
  const gasPrice = await deps.publicClient.getGasPrice();
  const cap = parseGwei(deps.maxGasGwei.toString());
  if (gasPrice > cap) {
    const reason = `gas price ${gasPrice} exceeds cap ${cap}`;
    deps.log.append(
      action.liquidate({
        user: input.borrower,
        tx: ZERO_HASH,
        repay: input.repayAmount,
        seized: 0n,
        token: input.collateralToken,
        status: "skipped",
        reason,
      }),
    );
    return { kind: "skipped", reason };
  }

  // 4. simulation
  let seizedEstimate: bigint;
  try {
    const sim = await deps.publicClient.simulateContract({
      address: deps.vaultAddress,
      abi: vaultAbi,
      functionName: "liquidate",
      args: [input.borrower, input.repayAmount, input.collateralToken],
      account: deps.account,
    });
    seizedEstimate = sim.result as bigint;
  } catch (e) {
    const reason = `simulation reverted: ${(e as Error).message}`;
    deps.log.append(
      action.liquidate({
        user: input.borrower,
        tx: ZERO_HASH,
        repay: input.repayAmount,
        seized: 0n,
        token: input.collateralToken,
        status: "reverted",
        reason,
      }),
    );
    return { kind: "reverted", reason };
  }

  // 5. submit
  const tx = await deps.walletClient.writeContract({
    address: deps.vaultAddress,
    abi: vaultAbi,
    functionName: "liquidate",
    args: [input.borrower, input.repayAmount, input.collateralToken],
    account: deps.account,
    chain: null,
  });

  deps.log.append(
    action.liquidate({
      user: input.borrower,
      tx,
      repay: input.repayAmount,
      seized: seizedEstimate,
      token: input.collateralToken,
      status: "submitted",
    }),
  );
  return { kind: "submitted", tx, seizedEstimate };
}
