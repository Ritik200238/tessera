import { BorrowForm } from "@/components/borrow-form";

export const metadata = { title: "Borrow" };

export default function BorrowPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Borrow USDC</h1>
        <p className="text-sm text-[color:var(--color-muted-foreground)] max-w-2xl">
          Slide to choose how much USDC to borrow against your collateral. The projected Safety
          Score updates instantly so you can decide before signing.
        </p>
      </header>
      <BorrowForm />
    </div>
  );
}
