import { RiskClient } from "@/components/risk-client";

export const metadata = { title: "Risk parameters" };

export default function RiskPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Risk parameters</h1>
        <p className="text-sm text-[color:var(--color-muted-foreground)] max-w-2xl">
          Every collateral asset, its loan-to-value and liquidation limits, the liquidation bonus,
          and live oracle status — read directly from the vault. Nothing here is marketing; it&apos;s
          the on-chain configuration that governs your position.
        </p>
      </header>
      <RiskClient />
    </div>
  );
}
