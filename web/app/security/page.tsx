import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export const metadata = { title: "Security" };

/**
 * Security & trust page — the first thing a keeper/oracle-fluent DeFi-native looks
 * for. States the audit posture, the trust model (what the agent can and cannot
 * do), the risk parameters, and the operational facts (single keeper, oracle
 * staleness). Honest by design: nothing here over-claims. Mirrors SECURITY.md.
 */
export default function SecurityPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Security &amp; trust</h1>
        <p className="max-w-2xl text-sm text-[color:var(--color-muted-foreground)]">
          What protects you, what doesn&apos;t yet, and exactly what the AI agent can and cannot do
          with your funds. For live oracle freshness and agent heartbeat, see{" "}
          <Link href="/status" className="font-medium underline">Status</Link>.
        </p>
      </header>

      <Alert tone="warning">
        <AlertTitle>Testnet · not audited · do not use real funds</AlertTitle>
        <AlertDescription>
          Tessera runs on Arbitrum Sepolia with mock tokens and a mock Chainlink-style oracle. An
          independent audit is a hard gate before any mainnet deployment with real money.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>The trust model</CardTitle>
          <CardDescription>By design, the protocol can never take your money.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Fact title="Non-custodial">
            The protocol never holds your funds beyond the vault&apos;s accounting, and the AI agent
            never holds them at all.
          </Fact>
          <Fact title="The agent can only REDUCE your debt">
            Auto-repay (<code className="font-mono">agentRepayFor</code>) is agent-only and pulls
            <strong> only</strong> from the USDC allowance you pre-approve to the vault — it can never
            withdraw or move your collateral. Your allowance is both the spending cap and the kill
            switch: revoke it and protection is off instantly. There is also an on-chain
            per-(user, day) cap on agent repay.
          </Fact>
          <Fact title="The AI never moves money on a hunch">
            All money decisions (whether and how much to act) are deterministic. The LLM only writes
            the plain-English explanations; it cannot trigger a transaction.
          </Fact>
          <Fact title="Not custody, not money transmission">
            The agent never holds, pools, or transmits your funds. It can do exactly one thing:
            call <code className="font-mono">agentRepayFor</code> to reduce <strong>your own</strong>{" "}
            loan, using an allowance you granted and can revoke. It cannot send your money anywhere —
            not to us, not to a third party. There is no flow in which value leaves your control to
            anyone but your own debt.
          </Fact>
          <Fact title="Permissionless backstop — live + proven on Robinhood Chain">
            If the agent goes silent, a heartbeat-gated backstop lets <em>anyone</em> liquidate an
            unhealthy position — running the identical close-factor + post-HF-improvement guards, so
            it&apos;s provably as safe as an agent liquidation. The full vault carrying this backstop +
            the dual-oracle deviation guard is ~1KB over Sepolia&apos;s 24KB code limit, so it runs
            live on{" "}
            <a className="font-medium underline" href="https://explorer.testnet.chain.robinhood.com/address/0xf10acf61b480c24102b303ebafb97d9392d693f2" target="_blank" rel="noopener noreferrer">
              Robinhood Chain
            </a>{" "}
            (an Arbitrum Orbit L2 with a larger limit — and the native home of tokenized equities).
            It&apos;s not just deployed, it&apos;s <strong>proven</strong>: a non-agent address
            backstop-liquidated a stale-heartbeat position on-chain, health factor 0.94 → 1.20 —{" "}
            <a className="font-medium underline" href="https://explorer.testnet.chain.robinhood.com/tx/0x1c2f6a9024c4ec3018d074510a6bee7eea8a06823a9c975e74f0fe62c4881c76" target="_blank" rel="noopener noreferrer">
              verify the liquidation ↗
            </a>.
          </Fact>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Fact title="Conservative LTVs, sized for overnight gaps">
            40–60% max LTV and 55–75% liquidation thresholds per asset — deliberately low so a
            weekend or earnings gap has room to be absorbed. See per-asset numbers on{" "}
            <Link href="/risk" className="font-medium underline">Risk</Link>.
          </Fact>
          <Fact title="Oracle staleness reverts">
            Every price read enforces a max-age bound; a stale feed reverts rather than acting on a
            bad price. On testnet the oracle is a mock kept fresh by a keeper.
          </Fact>
          <Fact title="Pause + per-asset freeze">
            The owner can pause the whole vault and freeze an individual collateral asset (blocking
            new deposits while existing positions keep their value).
          </Fact>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Honest operational notes (FAQ)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Fact title="What if the agent goes down?">
            Your on-chain protections (allowance cap, HF checks, the contract&apos;s own rules) don&apos;t
            depend on it. While it&apos;s down, new alerts/auto-repays pause; the pre-mainnet backstop
            exists so liquidations can still happen. Live heartbeat is on{" "}
            <Link href="/status" className="font-medium underline">Status</Link>.
          </Fact>
          <Fact title="What if the oracle is stale?">
            Reads revert past the staleness window — the protocol refuses to act on a bad price
            rather than mis-liquidate.
          </Fact>
          <Fact title="Single-keeper risk">
            Today the agent is a single signer. That is a known MVP limitation; the permissionless
            backstop + an always-on host + monitoring address it before mainnet.
          </Fact>
          <Fact title="What if my wallet can't cover the repay?">
            Auto-repay pulls from <em>your</em> USDC. If your balance or remaining allowance
            can&apos;t cover what&apos;s needed, the agent does <strong>not</strong> fail silently — it
            falls back to a loud alert so you can act yourself. Protection degrades to a warning; it
            never pretends to have saved a position it couldn&apos;t.
          </Fact>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Economics — how Tessera makes money</CardTitle>
          <CardDescription>No token. No insiders. Just the interest spread.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Fact title="No token, ever">
            No airdrop, points, or governance coin — nothing to farm or defend. Revenue is the
            classic money-market interest spread, nothing more.
          </Fact>
          <Fact title="15% reserve factor">
            Of the interest borrowers pay, 85% flows to lenders (your supply APY) and 15% accrues to
            a protocol reserve. That split is the whole business model.
          </Fact>
          <Fact title="The reserve is a first-loss buffer, not a treasury">
            The reserve capitalizes the safety buffer that absorbs bad debt before lenders are
            touched, and funds operations (oracle keeper, hosting, audit). It is not a payout to
            insiders — there are no insiders to pay.
          </Fact>
          <Fact title="Protection is funded by you, liquidation by the liquidator">
            Auto-repay spends <em>your</em> pre-approved USDC to save <em>your</em> position — never
            protocol funds. Liquidation is funded by the liquidator, who earns a 5% bonus; the
            protocol takes a small cut of that bonus on the risk events it absorbs.
          </Fact>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mainnet gates (hard requirements)</CardTitle>
          <CardDescription>None of these are crossed yet. All must be, before real funds.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="ml-5 list-decimal space-y-1 text-sm">
            <li>Independent audit complete</li>
            <li>Permissionless, heartbeat-gated liquidation backstop live <em>(built + proven on Robinhood Chain; enabled per-chain at mainnet)</em></li>
            <li>Public bug bounty</li>
            <li>Insurance / safety reserve seeded (from the reserve factor)</li>
            <li>Legal review of ToS + risk disclosure; US + sanctioned-jurisdiction geo-block</li>
            <li>Conservative per-asset TVL caps</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function Fact({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[color:var(--color-border)] pb-3 last:border-none last:pb-0">
      <p className="font-medium text-[color:var(--color-foreground)]">{title}</p>
      <p className="mt-0.5 text-[color:var(--color-muted-foreground)]">{children}</p>
    </div>
  );
}
