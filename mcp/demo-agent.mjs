#!/usr/bin/env node
/**
 * Live agentic demo — an EXTERNAL autonomous agent consulting Tessera's risk
 * layer before it acts. This is the agentic thesis made concrete: not just an
 * agent that protects positions, but a risk oracle other agents call.
 *
 * It is a real MCP client → our MCP server (server.mjs) → Tessera's live public
 * Risk API roundtrip. Nothing is mocked: the numbers come straight off
 * Arbitrum Sepolia. Run it:
 *
 *   cd mcp && npm install && node demo-agent.mjs [0x-borrower-address]
 *
 * Point at your own deployment with TESSERA_API_BASE.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
// A real borrower on the live vault (override via argv[2]).
const BORROWER = process.argv[2] ?? "0xBd4956F88e7bC946F775a68080D7730186fAdc25";

function parse(result) {
  const text = result?.content?.find((c) => c.type === "text")?.text ?? "{}";
  return JSON.parse(text);
}

async function main() {
  console.log("🤖  External lending agent starting up.");
  console.log("    It will not extend credit without consulting Tessera's risk layer first.\n");

  // Connect to Tessera's MCP server exactly as Claude Desktop / Cursor would.
  const transport = new StdioClientTransport({
    command: "node",
    args: [join(here, "server.mjs")],
    env: { ...process.env },
  });
  const client = new Client({ name: "demo-lending-agent", version: "0.1.0" }, { capabilities: {} });
  await client.connect(transport);

  const { tools } = await client.listTools();
  console.log(`🔌  Connected to Tessera MCP. Tools available: ${tools.map((t) => t.name).join(", ")}\n`);

  // 1. Read the market regime — should the agent be cautious right now?
  const market = parse(await client.callTool({ name: "tessera_market_risk", arguments: {} }));
  console.log(`🌐  Market regime: ${market.regimeLabel}. The AI acts below HF ${market.aiActsBelowHf}.`);
  if (market.earningsNear) console.log("    ⚠️  Earnings are near — gap risk is elevated.");

  // 2. Read the specific borrower's risk.
  const pos = parse(await client.callTool({ name: "tessera_position_risk", arguments: { address: BORROWER } }));
  console.log(`\n🔎  Consulting risk for ${BORROWER.slice(0, 10)}…`);
  if (!pos.exists) {
    console.log("    No open debt — nothing to underwrite.");
  } else {
    console.log(`    Health factor: ${pos.healthFactor}`);
    console.log(`    Safety score:  ${pos.safetyScore}/100`);
    console.log(`    Debt:          $${pos.debtUsdc}`);
    console.log(`    Verdict:       ${pos.verdict}`);
  }

  // 3. The agent's own decision, derived from Tessera's read.
  console.log("\n🧠  Decision:");
  if (!pos.exists) {
    console.log("    SKIP — no position to assess.");
  } else if (pos.atRisk) {
    console.log("    DECLINE — Tessera reports this position is already at-risk under the current regime.");
  } else if ((pos.safetyScore ?? 0) >= 80 && pos.dropToAiActPct >= 30) {
    console.log(`    APPROVE — safety score ${pos.safetyScore}, ${pos.dropToAiActPct}% of collateral cushion before the`);
    console.log("              AI even steps in. Comfortable to extend credit.");
  } else {
    console.log(`    APPROVE WITH CAUTION — only ${pos.dropToAiActPct}% cushion before Tessera's agent acts; size small.`);
  }
  console.log("\n    ↳ This decision used live on-chain risk, served by Tessera, consumed over MCP.");

  await client.close();
}

main().catch((e) => {
  console.error("demo-agent error:", e.message);
  process.exit(1);
});
