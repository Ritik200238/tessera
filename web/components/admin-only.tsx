"use client";

import type { ReactNode } from "react";
import { useAccount } from "wagmi";
import { env } from "@/lib/env";

/**
 * Renders children only when the connected wallet is the configured admin
 * (same gate as the Admin nav item in shell.tsx). Operator-only controls must
 * never be shown to ordinary visitors.
 */
export function AdminOnly({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const isAdmin = !!address && !!env.adminAddress && address.toLowerCase() === env.adminAddress;
  if (!isAdmin) return null;
  return <>{children}</>;
}
