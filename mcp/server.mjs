#!/usr/bin/env node
/**
 * Tessera MCP server — exposes the live tokenized-equity risk layer to any AI
 * agent (Claude Desktop, Claude Code, Cursor, etc.) as MCP tools. This is the
 * agentic angle of Tessera's thesis: not just an agent that protects positions,
 * but a risk API other agents can build on.
 *
 * It is a thin, safe wrapper over the PUBLIC read-only Risk API
 * (https://<app>/api/risk) — no keys, no funds, no writes. Point it at your
 * deployment with TESSERA_API_BASE (defaults to the public app).
 *
 * Connect from Claude Code:
 *   claude mcp add tessera -- node /abs/path/to/mcp/server.mjs
 * or in an MCP client config:
 *   { "command": "node", "args": ["/abs/path/to/mcp/server.mjs"],
 *     "env": { "TESSERA_API_BASE": "https://tessera-web-delta.vercel.app" } }
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_BASE = (process.env.TESSERA_API_BASE ?? "https://tessera-web-delta.vercel.app").replace(/\/$/, "");

async function getJson(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { accept: "application/json" } });
  const text = await res.text();
  if (!res.ok) throw new Error(`Tessera API ${res.status}: ${text.slice(0, 200)}`);
  return text;
}

const TOOLS = [
  {
    name: "tessera_market_risk",
    description:
      "Get Tessera's current market-level risk: the live NYSE regime (open / after-hours / weekend / earnings), the health-factor bands at which the AI agent auto-repays and restores positions right now, and each tokenized-equity collateral's price + oracle freshness. Use to understand gap risk for tokenized stocks at this moment.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "tessera_position_risk",
    description:
      "Get the risk of a specific borrower position on Tessera by wallet address: health factor, safety score (0-100), USDC debt, whether it is at-risk under the current regime, and how far its collateral would have to fall before the AI agent steps in. Read-only public on-chain data.",
    inputSchema: {
      type: "object",
      properties: { address: { type: "string", description: "0x EVM wallet address of the borrower" } },
      required: ["address"],
      additionalProperties: false,
    },
  },
];

const server = new Server(
  { name: "tessera-risk", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    if (name === "tessera_market_risk") {
      return { content: [{ type: "text", text: await getJson("/api/risk") }] };
    }
    if (name === "tessera_position_risk") {
      const addr = String(args?.address ?? "").trim();
      if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
        return { content: [{ type: "text", text: "Error: address must be a 0x EVM address." }], isError: true };
      }
      return { content: [{ type: "text", text: await getJson(`/api/risk/${addr}`) }] };
    }
    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  } catch (e) {
    return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("tessera-mcp ready (API base:", API_BASE + ")");
