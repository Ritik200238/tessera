/**
 * Single tick of the agent run-loop (TDD §4.2).
 *
 * Responsibilities:
 *   1. Get current block (pinned for the whole tick — one coherent snapshot)
 *   2. Resolve the set of tracked borrowers
 *   3. Batch-read HF + debt for all of them (multicall), then act only on the
 *      at-risk subset, most-endangered first
 *   4. Evict zero-debt borrowers from the active set
 *
 * All decisions deterministic. LLM is only invoked on the alert-copy path.
 */

import type { Address, PublicClient } from "viem";
import { classify } from "./health-classifier.js";
import { emitAlert, type AlerterDeps } from "./alerter.js";
import { tryLiquidate, type LiquidatorDeps } from "./liquidator.js";
import { tryAutoRepay, type AutoRepayDeps } from "./auto-repay.js";
import { vaultAbi } from "../vault-client.js";
import { assessRegime } from "./regime.js";
import { EARNINGS_CALENDAR } from "../data/earnings.js";
import { action } from "../log/action.js";
import type { JsonlLog } from "../log/jsonl.js";
import type { AgentConfig } from "../types.js";

/**
 * Health-factor the protective auto-repay aims to restore a position to. Repay
 * size is derived deterministically: repay = debt * (TARGET - hf) / TARGET.
 * 1.4e18 leaves a comfortable buffer above the default 1.1e18 alert band.
 */
const PROTECT_TARGET_HF = 1_400_000_000_000_000_000n;

const fmtHf = (v: bigint): string => (Number(v) / 1e18).toFixed(2);
const fmtUsdc = (v: bigint): string =>
  (Number(v) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 });

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
  /** Optional eviction hook — called when a tracked user is observed with zero
   *  debt, so the indexer can drop them from the active scan. */
  markInactive?: (user: Address) => void;
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
  /** Tracked users whose HF could not be read this tick (e.g. non-archive RPC
   *  rejecting the pinned-block read). NON-ZERO IS A RED FLAG: we are BLIND to
   *  those positions' risk — the loop escalates this to a critical incident
   *  rather than treating a silent null as "fine". */
  healthReadFailures: number;
}

interface UserSnap {
  hf: bigint | null;
  debt: bigint;
}

/** Read one view at a pinned block; returns null on failure. */
async function readOne(
  publicClient: PublicClient,
  vaultAddress: Address,
  functionName: "getHealthFactor" | "debtOf",
  user: Address,
  blockNumber: bigint,
): Promise<bigint | null> {
  try {
    const v = await publicClient.readContract({
      address: vaultAddress,
      abi: vaultAbi,
      functionName,
      args: [user],
      blockNumber,
    });
    return v as bigint;
  } catch {
    return null;
  }
}

/**
 * Batch-read HF + debt for every tracked user at a single pinned block. Uses
 * multicall so RPC cost is O(1) calls instead of O(2N); falls back to per-user
 * reads if multicall3 is unavailable (keeps determinism and the tests honest).
 */
async function readSnapshot(
  publicClient: PublicClient,
  vaultAddress: Address,
  users: Address[],
  blockNumber: bigint,
): Promise<Map<Address, UserSnap>> {
  const out = new Map<Address, UserSnap>();
  if (users.length === 0) return out;

  const contracts = users.flatMap((u) => [
    { address: vaultAddress, abi: vaultAbi, functionName: "getHealthFactor", args: [u] } as const,
    { address: vaultAddress, abi: vaultAbi, functionName: "debtOf", args: [u] } as const,
  ]);

  try {
    const results = await publicClient.multicall({ contracts, allowFailure: true, blockNumber });
    users.forEach((u, i) => {
      const hfR = results[i * 2];
      const debtR = results[i * 2 + 1];
      out.set(u, {
        hf: hfR && hfR.status === "success" ? (hfR.result as bigint) : null,
        debt: debtR && debtR.status === "success" ? (debtR.result as bigint) : 0n,
      });
    });
    return out;
  } catch {
    // Fallback: per-user reads at the same pinned block.
    for (const u of users) {
      const hf = await readOne(publicClient, vaultAddress, "getHealthFactor", u, blockNumber);
      const debt = (await readOne(publicClient, vaultAddress, "debtOf", u, blockNumber)) ?? 0n;
      out.set(u, { hf, debt });
    }
    return out;
  }
}

/**
 * Find a collateral token the borrower actually holds a balance in. Enumerates
 * the vault's listed assets and returns the first with non-zero collateral.
 */
async function findCollateralToken(
  publicClient: PublicClient,
  vaultAddress: Address,
  user: Address,
  blockNumber: bigint,
): Promise<Address | null> {
  try {
    const count = (await publicClient.readContract({
      address: vaultAddress,
      abi: vaultAbi,
      functionName: "listedAssetCount",
      blockNumber,
    })) as bigint;
    for (let i = 0n; i < count; i += 1n) {
      const token = (await publicClient.readContract({
        address: vaultAddress,
        abi: vaultAbi,
        functionName: "listedAssetAt",
        args: [i],
        blockNumber,
      })) as Address;
      const bal = (await publicClient.readContract({
        address: vaultAddress,
        abi: vaultAbi,
        functionName: "collateralOf",
        args: [user, token],
        blockNumber,
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
  const empty = (block: number): TickResult => ({
    block,
    usersChecked: 0,
    alerted: 0,
    liquidated: 0,
    autoRepaid: 0,
    durationMs: Date.now() - start,
    healthReadFailures: 0,
  });

  if (deps.config.paused) {
    deps.log.append(action.tick(0, Date.now() - start));
    return empty(0);
  }

  let blockNumber = 0n;
  try {
    blockNumber = await deps.publicClient.getBlockNumber();
  } catch (e) {
    deps.log.append(action.error("tick.getBlockNumber", (e as Error).message));
    deps.log.append(action.tick(0, Date.now() - start));
    return empty(0);
  }
  const blockNum = Number(blockNumber);

  let users: Address[] = [];
  try {
    users = await deps.getTrackedUsers();
  } catch (e) {
    deps.log.append(action.error("tick.getTrackedUsers", (e as Error).message));
  }

  // One coherent, pinned-block snapshot of every tracked user.
  const snap = await readSnapshot(deps.publicClient, deps.vaultAddress, users, blockNumber);

  // Equity-event-aware regime: widen the protect target + alert band when the
  // underlying market is closed / weekend / near earnings, so the agent acts
  // AHEAD of the gap. Deterministic — the LLM never participates.
  const reg = assessRegime({
    now: new Date(),
    baseProtectHf: PROTECT_TARGET_HF,
    baseAlertHf: deps.config.alertThreshold,
    earningsCal: EARNINGS_CALENDAR,
  });

  let alerted = 0;
  let liquidated = 0;
  let autoRepaid = 0;

  // Triage: evict zero-debt, clear recovered, collect the at-risk subset.
  const atRisk: { user: Address; hf: bigint; debt: bigint }[] = [];
  let healthReadFailures = 0;
  for (const user of users) {
    const s = snap.get(user);
    if (!s || s.hf === null) {
      // A null HF means we are BLIND to this position — it may be liquidatable
      // and we just can't see it (commonly a non-archive RPC rejecting the
      // pinned-block read). Count it so the loop escalates, instead of silently
      // skipping it as if it were fine.
      healthReadFailures += 1;
      deps.log.append(action.error("tick.readHealth", `HF unreadable for ${user} — BLIND to its risk this tick`));
      continue;
    }
    if (s.debt === 0n) {
      // Repaid / closed — drop from the active set so the scan stays O(active).
      deps.alerter.alerts.clear(user);
      deps.markInactive?.(user);
      continue;
    }
    if (s.hf < reg.alertThresholdHf) {
      atRisk.push({ user, hf: s.hf, debt: s.debt });
    } else {
      deps.alerter.alerts.clear(user); // healthy (for the current regime)
    }
  }

  // Act on the most-endangered first.
  atRisk.sort((a, b) => (a.hf < b.hf ? -1 : a.hf > b.hf ? 1 : 0));

  for (const { user, hf, debt } of atRisk) {
    const c = classify(hf);

    // Liquidation path.
    if (hf < deps.config.liquidationThreshold) {
      // 50% close factor normally (TDD §3.4.4). But a deeply underwater position
      // (HF < 0.95) is non-viable: the vault opens a 100% close (full-close path,
      // rulbookImprvmnts.md Phase 1), so pass the FULL debt to wind it down in one
      // shot — otherwise compute_liquidation still caps the repay at what we pass,
      // and the position can stay frozen. Any residual beyond the seized
      // collateral is absorbed on-chain by the insolvency waterfall (reserve
      // first, then socialized). If the agent can't afford the full debt it skips
      // and the permissionless backstop / a deeper-pocketed liquidator finishes it.
      const FULL_CLOSE_HF = 950_000_000_000_000_000n; // 0.95e18
      const repay = hf < FULL_CLOSE_HF ? debt : debt / 2n;
      const collateralToken = await findCollateralToken(deps.publicClient, deps.vaultAddress, user, blockNumber);
      if (!collateralToken) {
        deps.log.append(action.error("tick.liquidate", `no collateral token found for ${user}`));
        continue;
      }
      try {
        const outcome = await tryLiquidate(deps.liquidator, { borrower: user, repayAmount: repay, collateralToken }, blockNum);
        if (outcome.kind === "submitted") liquidated++;
      } catch (e) {
        deps.log.append(action.error("tick.liquidate", (e as Error).message));
      }
      continue;
    }

    // At-risk band: protect (if opted in), then alert. The protect target is
    // regime-widened, so a weekend/earnings position is restored to a bigger
    // buffer and protection triggers earlier than the static band would.
    if (deps.autoRepay && hf < reg.protectTargetHf) {
      const repayAmount = (debt * (reg.protectTargetHf - hf)) / reg.protectTargetHf;
      if (repayAmount > 0n) {
        const rationale =
          `${reg.label}: HF ${fmtHf(hf)} is below the ${fmtHf(reg.protectTargetHf)} protect target — ` +
          `repaying ~${fmtUsdc(repayAmount)} USDC from your approved cap to restore it.`;
        try {
          const outcome = await tryAutoRepay(deps.autoRepay, { user, repayAmount, hfBefore: hf, rationale }, blockNum);
          if (outcome.kind === "submitted") autoRepaid++;
        } catch (e) {
          deps.log.append(action.error("tick.autoRepay", (e as Error).message));
        }
      }
    }
    try {
      await emitAlert(deps.alerter, user, c);
      alerted++;
    } catch (e) {
      deps.log.append(action.error("tick.alert", (e as Error).message));
    }
  }

  const durationMs = Date.now() - start;
  deps.log.append(action.tick(users.length, durationMs));
  return { block: blockNum, usersChecked: users.length, alerted, liquidated, autoRepaid, durationMs, healthReadFailures };
}
