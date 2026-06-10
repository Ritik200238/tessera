import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata = { title: "For developers & agents" };

/**
 * Developer / agentic surface — Tessera as the risk layer other apps and AI
 * agents consume. The agentic-category thesis made concrete and discoverable:
 * a public read-only Risk API + an MCP server, both live, both verifiable.
 */
const API_BASE = "https://tessera-web-delta.vercel.app";

const MARKET_EXAMPLE = `GET /api/risk
{
  "regime": "open",
  "regimeLabel": "market open",
  "aiActsBelowHf": 1.10,
  "restoresTowardHf": 1.40,
  "assets": [
    { "symbol": "tAAPL", "priceUsd": 200, "stale": false }, …
  ]
}`;

const POSITION_EXAMPLE = `GET /api/risk/0xBd49…dc25
{
  "exists": true,
  "healthFactor": 4.15,
  "safetyScore": 100,
  "debtUsdc": 250.39,
  "atRisk": false,
  "dropToAiActPct": 74,
  "verdict": "Healthy: collateral would have to fall
              ~74% before the AI steps in."
}`;

const MCP_CONFIG = `{
  "mcpServers": {
    "tessera": {
      "command": "node",
      "args": ["/abs/path/to/mcp/server.mjs"],
      "env": { "TESSERA_API_BASE": "${API_BASE}" }
    }
  }
}`;

const DEMO_OUTPUT = `$ cd mcp && npm install && node demo-agent.mjs

🔌  Connected to Tessera MCP. Tools: tessera_market_risk, tessera_position_risk
🌐  Market regime: market open. The AI acts below HF 1.1.
🔎  Consulting risk for 0xBd4956F8…
    Health factor: 4.15   Safety score: 100/100   Debt: $250.39
🧠  Decision:
    APPROVE — safety score 100, 74% cushion before the AI steps in.
    ↳ live on-chain risk, served by Tessera, consumed over MCP.`;

export default function DevelopersPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">For developers &amp; AI agents</h1>
        <p className="max-w-2xl text-sm text-[color:var(--color-muted-foreground)]">
          Tessera isn&apos;t only an agent that protects positions — it&apos;s a risk layer other apps
          and autonomous agents can read before they act. A public, read-only Risk API and an MCP
          server, both live, both backed by real on-chain data + the same regime engine the agent
          runs. No keys, no writes.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Public Risk API</CardTitle>
          <CardDescription>CORS-open, read-only, always-on. Real on-chain reads.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-medium">Market risk — regime + protection bands</p>
            <Code>{MARKET_EXAMPLE}</Code>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">Position risk — any borrower address</p>
            <Code>{POSITION_EXAMPLE}</Code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>MCP server — for AI agents</CardTitle>
          <CardDescription>
            Two tools — <code className="font-mono">tessera_market_risk</code> and{" "}
            <code className="font-mono">tessera_position_risk</code> — so Claude, Cursor, or any agent
            can consult Tessera before acting.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-medium">Connect (any MCP client)</p>
            <Code>{MCP_CONFIG}</Code>
            <p className="mt-2 text-xs text-[color:var(--color-muted-foreground)]">
              Claude Code: <code className="font-mono">claude mcp add tessera -- node /abs/mcp/server.mjs</code>
            </p>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">Run the live demo (an external agent consulting Tessera)</p>
            <Code>{DEMO_OUTPUT}</Code>
            <p className="mt-2 text-xs text-[color:var(--color-muted-foreground)]">
              Source: <code className="font-mono">mcp/server.mjs</code> +{" "}
              <code className="font-mono">mcp/demo-agent.mjs</code> — a real MCP client → server →
              live API roundtrip.
            </p>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-[color:var(--color-muted-foreground)]">
        This is the agentic thesis: every external agent that reads Tessera&apos;s risk signal is a
        node in a network that trusts our risk engine. Lending is the first customer; the risk layer
        is the product.
      </p>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-muted)] p-3 text-xs leading-relaxed">
      <code className="font-mono">{children}</code>
    </pre>
  );
}
