"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { erc20Abi } from "viem";
import { useAccount, useReadContracts } from "wagmi";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { vault, isVaultDeployed } from "@/lib/contracts";
import { addresses } from "@/lib/addresses";
import { FaucetButton } from "@/components/faucet-button";
import { DepositForm } from "@/components/deposit-form";
import { BorrowForm } from "@/components/borrow-form";
import { AgentControls } from "@/components/agent-controls";
import { ConnectButton } from "@/components/connect-button";

/**
 * Guided first-position walk — numbered steps, each a REAL transaction through
 * the same components the app uses everywhere, with progress detected from
 * on-chain state (not localStorage), so it survives reloads and never lies.
 * A first-time user goes faucet → collateral → borrow → protection → watch,
 * and ends with a live AI-protected position.
 */
export function StartWalk() {
  const { address, isConnected } = useAccount();
  const tokens = addresses.collateralTokens;
  const enabled = isConnected && isVaultDeployed() && !!address && !!addresses.usdc;

  // Two homogeneous batches (erc20 vs vault ABIs) — viem's multicall typing
  // can't union heterogeneous ABI entries in one array.
  const { data: erc20Data } = useReadContracts({
    contracts: enabled
      ? [
          { address: addresses.usdc!, abi: erc20Abi, functionName: "balanceOf", args: [address!] },
          { address: addresses.usdc!, abi: erc20Abi, functionName: "allowance", args: [address!, vault.address!] },
        ]
      : [],
    query: { enabled, refetchInterval: 15_000 },
  });
  const { data: vaultData } = useReadContracts({
    contracts: enabled
      ? [
          { address: vault.address!, abi: vault.abi, functionName: "debtOf", args: [address!] },
          ...tokens.map((t) => ({
            address: vault.address!,
            abi: vault.abi,
            functionName: "collateralOf",
            args: [address!, t.address],
          })),
        ]
      : [],
    query: { enabled, refetchInterval: 15_000 },
  });

  const usdcBal = (erc20Data?.[0]?.result as bigint | undefined) ?? 0n;
  const allowance = (erc20Data?.[1]?.result as bigint | undefined) ?? 0n;
  const debt = (vaultData?.[0]?.result as bigint | undefined) ?? 0n;
  const hasCollateral = tokens.some((_, i) => ((vaultData?.[1 + i]?.result as bigint | undefined) ?? 0n) > 0n);

  const done = [usdcBal > 0n, hasCollateral, debt > 0n, allowance > 0n];
  const current = done.findIndex((d) => !d);
  const activeStep = current === -1 ? 4 : current;

  if (!isConnected) {
    return (
      <div className="rounded-xl border border-[color:var(--color-border)] p-6 text-center">
        <p className="text-sm text-[color:var(--color-muted-foreground)]">
          Connect a wallet to start — every step below is a real transaction on Arbitrum Sepolia,
          with test funds we give you for free.
        </p>
        <div className="mt-4 flex justify-center">
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Step n={1} title="Get test funds" done={done[0]!} active={activeStep === 0}
        summary="10,000 test USDC + 100 of each tokenized stock, minted to your wallet.">
        <FaucetButton />
      </Step>

      <Step n={2} title="Deposit stock collateral" done={done[1]!} active={activeStep === 1}
        summary="Pledge tokenized stocks — this unlocks USDC borrowing power, and you keep the upside.">
        <DepositForm tokens={tokens} />
      </Step>

      <Step n={3} title="Borrow USDC" done={done[2]!} active={activeStep === 2}
        summary="Pick a safe loan-to-value. You'll see your liquidation price and projected Safety Score before signing.">
        <BorrowForm />
      </Step>

      <Step n={4} title="Turn on AI protection" done={done[3]!} active={activeStep === 3}
        summary="Pre-approve USDC the agent may use — only ever to repay YOUR loan. The approval is the cap and the kill switch.">
        <AgentControls />
      </Step>

      <Step n={5} title="Watch it work" done={false} active={activeStep === 4}
        summary="Your position is now watched around the clock (re-checked about every 10s).">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[color:var(--color-primary)] px-4 text-sm font-medium text-[color:var(--color-primary-foreground)] hover:opacity-90"
          >
            Your dashboard <ArrowRight aria-hidden className="size-4" />
          </Link>
          <Link
            href="/drill"
            className="inline-flex h-10 items-center rounded-md border border-[color:var(--color-border)] px-4 text-sm font-medium hover:bg-[color:var(--color-muted)]"
          >
            See the AI rescue a position live
          </Link>
        </div>
      </Step>
    </div>
  );
}

function Step({
  n,
  title,
  summary,
  done,
  active,
  children,
}: {
  n: number;
  title: string;
  summary: string;
  done: boolean;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={
        "rounded-xl border p-5 transition-colors " +
        (active
          ? "border-[color:var(--color-primary)]"
          : "border-[color:var(--color-border)]" + (done ? " opacity-80" : " opacity-60"))
      }
    >
      <div className="flex items-start gap-3">
        {done ? (
          <CheckCircle2 aria-hidden className="mt-0.5 size-7 shrink-0 text-[color:var(--color-safe-fg)]" />
        ) : (
          <span
            aria-hidden
            className={
              "mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold " +
              (active
                ? "bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]"
                : "bg-[color:var(--color-muted)] text-[color:var(--color-muted-foreground)]")
            }
          >
            {n}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">
            {title}
            {done ? <span className="ml-2 text-xs font-medium text-[color:var(--color-safe-fg)]">done — verified on-chain</span> : null}
          </h2>
          <p className="mt-0.5 text-sm text-[color:var(--color-muted-foreground)]">{summary}</p>
          {active || (!done && n !== 5) ? <div className="mt-4">{children}</div> : null}
          {done && n !== 5 ? null : null}
        </div>
      </div>
    </section>
  );
}
