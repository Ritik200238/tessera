import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { ReactNode } from "react";
import { Providers } from "./providers";
import { ConnectButton } from "@/components/connect-button";
import { ChainBanner } from "@/components/chain-banner";
import { PausedBanner } from "@/components/paused-banner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Tessera — AI-protected lending on tokenized stocks",
    template: "%s · Tessera",
  },
  description:
    "Deposit tokenized stocks, borrow stablecoins, and let Tessera's AI risk agent watch your position 24/7.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d12" },
  ],
};

const NAV: { href: string; label: string }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/deposit", label: "Deposit" },
  { href: "/borrow", label: "Borrow" },
  { href: "/lend", label: "Lend" },
  { href: "/agent", label: "Agent" },
  { href: "/admin", label: "Admin" },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh flex flex-col">
        <Providers>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded-md focus:bg-[color:var(--color-primary)] focus:px-3 focus:py-2 focus:text-[color:var(--color-primary-foreground)]"
          >
            Skip to content
          </a>
          <header className="border-b border-[color:var(--color-border)] bg-[color:var(--color-background)]/80 backdrop-blur sticky top-0 z-30">
            <div className="mx-auto max-w-6xl flex items-center justify-between gap-6 px-4 py-3">
              <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
                <span aria-hidden className="inline-block size-6 rounded-md bg-gradient-to-br from-[color:var(--color-primary)] to-[color:var(--color-ring)]" />
                <span className="text-lg">Tessera</span>
              </Link>
              <nav aria-label="Primary" className="hidden md:flex items-center gap-1 text-sm">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-md px-3 py-1.5 text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)] hover:bg-[color:var(--color-muted)] transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <ConnectButton />
            </div>
            <nav aria-label="Primary mobile" className="md:hidden border-t border-[color:var(--color-border)]">
              <div className="mx-auto max-w-6xl flex overflow-x-auto gap-1 px-4 py-2 text-sm">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="shrink-0 rounded-md px-3 py-1.5 text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)] hover:bg-[color:var(--color-muted)]"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </nav>
          </header>

          <ChainBanner />
          <PausedBanner />

          <main id="main" className="flex-1 mx-auto w-full max-w-6xl px-4 py-8">
            {children}
          </main>

          <footer className="border-t border-[color:var(--color-border)] mt-12">
            <div className="mx-auto max-w-6xl flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-4 py-6 text-sm text-[color:var(--color-muted-foreground)]">
              <p>© {new Date().getFullYear()} Tessera Protocol · Testnet only · Not financial advice.</p>
              <div className="flex items-center gap-4">
                <a className="hover:text-[color:var(--color-foreground)]" href="https://docs.robinhood.com/chain/" target="_blank" rel="noreferrer noopener">Robinhood Chain</a>
                <Link className="hover:text-[color:var(--color-foreground)]" href="/agent">Agent log</Link>
                <Link className="hover:text-[color:var(--color-foreground)]" href="/admin">Admin</Link>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
