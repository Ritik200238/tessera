/**
 * Auto-repay — the "AI Protects" differentiator (auto-repay Layer 3).
 *
 * The protective counterpart to the liquidator. When a position is at-risk but
 * NOT yet liquidatable, and the user has opted in by pre-approving USDC to the
 * vault, the agent repays part of their debt FROM THE USER'S OWN pre-approved
 * USDC — restoring health and avoiding a liquidation (and its penalty) entirely.
 *
 * Same 5-step safety order as the liquidator (TDD §4.3), so any autonomous
 * money movement goes through one audited pipeline:
 *   1. idempotency (per user / block)
 *   2. budget check — user's allowance-to-vault AND balance (the cap)
 *   3. gas cap
 *   4. eth_call simulation of agentRepayFor(...)
 *   5. ONLY on success: submit
 *
 * Trust boundary: the deterministic core here decides *whether* and *how much*
 * to repay; the vault's `agentRepayFor` enforces that only the agent may call
 * it, that funds come from the user's own approval, and that debt can only ever
 * be *reduced*. The user's ERC-20 allowance is the spending cap and the kill
 * switch (revoke it to disable protection instantly).
 */

import {
  erc20Abi,
  parseGwei,
  type Account,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { vaultAbi } from "../vault-client.js";
import { action } from "../log/action.js";
import type { JsonlLog } from "../log/jsonl.js";
import type { AgentDB } from "../db/index.js";

export interface AutoRepayDeps {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Account;
  vaultAddress: Address;
  usdcAddress: Address;
  log: JsonlLog;
  db: AgentDB;
  /** Max gas price the agent will pay, in gwei. */
  maxGasGwei: number;
}

export interface AutoRepayInput {
  user: Address;
  /** Desired repay amount (deterministically sized by the tick to restore HF). */
  repayAmount: bigint;
  /** HF at decision time — recorded in the action log for transparency. */
  hfBefore: bigint;
}

export type AutoRepayOutcome =
  | { kind: "skipped"; reason: string }
  | { kind: "submitted"; tx: Hex; repaid: bigint }
  | { kind: "reverted"; reason: string };

const ZERO_HASH: Hex = "0x0000000000000000000000000000000000000000000000000000000000000000";

/**
 * The user's protection budget: their USDC allowance to the vault (the cap they
 * set when opting in) and their USDC balance. The agent may pull at most
 * `min(allowance, balance)`. A zero allowance means the user has NOT opted in
 * (or has hit the kill switch).
 */
export async function protectionBudget(
  deps: AutoRepayDeps,
  user: Address,
): Promise<{ allowance: bigint; balance: bigint }> {
  const [allowance, balance] = await Promise.all([
    deps.publicClient.readContract({
      address: deps.usdcAddress,
      abi: erc20Abi,
      functionName: "allowance",
      args: [user, deps.vaultAddress],
    }) as Promise<bigint>,
    deps.publicClient.readContract({
      address: deps.usdcAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [user],
    }) as Promise<bigint>,
  ]);
  return { allowance, balance };
}

/**
 * Attempt a protective auto-repay for `input.user`. Idempotent per (user, block).
 * Never throws — every exit logs an `auto_repay` action.
 */
export async function tryAutoRepay(
  deps: AutoRepayDeps,
  input: AutoRepayInput,
  blockNumber: number,
): Promise<AutoRepayOutcome> {
  const logSkip = (reason: string): AutoRepayOutcome => {
    deps.log.append(
      action.autoRepay({
        user: input.user,
        tx: ZERO_HASH,
        repay: 0n,
        hfBefore: input.hfBefore,
        status: "skipped",
        reason,
      }),
    );
    return { kind: "skipped", reason };
  };

  // 1. idempotency — one attempt per user per block.
  if (!deps.db.recordIdempotency(input.user, blockNumber, "auto_repay")) {
    return { kind: "skipped", reason: "already attempted this block" };
  }

  // 2. budget — bounded by the user's own allowance + balance (the cap).
  const { allowance, balance } = await protectionBudget(deps, input.user);
  const pull = [input.repayAmount, allowance, balance].reduce((a, b) => (a < b ? a : b));
  if (pull <= 0n) {
    return logSkip(
      allowance === 0n
        ? "not opted in (no USDC allowance to vault)"
        : `no budget: allowance=${allowance} balance=${balance}`,
    );
  }

  // 3. gas cap.
  const gasPrice = await deps.publicClient.getGasPrice();
  const cap = parseGwei(deps.maxGasGwei.toString());
  if (gasPrice > cap) {
    return logSkip(`gas price ${gasPrice} exceeds cap ${cap}`);
  }

  // 4. simulation.
  try {
    await deps.publicClient.simulateContract({
      address: deps.vaultAddress,
      abi: vaultAbi,
      functionName: "agentRepayFor",
      args: [input.user, pull],
      account: deps.account,
    });
  } catch (e) {
    const reason = `simulation reverted: ${(e as Error).message}`;
    deps.log.append(
      action.autoRepay({
        user: input.user,
        tx: ZERO_HASH,
        repay: pull,
        hfBefore: input.hfBefore,
        status: "reverted",
        reason,
      }),
    );
    return { kind: "reverted", reason };
  }

  // 5. submit.
  const tx = await deps.walletClient.writeContract({
    address: deps.vaultAddress,
    abi: vaultAbi,
    functionName: "agentRepayFor",
    args: [input.user, pull],
    account: deps.account,
    chain: null,
  });

  deps.log.append(
    action.autoRepay({
      user: input.user,
      tx,
      repay: pull,
      hfBefore: input.hfBefore,
      status: "submitted",
    }),
  );
  return { kind: "submitted", tx, repaid: pull };
}
