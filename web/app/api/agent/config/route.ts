import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Proxy route for the agent's `POST /config` endpoint (TDD §4.7).
 *
 * We intentionally proxy through Next instead of letting the browser hit
 * the agent directly so the admin secret stays server-side. The secret
 * comes from `AGENT_ADMIN_SECRET` (server env, NOT NEXT_PUBLIC_…). If
 * either env var is missing we return 503 with a clear message.
 *
 * Also supports `POST /api/agent/pause` and `/resume` shortcuts that just
 * patch `paused` on the config.
 */

const ConfigSchema = z.object({
  alertThreshold: z.number().min(1e18).max(2e18).optional(),
  liquidationThreshold: z.number().optional(),
  pollIntervalMs: z.number().int().min(1_000).max(60_000).optional(),
  paused: z.boolean().optional(),
  maxGasGwei: z.number().positive().optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  const agentUrl = process.env.NEXT_PUBLIC_AGENT_URL;
  const secret = process.env.AGENT_ADMIN_SECRET;
  if (!agentUrl) {
    return NextResponse.json({ ok: false, error: "Agent URL not configured" }, { status: 503 });
  }
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "AGENT_ADMIN_SECRET not set on this deployment" },
      { status: 503 },
    );
  }

  let parsed;
  try {
    const json = await req.json();
    parsed = ConfigSchema.safeParse(json);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid config", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(`${agentUrl}/config`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(parsed.data),
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `Agent unreachable: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}
