import { NextResponse } from "next/server";

/**
 * Proxy for the agent's public Live Drill endpoints (GET status / POST start),
 * so the browser talks same-origin regardless of the agent host's CORS setup.
 * The drill is public by design (judges press the button); abuse is bounded by
 * the agent's one-at-a-time lock + 10-minute cooldown + rate limiter.
 */
const NO_AGENT = NextResponse.json(
  { ok: false, error: "Agent URL not configured" },
  { status: 503 },
);

async function proxy(path: string, init?: RequestInit) {
  const agentUrl = process.env.NEXT_PUBLIC_AGENT_URL;
  if (!agentUrl) return NO_AGENT;
  try {
    const upstream = await fetch(`${agentUrl}${path}`, { ...init, cache: "no-store" });
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

export async function GET() {
  return proxy("/drill/status");
}

export async function POST() {
  return proxy("/drill/start", { method: "POST" });
}
