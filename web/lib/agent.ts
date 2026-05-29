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
  status: z.enum(["submitted", "confirmed", "reverted"]),
});
const ActionError = z.object({
  ts: z.string(),
  kind: z.literal("error"),
  where: z.string(),
  message: z.string(),
});

const ActionSchema = z.union([ActionTick, ActionAlert, ActionLiquidate, ActionError]);
const ActionsResponseSchema = z.object({ actions: z.array(ActionSchema) }).or(z.array(ActionSchema));

const HealthSchema = z.object({
  ok: z.boolean(),
  lastTickAt: z.string().nullable(),
  errors24h: z.number(),
});

export interface AgentHealth {
  ok: boolean;
  lastTickAt: string | null;
  errors24h: number;
  available: boolean;
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
    return Array.isArray(parsed.data) ? parsed.data : parsed.data.actions;
  } catch {
    return [];
  }
}

export async function getAgentHealth(): Promise<AgentHealth> {
  if (!env.agentUrl) {
    return { ok: false, lastTickAt: null, errors24h: 0, available: false };
  }
  try {
    const res = await fetch(`${env.agentUrl}/health`, { next: { revalidate: 5 } });
    if (!res.ok) {
      return { ok: false, lastTickAt: null, errors24h: 0, available: false };
    }
    const raw = (await res.json()) as unknown;
    const parsed = HealthSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, lastTickAt: null, errors24h: 0, available: false };
    }
    return { ...parsed.data, available: true };
  } catch {
    return { ok: false, lastTickAt: null, errors24h: 0, available: false };
  }
}
