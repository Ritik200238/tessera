import { NextResponse } from "next/server";

/**
 * Proxy for the agent's admin-gated `GET /alerts/latest` (the current distressed-
 * borrower watchlist). The bearer (AGENT_ADMIN_SECRET) stays server-side; the
 * browser never sees it. 503 if the agent URL / secret aren't configured.
 */
export async function GET() {
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
  try {
    const upstream = await fetch(`${agentUrl}/alerts/latest`, {
      headers: { authorization: `Bearer ${secret}` },
      cache: "no-store",
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
