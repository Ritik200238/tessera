"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAccount } from "wagmi";
import { Mark } from "@/components/mark";
import { ConnectButton } from "@/components/connect-button";
import { ViewModeToggle } from "@/components/view-mode";
import { ChainBanner } from "@/components/chain-banner";
import { PausedBanner } from "@/components/paused-banner";
import { env } from "@/lib/env";
import { brand, links, chain } from "@/lib/content";

/**
 * Footer information architecture. The header stays minimal (product actions
 * only, BASE_NAV above); ALL informational/company/legal links live here,
 * grouped into clear sections so the footer is the discovery hub — not a flat
 * link dump and not crammed into the navbar.
 */
type FooterLink = { href: string; label: string; external?: boolean };
const FOOTER_SECTIONS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/borrow", label: "Borrow" },
      { href: "/lend", label: "Earn" },
      { href: "/dashboard", label: "Dashboard" },
      { href: "/risk", label: "Markets & risk" },
      { href: "/drill", label: "Live Drill" },
      { href: "/status", label: "Status" },
    ],
  },
  {
    title: "Developers",
    links: [
      { href: "/docs", label: "Docs" },
      { href: "/developers", label: "Developers" },
      { href: links.github, label: "GitHub", external: true },
      { href: "/security", label: "Security" },
      { href: "/transparency", label: "Transparency" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/blog", label: "Blog" },
      { href: "/roadmap", label: "Roadmap" },
      { href: "/why", label: "Why Tessera" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/faq", label: "FAQ" },
      { href: "/litepaper", label: "Litepaper" },
      { href: "/explore", label: "Explore" },
      { href: "/sandbox", label: "Sandbox" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/disclaimer", label: "Disclaimer" },
      { href: "/brand", label: "Brand & license" },
    ],
  },
];

// Clear, non-overlapping top-level nav. Collateral deposit is part of the
// Borrow journey, not a peer destination. Admin is gated to the multisig
// owner and never shown to the public.
const BASE_NAV: { href: string; label: string }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/lend", label: "Lend" },
  { href: "/borrow", label: "Borrow" },
  { href: "/risk", label: "Risk" },
  { href: "/agent", label: "Activity" },
  { href: "/drill", label: "Live Drill" },
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
          <div className="flex items-center gap-2">
            <ViewModeToggle />
            <ConnectButton />
          </div>
        </div>
        <nav aria-label="Primary mobile" className="md:hidden border-t border-[color:var(--color-border)]">
          <div className="mx-auto max-w-6xl flex overflow-x-auto gap-1 px-4 py-2 text-sm">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className={
                  "shrink-0 rounded-md px-3 py-1.5 transition-colors " +
                  (pathname === item.href
                    ? "bg-[color:var(--color-muted)] text-[color:var(--color-foreground)] font-medium"
                    : "text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)] hover:bg-[color:var(--color-muted)]")
                }
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

      <footer className="border-t border-[color:var(--color-border)] mt-16">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-6">
            {/* Brand column */}
            <div className="col-span-2 sm:col-span-3 lg:col-span-1">
              <Link href="/" className="flex items-center gap-2.5">
                <Mark size={22} />
                <span className="text-base font-bold tracking-[-0.025em]">Tessera</span>
              </Link>
              <p className="mt-3 text-xs leading-relaxed text-[color:var(--color-muted-foreground)] max-w-[40ch]">
                {brand.tagline}
              </p>
            </div>
            {FOOTER_SECTIONS.map((section) => (
              <nav key={section.title} aria-label={section.title}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-foreground)]">
                  {section.title}
                </h3>
                <ul className="mt-3 space-y-2">
                  {section.links.map((l) => (
                    <li key={l.href + l.label}>
                      {l.external ? (
                        <a
                          href={l.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)] transition-colors"
                        >
                          {l.label} ↗
                        </a>
                      ) : (
                        <Link
                          href={l.href}
                          className="text-sm text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)] transition-colors"
                        >
                          {l.label}
                        </Link>
                      )}
                    </li>
                  ))}
                  {/* Admin link is gated and only shown in the Company column for the owner. */}
                  {section.title === "Company" && isAdmin ? (
                    <li>
                      <Link href="/admin" className="text-sm text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)] transition-colors">
                        Admin
                      </Link>
                    </li>
                  ) : null}
                </ul>
              </nav>
            ))}
          </div>
          <div className="mt-12 flex flex-col gap-2 border-t border-[color:var(--color-border)] pt-6 text-xs text-[color:var(--color-muted-foreground)] sm:flex-row sm:items-center sm:justify-between">
            <p className="mono">
              © {new Date().getFullYear()} Tessera · No token, ever · Testnet only · Not financial advice.
            </p>
            <p>Built on {chain.name}.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
