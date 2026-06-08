import { NextResponse } from "next/server";

/**
 * Proxy for the agent's admin-gated `GET /metrics` (Prometheus exposition). The
 * bearer (AGENT_ADMIN_SECRET) stays server-side. Returned as text/plain so an
 * operator (or a Prometheus scraper pointed here) gets the raw exposition.
 */
export async function GET() {
  const agentUrl = process.env.NEXT_PUBLIC_AGENT_URL;
  const secret = process.env.AGENT_ADMIN_SECRET;
  if (!agentUrl) {
    return new NextResponse("Agent URL not configured", { status: 503 });
  }
  if (!secret) {
    return new NextResponse("AGENT_ADMIN_SECRET not set on this deployment", { status: 503 });
  }
  try {
    const upstream = await fetch(`${agentUrl}/metrics`, {
      headers: { authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    return new NextResponse(`Agent unreachable: ${(err as Error).message}`, { status: 502 });
  }
}
