import { DepositForm } from "@/components/deposit-form";
import { addresses } from "@/lib/addresses";

export const metadata = { title: "Deposit" };

export default function DepositPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Deposit collateral</h1>
        <p className="text-sm text-[color:var(--color-muted-foreground)] max-w-2xl">
          Use your tokenized stocks as collateral. Tessera unlocks USDC borrowing power while the
          AI agent watches the position around the clock.
        </p>
      </header>
      <DepositForm tokens={addresses.collateralTokens} />
    </div>
  );
}
