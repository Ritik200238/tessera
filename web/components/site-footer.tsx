import Link from "next/link";
import { Check } from "lucide-react";
import { Mark } from "@/components/mark";
import { brand, links, chain } from "@/lib/content";

type FooterLink = { href: string; label: string; external?: boolean };

/**
 * The single, canonical site footer — used by the app shell AND the marketing
 * landing so every page shows the same professional sitemap. Surfaces the full
 * breadth of what we shipped: product, developer docs, company, resources, legal.
 */
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
      { href: "/brand", label: "Brand Kit" },
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
    ],
  },
];

const linkClass =
  "text-sm text-[color:var(--color-muted-foreground)] transition-colors hover:text-[color:var(--color-foreground)]";

export function SiteFooter({ isAdmin = false }: { isAdmin?: boolean }) {
  return (
    <footer className="border-t border-[color:var(--color-border)] bg-[color:var(--canvas)] print:hidden">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-6">
          {/* brand */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5">
              <Mark size={22} />
              <span className="text-base font-bold tracking-[-0.025em]">Tessera</span>
            </Link>
            <p className="mt-3 max-w-[34ch] text-sm leading-relaxed text-[color:var(--color-muted-foreground)]">
              {brand.tagline}
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#cbe6da] bg-[color:var(--safe-wash)] px-2.5 py-1 font-mono text-[11px] text-[color:var(--safe)]">
              <Check aria-hidden className="size-3" /> No token, ever
            </span>
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
                      <a href={l.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                        {l.label} ↗
                      </a>
                    ) : (
                      <Link href={l.href} className={linkClass}>
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
                {section.title === "Company" && isAdmin ? (
                  <li>
                    <Link href="/admin" className={linkClass}>
                      Admin
                    </Link>
                  </li>
                ) : null}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-[color:var(--color-border)] pt-6 text-xs text-[color:var(--color-muted-foreground)] sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono">
            © {new Date().getFullYear()} Tessera · No token, ever · Testnet only · Not financial advice.
          </p>
          <p className="font-mono">
            Built on {chain.name} ({chain.kind}).
          </p>
        </div>
      </div>
    </footer>
  );
}
