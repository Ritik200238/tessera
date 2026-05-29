/**
 * Single tick of the agent run-loop (TDD §4.2).
 *
 * Responsibilities:
 *   1. Get current block
 *   2. Resolve the set of tracked users (those with non-zero debt)
 *   3. For each: read HF -> classify -> alert and/or liquidate
 *   4. Persist checkpoint
 *
 * All decisions deterministic. LLM is only invoked on the alert-copy path.
 */

import type { Address, PublicClient } from "viem";
import { classify } from "./health-classifier.js";
import { emitAlert, type AlerterDeps } from "./alerter.js";
import { tryLiquidate, type LiquidatorDeps } from "./liquidator.js";
import { vaultAbi } from "../vault-client.js";
import { action } from "../log/action.js";
import type { JsonlLog } from "../log/jsonl.js";
import type { AgentConfig } from "../types.js";

export interface TickDeps {
  publicClient: PublicClient;
  vaultAddress: Address;
  /** Function the tick uses to discover active borrowers. Caller-injected
   *  so tests can stub the event-indexer cleanly. */
  getTrackedUsers: () => Promise<Address[]>;
  alerter: AlerterDeps;
  liquidator: LiquidatorDeps;
  log: JsonlLog;
  config: AgentConfig;
}

export interface TickResult {
  block: number;
  usersChecked: number;
  alerted: number;
  liquidated: number;
  durationMs: number;
}

/** Read HF for one user via the public client; tolerates errors. */
async function readHealth(
  publicClient: PublicClient,
  vaultAddress: Address,
  user: Address,
): Promise<bigint | null> {
  try {
    const hf = await publicClient.readContract({
      address: vaultAddress,
      abi: vaultAbi,
      functionName: "getHealthFactor",
      args: [user],
    });
    return hf as bigint;
  } catch {
    return null;
  }
}

async function readDebt(
  publicClient: PublicClient,
  vaultAddress: Address,
  user: Address,
): Promise<bigint> {
  try {
    const d = await publicClient.readContract({
      address: vaultAddress,
      abi: vaultAbi,
      functionName: "debtOf",
      args: [user],
    });
    return d as bigint;
  } catch {
    return 0n;
  }
}

/** Execute a single tick. Never throws — errors are logged as Actions. */
export async function runTick(deps: TickDeps): Promise<TickResult> {
  const start = Date.now();
  if (deps.config.paused) {
    deps.log.append(action.tick(0, Date.now() - start));
    return { block: 0, usersChecked: 0, alerted: 0, liquidated: 0, durationMs: Date.now() - start };
  }

  let blockNumber = 0;
  try {
    blockNumber = Number(await deps.publicClient.getBlockNumber());
  } catch (e) {
    deps.log.append(action.error("tick.getBlockNumber", (e as Error).message));
    deps.log.append(action.tick(0, Date.now() - start));
    return { block: 0, usersChecked: 0, alerted: 0, liquidated: 0, durationMs: Date.now() - start };
  }

  let users: Address[] = [];
  try {
    users = await deps.getTrackedUsers();
  } catch (e) {
    deps.log.append(action.error("tick.getTrackedUsers", (e as Error).message));
  }

  let alerted = 0;
  let liquidated = 0;

  for (const user of users) {
    const hf = await readHealth(deps.publicClient, deps.vaultAddress, user);
    if (hf === null) {
      deps.log.append(action.error("tick.readHealth", `failed for ${user}`));
      continue;
    }
    const c = classify(hf);

    // Liquidation path
    if (hf < deps.config.liquidationThreshold) {
      const debt = await readDebt(deps.publicClient, deps.vaultAddress, user);
      if (debt === 0n) {
        deps.alerter.alerts.clear(user);
        continue;
      }
      // 50% close factor per TDD §3.4.4
      const repay = debt / 2n;
      // collateral token: caller must inject discovery; for MVP we read first
      // entry from `tokens_of`. With the minimal ABI here we cannot enumerate;
      // we pass the zero-address as a sentinel meaning "vault picks default".
      // Phase 2 ABI will expose `firstCollateralOf(user)`.
      const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as Address;
      try {
        const outcome = await tryLiquidate(
          deps.liquidator,
          { borrower: user, repayAmount: repay, collateralToken: ZERO_ADDR },
          blockNumber,
        );
        if (outcome.kind === "submitted") liquidated++;
      } catch (e) {
        deps.log.append(action.error("tick.liquidate", (e as Error).message));
      }
      continue;
    }

    // Alert path
    if (hf < deps.config.alertThreshold) {
      try {
        await emitAlert(deps.alerter, user, c);
        alerted++;
      } catch (e) {
        deps.log.append(action.error("tick.alert", (e as Error).message));
      }
    } else {
      // user recovered — drop any stale alert
      deps.alerter.alerts.clear(user);
    }
  }

  const durationMs = Date.now() - start;
  deps.log.append(action.tick(users.length, durationMs));
  return { block: blockNumber, usersChecked: users.length, alerted, liquidated, durationMs };
}
