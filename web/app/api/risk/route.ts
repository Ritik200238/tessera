import { NextResponse } from "next/server";
import { getMarketRisk } from "@/lib/risk";

/**
 * GET /api/risk — market-level risk: current regime + the AI's protection bands
 * + per-asset price/freshness. Public, read-only, CORS-open (it's public
 * on-chain data) so other apps and the Tessera MCP server can consume it.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getMarketRisk();
    return NextResponse.json(data, { headers: { "access-control-allow-origin": "*" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
