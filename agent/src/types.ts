/**
 * Shared type definitions for the Tessera Risk Agent.
 * Mirrors TDD §4.6 (AgentConfig) and §4.7 (Action log API).
 */

import type { Address, Hex } from "viem";

/** Health-factor band aligned with TDD §5.3 (UI mapping). */
export type AlertLevel = "safe" | "healthy" | "watch" | "at-risk" | "liquidating";

/**
 * Portfolio Safety Score band — 0–100 (see TDD §5.3 "Portfolio Safety Score").
 * The score is the *headline* number shown to retail users; the AlertLevel
 * provides the action signal (color/copy).
 */
export interface HealthClassification {
  readonly hf: bigint;
  readonly level: AlertLevel;
  readonly score: number;
}

/**
 * Single immutable entry in the JSONL action log. See TDD §4.7.
 * Every variant is timestamped with an ISO-8601 string for ordering.
 */
export type Action =
  | { ts: string; kind: "tick"; usersChecked: number; durationMs: number }
  | { ts: string; kind: "alert"; user: Address; hf: string; level: AlertLevel; copy: string }
  | {
      ts: string;
      kind: "liquidate";
      user: Address;
      tx: Hex;
      repay: string;
      seized: string;
      token: Address;
      status: "simulated" | "submitted" | "confirmed" | "reverted" | "skipped";
      reason?: string;
    }
  | {
      ts: string;
      kind: "auto_repay";
      user: Address;
      tx: Hex;
      repay: string;
      hfBefore: string;
      status: "submitted" | "reverted" | "skipped";
      reason?: string;
    }
  | { ts: string; kind: "error"; where: string; message: string };

/**
 * Public snapshot returned by GET /alerts/latest.
 * Computed from the rolling alert state held in memory; persisted as JSON.
 */
export interface LatestAlert {
  readonly user: Address;
  readonly hf: string;
  readonly level: AlertLevel;
  readonly score: number;
  readonly copy: string;
  readonly updatedAt: string;
}

/**
 * Natural-language config schema from TDD §4.6. Values are validated by zod;
 * unspecified fields use defaults supplied at agent boot.
 */
export interface AgentConfig {
  alertThreshold: bigint;
  liquidationThreshold: bigint;
  pollIntervalMs: number;
  paused: boolean;
  maxGasGwei: number;
  notes: string;
}
