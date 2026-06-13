import { NextResponse } from "next/server";

/**
 * Same-origin proxy for the agent's early-access waitlist:
 *   GET  /api/waitlist        → { count }
 *   POST /api/waitlist {email} → { ok, added, count }
 * The count is the real number of signups stored by the agent — never faked.
 */
const NO_AGENT = NextResponse.json({ ok: false, error: "Waitlist not configured" }, { status: 503 });

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
      { ok: false, error: `Waitlist unreachable: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}

export async function GET() {
  return proxy("/waitlist/count");
}

export async function POST(req: Request) {
  let body = "{}";
  try {
    const json = (await req.json()) as { email?: unknown; useCase?: unknown };
    body = JSON.stringify({
      email: typeof json.email === "string" ? json.email : "",
      useCase: typeof json.useCase === "string" ? json.useCase.slice(0, 500) : "",
      source: "web",
    });
  } catch {
    /* keep default */
  }
  return proxy("/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}
