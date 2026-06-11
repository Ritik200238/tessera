import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata = {
  title: "For developers & agents",
  openGraph: {
    title: "Tessera — risk layer for AI agents",
    description: "A public Risk API + an MCP server so other AI agents can consume Tessera's risk signals.",
  },
};

/**
 * Developer / agentic surface — Tessera as the risk layer other apps and AI
 * agents consume. The agentic-category thesis made concrete and discoverable:
 * a public read-only Risk API + an MCP server, both live, both verifiable.
 */
const API_BASE = "https://tessera-web-delta.vercel.app";

const RH_ADDRESSES = `Robinhood Chain testnet (chain 46630)
Vault (full backstop)  0xf10acf61b480c24102b303ebafb97d9392d693f2
USDC                   0x753b9aC945Feb9dD0C5DD1861B8905e8E03B41dD
Oracle                 0x65e6926BCD4EC600d4175019f20abAE07F95316D
tAAPL / tTSLA / tSPY   0xFD0d…E8e8 / 0xd7fC…C0be / 0x2A1f…6A0e
explorer.testnet.chain.robinhood.com`;

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

      <Card>
        <CardHeader>
          <CardTitle>Also live on Robinhood Chain — with the full safety stack</CardTitle>
          <CardDescription>
            Tokenized equities&apos; native home. An Arbitrum Orbit L2 whose larger code-size limit
            fits the complete vault — including the permissionless backstop + dual-oracle guard that
            don&apos;t fit Sepolia&apos;s 24KB.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Code>{RH_ADDRESSES}</Code>
          <p className="text-xs text-[color:var(--color-muted-foreground)]">
            Some addresses match a Sepolia contract — that&apos;s expected, not a copy-paste error: an
            identical deployer + nonce produces the same CREATE address on each chain.
          </p>
          <p>
            <strong>The backstop is proven, not just deployed.</strong> A non-agent address
            liquidated a stale-heartbeat position on-chain (health factor 0.94 → 1.20), running the
            same close-factor + post-HF-improvement guards as an agent liquidation —{" "}
            <a className="font-medium underline" href="https://explorer.testnet.chain.robinhood.com/tx/0x1c2f6a9024c4ec3018d074510a6bee7eea8a06823a9c975e74f0fe62c4881c76" target="_blank" rel="noopener noreferrer">
              verify the liquidation ↗
            </a>. The same agent + UI are chain-agnostic; the vault redeploys to any Orbit chain.
          </p>
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
    <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-muted)] p-3 text-xs leading-relaxed">
      <code className="font-mono">{children}</code>
    </pre>
  );
}
