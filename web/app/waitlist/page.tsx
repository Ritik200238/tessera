import { WaitlistForm } from "@/components/waitlist-form";
import { brand } from "@/lib/content";

export const metadata = {
  title: "Early access",
  description: "Join the Tessera early-access list — the safest place to borrow against tokenized stocks.",
  openGraph: {
    title: "Get early access to Tessera",
    description: brand.tagline,
  },
};

export default function WaitlistPage() {
  return (
    <div className="mx-auto max-w-xl space-y-8 py-8">
      <header className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Get early access</h1>
        <p className="text-[color:var(--color-muted-foreground)] leading-relaxed">
          {brand.tagline} Tessera is live on testnet and opening to early users in waves. Leave your email
          and we&apos;ll reach out when it&apos;s your turn — one email, nothing else.
        </p>
      </header>

      <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-muted)] p-6">
        <WaitlistForm />
      </div>

      <ul className="mx-auto max-w-md space-y-2 text-sm text-[color:var(--color-muted-foreground)]">
        <li>· No spam, no token, no airdrop farming — just a heads-up when access opens.</li>
        <li>· The one optional question helps us build for what you actually need.</li>
        <li>· We collect nothing beyond your email and that answer. See our{" "}
          <a href="/privacy" className="text-[color:var(--color-primary)] underline underline-offset-2 hover:opacity-80">privacy policy</a>.
        </li>
      </ul>
    </div>
  );
}
