/**
 * Action constructors — small, typed factories so the rest of the agent
 * doesn't sprinkle `ts: new Date().toISOString()` everywhere.
 */

import type { Address, Hex } from "viem";
import type { Action, AlertLevel } from "../types.js";

const now = (): string => new Date().toISOString();

export const action = {
  tick(usersChecked: number, durationMs: number): Action {
    return { ts: now(), kind: "tick", usersChecked, durationMs };
  },
  alert(user: Address, hf: bigint, level: AlertLevel, copy: string): Action {
    return { ts: now(), kind: "alert", user, hf: hf.toString(), level, copy };
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
      user: args.user,
      tx: args.tx,
      repay: args.repay.toString(),
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
    status: "submitted" | "reverted" | "skipped";
    reason?: string;
  }): Action {
    return {
      ts: now(),
      kind: "auto_repay",
      user: args.user,
      tx: args.tx,
      repay: args.repay.toString(),
      hfBefore: args.hfBefore.toString(),
      status: args.status,
      ...(args.reason !== undefined ? { reason: args.reason } : {}),
    };
  },
  error(where: string, message: string): Action {
    return { ts: now(), kind: "error", where, message };
  },
};
