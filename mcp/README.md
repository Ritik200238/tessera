# @tessera/mcp — Tessera risk layer for AI agents

Tessera is an AI agent that protects tokenized-equity loans. This MCP server
turns that risk engine into something **other** AI agents can consume — the
agentic angle of the thesis: Tessera as a risk API for the on-chain economy.

It's a thin, safe wrapper over Tessera's **public, read-only** Risk API. No keys,
no funds, no writes — only on-chain reads + the deterministic regime engine.

## Tools

- **`tessera_market_risk`** — current NYSE regime (open / after-hours / weekend /
  earnings), the health-factor bands the AI acts at *right now*, and each
  collateral's price + oracle freshness.
- **`tessera_position_risk`** (`address`) — a borrower's health factor, safety
  score, debt, at-risk status, and how far collateral can fall before the AI
  steps in.

## Run it

```bash
cd mcp && npm install
# Claude Code:
claude mcp add tessera -- node "$(pwd)/server.mjs"
```

Or in an MCP client config:

```json
{
  "mcpServers": {
    "tessera": {
      "command": "node",
      "args": ["/abs/path/to/mcp/server.mjs"],
      "env": { "TESSERA_API_BASE": "https://tessera-web-delta.vercel.app" }
    }
  }
}
```

Then ask your agent: *"What's the gap risk on Tessera right now?"* or
*"Is 0x… at risk of liquidation?"*

## HTTP API (no MCP needed)

```
GET /api/risk            → market regime + AI protection bands + asset prices
GET /api/risk/:address   → a position's HF, safety score, debt, at-risk verdict
```

Both are CORS-open public on-chain data.
