import type { Metadata, Viewport } from "next";
import { ReactNode } from "react";
import { Schibsted_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { Providers } from "./providers";
import { Shell } from "@/components/shell";
import "./globals.css";

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

export const metadata: Metadata = {
  title: {
    default: "Tessera — Borrow against tokenized stocks, safely",
    template: "%s · Tessera",
  },
  description:
    "The safest venue to lend USDC or borrow against tokenized equities. An AI agent watches every position 24/7 and acts before a liquidation, not after. No token, ever.",
};

export const viewport: Viewport = {
  themeColor: "#fbfbfa",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh flex flex-col">
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
