import type { Metadata, Viewport } from "next";
import { ReactNode } from "react";
import Script from "next/script";
import { Schibsted_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { Providers } from "./providers";
import { Shell } from "@/components/shell";
import "./globals.css";

// Privacy-first analytics (Plausible-compatible). Injected only when a domain is
// configured; no PII, no cookies. See lib/analytics.ts.
const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
const PLAUSIBLE_SRC = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC ?? "https://plausible.io/js/script.js";

// Brand Kit type system: Schibsted Grotesk for all language, IBM Plex Mono for
// every number (rates, balances, health factors, addresses).
const sans = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-schibsted",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const DESCRIPTION =
  "The safest venue to lend USDC or borrow against tokenized equities. An AI agent watches every position 24/7 and acts before a liquidation, not after. No token, ever.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Tessera — Borrow against tokenized stocks, safely",
    template: "%s · Tessera",
  },
  description: DESCRIPTION,
  applicationName: "Tessera",
  openGraph: {
    type: "website",
    siteName: "Tessera",
    title: "Tessera — Borrow against tokenized stocks, safely",
    description: DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Tessera — Borrow against tokenized stocks, safely",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#fbfbfa",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh flex flex-col">
        {PLAUSIBLE_DOMAIN ? (
          <Script defer data-domain={PLAUSIBLE_DOMAIN} src={PLAUSIBLE_SRC} strategy="afterInteractive" />
        ) : null}
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
