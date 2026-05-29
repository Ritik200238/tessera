import { LendForm } from "@/components/lend-form";

export const metadata = { title: "Lend" };

export default function LendPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Lend USDC</h1>
        <p className="text-sm text-[color:var(--color-muted-foreground)] max-w-2xl">
          Supply USDC to the lending pool and earn yield from borrowers. The agent protects the
          pool by liquidating undercollateralized positions before they go bad.
        </p>
      </header>
      <LendForm />
    </div>
  );
}
