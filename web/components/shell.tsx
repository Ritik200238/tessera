"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAccount } from "wagmi";
import { Mark } from "@/components/mark";
import { ConnectButton } from "@/components/connect-button";
import { ChainBanner } from "@/components/chain-banner";
import { PausedBanner } from "@/components/paused-banner";
import { env } from "@/lib/env";

// Clear, non-overlapping top-level nav. Collateral deposit is part of the
// Borrow journey, not a peer destination. Admin is gated to the multisig
// owner and never shown to the public.
const BASE_NAV: { href: string; label: string }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/lend", label: "Lend" },
  { href: "/borrow", label: "Borrow" },
  { href: "/agent", label: "Activity" },
];

/**
 * App chrome (header / banners / footer). The marketing landing at "/" supplies
 * its own full-bleed nav + footer, so the shell steps aside there.
 */
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { address } = useAccount();
  const isAdmin =
    !!address && !!env.adminAddress && address.toLowerCase() === env.adminAddress;
  const nav = isAdmin ? [...BASE_NAV, { href: "/admin", label: "Admin" }] : BASE_NAV;

  if (pathname === "/") return <>{children}</>;

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded-md focus:bg-[color:var(--color-primary)] focus:px-3 focus:py-2 focus:text-[color:var(--color-primary-foreground)]"
      >
        Skip to content
      </a>
      <header className="border-b border-[color:var(--color-border)] bg-[color:var(--canvas)]/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-6 px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Mark size={24} />
            <span className="text-lg font-bold tracking-[-0.025em]">Tessera</span>
          </Link>
          <nav aria-label="Primary" className="hidden md:flex items-center gap-1 text-sm">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className={
                  "rounded-md px-3 py-1.5 transition-colors hover:bg-[color:var(--color-muted)] " +
                  (pathname === item.href
                    ? "text-[color:var(--color-foreground)] font-medium"
                    : "text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]")
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <ConnectButton />
        </div>
        <nav aria-label="Primary mobile" className="md:hidden border-t border-[color:var(--color-border)]">
          <div className="mx-auto max-w-6xl flex overflow-x-auto gap-1 px-4 py-2 text-sm">
            {nav.map((item) => (
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
          <p className="mono text-xs">
            © {new Date().getFullYear()} Tessera · No token, ever · Testnet only · Not financial advice.
          </p>
          <div className="flex items-center gap-4">
            <Link className="hover:text-[color:var(--color-foreground)]" href="/">
              Home
            </Link>
            <Link className="hover:text-[color:var(--color-foreground)]" href="/agent">
              Agent log
            </Link>
            <Link className="hover:text-[color:var(--color-foreground)]" href="/admin">
              Admin
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
