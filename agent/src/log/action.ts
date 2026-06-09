/**
 * Action constructors — small, typed factories so the rest of the agent
 * doesn't sprinkle `ts: new Date().toISOString()` everywhere.
 */

import { createHash, randomBytes } from "node:crypto";
import type { Address, Hex } from "viem";
import type { Action, AlertLevel } from "../types.js";

const now = (): string => new Date().toISOString();

// Privacy: the PUBLIC action log must reveal WHAT the agent did, never WHO. A
// truncated address is still correlatable to the on-chain address, so we replace
// the borrower reference with an UNLINKABLE salted hash and round amounts into
// bands. The salt comes from AGENT_LOG_SALT (stable ids across restarts) or a
// per-process random fallback, and is NEVER logged. The exact, full-address
// truth stays verifiable via the on-chain tx hash on every money-moving action.
const LOG_SALT = process.env.AGENT_LOG_SALT ?? randomBytes(16).toString("hex");
function refUser(a: Address): Address {
  const h = createHash("sha256").update(LOG_SALT + a.toLowerCase()).digest("hex").slice(0, 10);
  return `u:${h}` as Address;
}
// Round USDC (6-dec) to the nearest 100 USDC.
function roundUsdc(v: bigint): string {
  const unit = 100_000000n;
  return (((v + unit / 2n) / unit) * unit).toString();
}
// Round a 1e18-scaled health factor to 2 decimals.
function roundHf(v: bigint): string {
  const unit = 10_000_000_000_000_000n; // 1e16
  return (((v + unit / 2n) / unit) * unit).toString();
}

export const action = {
  tick(usersChecked: number, durationMs: number): Action {
    return { ts: now(), kind: "tick", usersChecked, durationMs };
  },
  alert(user: Address, hf: bigint, level: AlertLevel, copy: string): Action {
    return { ts: now(), kind: "alert", user: refUser(user), hf: roundHf(hf), level, copy };
  },
  liquidate(args: {
    user: Address;
    tx: Hex;
    repay: bigint;
    seized: bigint;
    token: Address;
    status: "simulated" | "submitted" | "confirmed" | "reverted" | "skipped";
    reason?: string;
  }): Action {
    return {
      ts: now(),
      kind: "liquidate",
      user: refUser(args.user),
      tx: args.tx,
      repay: roundUsdc(args.repay),
      seized: args.seized.toString(),
      token: args.token,
      status: args.status,
      ...(args.reason !== undefined ? { reason: args.reason } : {}),
    };
  },
  autoRepay(args: {
    user: Address;
    tx: Hex;
    repay: bigint;
    hfBefore: bigint;
    status: "submitted" | "confirmed" | "reverted" | "skipped";
    reason?: string;
    rationale?: string;
  }): Action {
    return {
      ts: now(),
      kind: "auto_repay",
      user: refUser(args.user),
      tx: args.tx,
      repay: roundUsdc(args.repay),
      hfBefore: roundHf(args.hfBefore),
      status: args.status,
      ...(args.reason !== undefined ? { reason: args.reason } : {}),
      ...(args.rationale !== undefined ? { rationale: args.rationale } : {}),
    };
  },
  error(where: string, message: string): Action {
    return { ts: now(), kind: "error", where, message };
  },
};
