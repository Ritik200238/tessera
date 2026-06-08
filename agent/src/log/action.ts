/**
 * Action constructors — small, typed factories so the rest of the agent
 * doesn't sprinkle `ts: new Date().toISOString()` everywhere.
 */

import type { Address, Hex } from "viem";
import type { Action, AlertLevel } from "../types.js";

const now = (): string => new Date().toISOString();

// Privacy: the PUBLIC action log must not be a clean, machine-readable list of
// (address, debt, HF) for distressed borrowers. We truncate the address and
// round amounts; the exact, full-address truth stays verifiable via the on-chain
// tx hash that accompanies every money-moving action.
function shortAddr(a: Address): Address {
  return (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a) as Address;
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
    return { ts: now(), kind: "alert", user: shortAddr(user), hf: roundHf(hf), level, copy };
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
      user: shortAddr(args.user),
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
      user: shortAddr(args.user),
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
