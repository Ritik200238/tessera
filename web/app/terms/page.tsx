import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export const metadata = {
  title: "Terms & Risk",
  description: "Interim terms of use and risk disclosure for the Tessera testnet. Best-effort, not an SLA. No real funds.",
};

function Fact({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-[color:var(--color-muted-foreground)]">{children}</p>
    </div>
  );
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-4">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Terms of Use &amp; Risk Disclosure</h1>
        <p className="text-sm text-[color:var(--color-muted-foreground)]">
          Interim, plain-language version for the <strong>testnet</strong>. This is not legal or
          financial advice; a counsel-reviewed version will replace it before any mainnet launch.
        </p>
      </header>

      <Alert tone="warning">
        <AlertTitle>Testnet — no real money</AlertTitle>
        <AlertDescription>
          Tessera currently runs on the Robinhood Chain testnet (an Arbitrum Orbit chain). Tokens,
          prices, and balances are test values with no monetary worth. Nothing here is an offer of a
          financial product, and prices are simulated (a test oracle holding last-close values), not
          a live market feed.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>The promise — and its limits</CardTitle>
          <CardDescription>What the protocol does, stated honestly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Fact title="Best-effort monitoring — not a service-level guarantee">
            The autonomous agent (&ldquo;the Watcher&rdquo;) re-checks positions on a loop of roughly
            every 10 seconds and can pre-emptively repay or alert. It runs on best-effort
            infrastructure that can be slow, restart, or be offline. There is <strong>no uptime SLA
            and no guarantee a position will be protected</strong>. Watch the in-app banner and the{" "}
            <a className="underline" href="/status">Status</a> page; if it shows the Watcher is
            offline, manage your position yourself.
          </Fact>
          <Fact title="Non-custodial — you hold the keys">
            The protocol never takes custody of your funds. If you enable Active Protection, the agent
            can only call <code className="font-mono">agentRepayFor</code> to reduce <strong>your
            own</strong> debt, using an allowance you grant and can revoke at any time, bounded by
            on-chain per-transaction and per-day caps. It can never send your funds to anyone else.
          </Fact>
          <Fact title="Protection is conditional, not magic">
            Auto-repay only fires when you have pre-approved USDC available and the position is within
            a protectable margin. A large enough overnight or weekend price gap can still liquidate a
            position before protection can act. Keep a buffer and don&apos;t rely on the agent alone.
          </Fact>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risks you accept by using Tessera</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Fact title="Smart-contract risk">
            The contracts are <strong>unaudited</strong> on testnet. Bugs could cause loss of (test)
            funds. The vault is intentionally non-upgradeable; a discovered flaw is handled by pausing
            and migrating, not patching in place.
          </Fact>
          <Fact title="Oracle / price risk">
            Collateral is valued from an oracle. On testnet that oracle holds simulated last-close
            prices refreshed by a keeper; if it goes stale, price reads revert and the protocol
            refuses to act rather than act on a bad price. A live, licensed market feed is a mainnet
            gate.
          </Fact>
          <Fact title="Liquidation risk">
            If your health factor falls below the threshold, your collateral can be liquidated at a
            penalty. Liquidation on testnet is agent-only today; the permissionless backstop is built
            but disabled until mainnet.
          </Fact>
          <Fact title="Regulatory risk">
            Tokenized equities and lending against them may be regulated. Tessera is{" "}
            <strong>not available to US persons or to residents of sanctioned jurisdictions</strong>,
            and the regulatory posture for any mainnet launch is subject to legal review.
          </Fact>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>No warranty</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[color:var(--color-muted-foreground)]">
          The protocol and this interface are provided <strong>&ldquo;as is&rdquo;</strong>, without
          warranties of any kind. To the maximum extent permitted by law, the contributors are not
          liable for any loss arising from use of the protocol, agent downtime, oracle failure,
          liquidation, or smart-contract behavior. You are responsible for your own keys, decisions,
          and tax/legal compliance.
        </CardContent>
      </Card>
    </div>
  );
}
