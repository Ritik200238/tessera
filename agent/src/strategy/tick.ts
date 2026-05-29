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
import { tryAutoRepay, type AutoRepayDeps } from "./auto-repay.js";
import { vaultAbi } from "../vault-client.js";
import { action } from "../log/action.js";
import type { JsonlLog } from "../log/jsonl.js";
import type { AgentConfig } from "../types.js";

/**
 * Health-factor the protective auto-repay aims to restore a position to. Repay
 * size is derived deterministically: repay = debt * (TARGET - hf) / TARGET,
 * which brings (collateral·threshold)/debt back up to TARGET. 1.4e18 leaves a
 * comfortable buffer above the default 1.1e18 alert band.
 */
const PROTECT_TARGET_HF = 1_400_000_000_000_000_000n;

export interface TickDeps {
  publicClient: PublicClient;
  vaultAddress: Address;
  /** Function the tick uses to discover active borrowers. Caller-injected
   *  so tests can stub the event-indexer cleanly. */
  getTrackedUsers: () => Promise<Address[]>;
  alerter: AlerterDeps;
  liquidator: LiquidatorDeps;
  /** Optional protective layer. When present, at-risk users who opted in
   *  (pre-approved USDC) get an auto-repay attempt before being alerted. */
  autoRepay?: AutoRepayDeps;
  log: JsonlLog;
  config: AgentConfig;
}

export interface TickResult {
  block: number;
  usersChecked: number;
  alerted: number;
  liquidated: number;
  autoRepaid: number;
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

/**
 * Find a collateral token the borrower actually holds a balance in.
 * Enumerates the vault's listed assets and returns the first with non-zero
 * collateral. Returns null when there is nothing to seize. This replaces the
 * old zero-address sentinel, which the vault rejects (`AssetNotEnabled`).
 */
async function findCollateralToken(
  publicClient: PublicClient,
  vaultAddress: Address,
  user: Address,
): Promise<Address | null> {
  try {
    const count = (await publicClient.readContract({
      address: vaultAddress,
      abi: vaultAbi,
      functionName: "listedAssetCount",
    })) as bigint;
    for (let i = 0n; i < count; i += 1n) {
      const token = (await publicClient.readContract({
        address: vaultAddress,
        abi: vaultAbi,
        functionName: "listedAssetAt",
        args: [i],
      })) as Address;
      const bal = (await publicClient.readContract({
        address: vaultAddress,
        abi: vaultAbi,
        functionName: "collateralOf",
        args: [user, token],
      })) as bigint;
      if (bal > 0n) return token;
    }
  } catch {
    return null;
  }
  return null;
}

/** Execute a single tick. Never throws — errors are logged as Actions. */
export async function runTick(deps: TickDeps): Promise<TickResult> {
  const start = Date.now();
  if (deps.config.paused) {
    deps.log.append(action.tick(0, Date.now() - start));
    return { block: 0, usersChecked: 0, alerted: 0, liquidated: 0, autoRepaid: 0, durationMs: Date.now() - start };
  }

  let blockNumber = 0;
  try {
    blockNumber = Number(await deps.publicClient.getBlockNumber());
  } catch (e) {
    deps.log.append(action.error("tick.getBlockNumber", (e as Error).message));
    deps.log.append(action.tick(0, Date.now() - start));
    return { block: 0, usersChecked: 0, alerted: 0, liquidated: 0, autoRepaid: 0, durationMs: Date.now() - start };
  }

  let users: Address[] = [];
  try {
    users = await deps.getTrackedUsers();
  } catch (e) {
    deps.log.append(action.error("tick.getTrackedUsers", (e as Error).message));
  }

  let alerted = 0;
  let liquidated = 0;
  let autoRepaid = 0;

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
      // Discover the borrower's actual collateral token (the vault rejects the
      // zero address). For MVP this seizes the first asset the borrower holds.
      const collateralToken = await findCollateralToken(
        deps.publicClient,
        deps.vaultAddress,
        user,
      );
      if (!collateralToken) {
        deps.log.append(
          action.error("tick.liquidate", `no collateral token found for ${user}`),
        );
        continue;
      }
      try {
        const outcome = await tryLiquidate(
          deps.liquidator,
          { borrower: user, repayAmount: repay, collateralToken },
          blockNumber,
        );
        if (outcome.kind === "submitted") liquidated++;
      } catch (e) {
        deps.log.append(action.error("tick.liquidate", (e as Error).message));
      }
      continue;
    }

    // At-risk band (above liquidation, below alert threshold): protect, then alert.
    if (hf < deps.config.alertThreshold) {
      // Protective auto-repay — only fires if the user opted in (has a USDC
      // allowance to the vault). Size is deterministic: bring HF up to TARGET,
      // capped by the user's own allowance + balance inside tryAutoRepay.
      if (deps.autoRepay && hf < PROTECT_TARGET_HF) {
        const debt = await readDebt(deps.publicClient, deps.vaultAddress, user);
        const repayAmount = debt > 0n ? (debt * (PROTECT_TARGET_HF - hf)) / PROTECT_TARGET_HF : 0n;
        if (repayAmount > 0n) {
          try {
            const outcome = await tryAutoRepay(
              deps.autoRepay,
              { user, repayAmount, hfBefore: hf },
              blockNumber,
            );
            if (outcome.kind === "submitted") autoRepaid++;
          } catch (e) {
            deps.log.append(action.error("tick.autoRepay", (e as Error).message));
          }
        }
      }
      // Always alert so the user is notified — the activity feed shows the
      // alert and (when it fired) the auto-repay action side by side.
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
  return { block: blockNumber, usersChecked: users.length, alerted, liquidated, autoRepaid, durationMs };
}
