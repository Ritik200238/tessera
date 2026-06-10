import { StartWalk } from "@/components/start-walk";

export const metadata = { title: "Get started" };

export default function StartPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Your first protected position</h1>
        <p className="max-w-2xl text-sm text-[color:var(--color-muted-foreground)]">
          Five steps, each a real on-chain transaction with free test funds. Progress is read from
          the chain itself — reload anytime, nothing is lost. By the end, an AI agent is watching
          your loan every block.
        </p>
      </header>
      <StartWalk />
    </div>
  );
}
