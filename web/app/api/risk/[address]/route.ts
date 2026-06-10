import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { getPositionRisk } from "@/lib/risk";

/**
 * GET /api/risk/:address — position-level risk for any address: health factor,
 * safety score, how far it is from the AI acting under the current regime, and a
 * plain verdict. Public on-chain data; read-only. Consumed by dashboards and the
 * Tessera MCP server so AI agents can monitor positions.
 */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isAddress(address)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }
  try {
    const data = await getPositionRisk(address as Address);
    return NextResponse.json(data, { headers: { "access-control-allow-origin": "*" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
