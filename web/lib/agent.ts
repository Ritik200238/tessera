import { z } from "zod";
import { env } from "./env";
import type { AgentAction } from "@/components/action-log";

/**
 * Agent HTTP client — TDD §4.7.
 *
 * All server-side fetches; the URL is `NEXT_PUBLIC_AGENT_URL` and is fine
 * to expose because the only mutating endpoint (`POST /config`) is gated by
 * a shared admin secret server-side.
 */

const ActionTick = z.object({
  ts: z.string(),
  kind: z.literal("tick"),
  usersChecked: z.number(),
  durationMs: z.number(),
});
const ActionAlert = z.object({
  ts: z.string(),
  kind: z.literal("alert"),
  user: z.string(),
  hf: z.string(),
  copy: z.string(),
});
const ActionLiquidate = z.object({
  ts: z.string(),
  kind: z.literal("liquidate"),
  user: z.string(),
  tx: z.string(),
  repay: z.string(),
  seized: z.string(),
  token: z.string(),
  status: z.enum(["simulated", "submitted", "confirmed", "reverted", "skipped"]),
});
const ActionAutoRepay = z.object({
  ts: z.string(),
  kind: z.literal("auto_repay"),
  user: z.string(),
  tx: z.string(),
  repay: z.string(),
  hfBefore: z.string(),
  status: z.enum(["submitted", "confirmed", "reverted", "skipped"]),
  rationale: z.string().optional(),
  reason: z.string().optional(),
});
const ActionError = z.object({
  ts: z.string(),
  kind: z.literal("error"),
  where: z.string(),
  message: z.string(),
});

const ActionSchema = z.union([ActionTick, ActionAlert, ActionLiquidate, ActionAutoRepay, ActionError]);
// The agent serves the feed as `{ entries: [...] }` (see agent/src/http/routes/actions.ts).
// Accept that, plus `{ actions }` and a bare array, and normalise to an array so the
// activity feed actually renders. (This mismatch silently emptied the feed before.)
const ActionsResponseSchema = z.union([
  z.object({ entries: z.array(ActionSchema) }).transform((o) => o.entries),
  z.object({ actions: z.array(ActionSchema) }).transform((o) => o.actions),
  z.array(ActionSchema),
]);

const HealthSchema = z.object({
  ok: z.boolean(),
  lastTickAt: z.string().nullable(),
  errors24h: z.number(),
});

export interface AgentHealth {
  ok: boolean;
  lastTickAt: string | null;
  errors24h: number;
  /** The agent endpoint responded. */
  available: boolean;
  /** NEXT_PUBLIC_AGENT_URL is set (we can even ask). Distinguishes "down" from "we can't tell". */
  configured: boolean;
}

/**
 * How long since the last tick before we treat protection as not-live. The agent
 * polls ~10s; 3 min ≈ 18 missed ticks — unambiguously stalled, not a blip.
 */
export const AGENT_STALE_MS = 180_000;

export type AgentStatus = "live" | "stale" | "down" | "unknown";

/**
 * Derive the user-facing protection status. Pure (takes `nowMs`) so a client
 * banner can recompute it live against a fresh clock without re-fetching.
 *   unknown — endpoint not configured; we genuinely can't tell (amber).
 *   down    — configured but unreachable / not ok (red).
 *   stale   — reachable but no tick in AGENT_STALE_MS (red).
 *   live    — reachable + a recent tick.
 */
export function deriveAgentStatus(
  h: Pick<AgentHealth, "available" | "configured" | "lastTickAt">,
  nowMs: number,
): AgentStatus {
  if (!h.configured) return "unknown";
  if (!h.available) return "down";
  if (!h.lastTickAt) return "down";
  const last = Date.parse(h.lastTickAt);
  if (Number.isNaN(last) || nowMs - last > AGENT_STALE_MS) return "stale";
  return "live";
}

export async function getAgentActions(limit = 50): Promise<AgentAction[]> {
  if (!env.agentUrl) return [];
  try {
    const res = await fetch(`${env.agentUrl}/actions?limit=${limit}`, {
      next: { revalidate: 5 },
    });
    if (!res.ok) return [];
    const raw = (await res.json()) as unknown;
    const parsed = ActionsResponseSchema.safeParse(raw);
    if (!parsed.success) return [];
    return parsed.data; // always AgentAction[] after the union transforms
  } catch {
    return [];
  }
}

export async function getAgentHealth(): Promise<AgentHealth> {
  if (!env.agentUrl) {
    return { ok: false, lastTickAt: null, errors24h: 0, available: false, configured: false };
  }
  try {
    const res = await fetch(`${env.agentUrl}/health`, { next: { revalidate: 5 } });
    if (!res.ok) {
      return { ok: false, lastTickAt: null, errors24h: 0, available: false, configured: true };
    }
    const raw = (await res.json()) as unknown;
    const parsed = HealthSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, lastTickAt: null, errors24h: 0, available: false, configured: true };
    }
    return { ...parsed.data, available: true, configured: true };
  } catch {
    return { ok: false, lastTickAt: null, errors24h: 0, available: false, configured: true };
  }
}
