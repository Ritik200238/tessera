/**
 * Live Drill orchestrator — the judge-clickable "watch the AI save a position".
 *
 * Runs a REAL end-to-end protection drill on Arbitrum Sepolia, on an ISOLATED
 * drill-only asset (listed on-chain but absent from the app's address book, so
 * its price moves can never touch a real user's position):
 *
 *   1. stamp the drill-asset price ($100) and reset any leftover position
 *   2. deposit 20 tDRILL ($2,000) and borrow 720 USDC  → HF ≈ 1.53
 *   3. gap the price to $67 (a −33% overnight-style gap) → HF ≈ 1.03
 *   4. the SAME live agent that protects real users detects the breach on its
 *      next tick and auto-repays from the drill wallet's pre-approved USDC
 *   5. verify the repay on-chain, surface the tx hash + decision record,
 *      restore the price, and reset
 *
 * Nothing is simulated: every step is a real transaction, and step 4 is the
 * production code path (tick → tryAutoRepay → agentRepayFor). One drill at a
 * time, with a cooldown, so a public button can't grief the rig.
 */

import {
  createWalletClient,
  erc20Abi,
  http,
  parseUnits,
  type Account,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { vaultAbi } from "../vault-client.js";
import type { JsonlLog } from "../log/jsonl.js";

const ORACLE_ABI = [
  {
    type: "function",
    name: "setPrice",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "answer", type: "int256" },
    ],
    outputs: [],
  },
] as const;

const BASELINE_PRICE = 10_000_000_000n; // $100.00 (8dp)
const GAP_PRICE = 6_742_000_000n; // $67.42 → HF ≈ 1.03 on the drill position
const COLLATERAL = parseUnits("20", 18); // 20 tDRILL = $2,000 at baseline
const BORROW = parseUnits("720", 6); // → HF = 2000 × 0.55 / 720 ≈ 1.53
const SAVE_TIMEOUT_MS = 180_000;
const COOLDOWN_MS = 10 * 60_000;

export type DrillState =
  | "idle"
  | "preparing"
  | "position-open"
  | "gap"
  | "waiting-for-agent"
  | "saved"
  | "failed";

export interface DrillStep {
  name: string;
  detail: string;
  tx?: Hex;
  at: string;
}

export interface DrillStatus {
  state: DrillState;
  startedAt: string | null;
  finishedAt: string | null;
  steps: DrillStep[];
  hf?: string;
  debt?: string;
  rescueTx?: Hex;
  rationale?: string;
  error?: string;
  cooldownMsRemaining: number;
}

export interface DrillDeps {
  publicClient: PublicClient;
  vaultAddress: Address;
  oracleAddress: Address;
  usdcAddress: Address;
  drillAsset: Address;
  drillKey: Hex;
  adminKey: Hex;
  rpcUrl: string;
  log: JsonlLog;
}

export class DrillOrchestrator {
  private deps: DrillDeps;
  private drill: { account: Account; wallet: WalletClient };
  private admin: { account: Account; wallet: WalletClient };
  private running = false;
  private lastFinishedAt = 0;
  private status: DrillStatus = {
    state: "idle",
    startedAt: null,
    finishedAt: null,
    steps: [],
    cooldownMsRemaining: 0,
  };

  constructor(deps: DrillDeps) {
    this.deps = deps;
    const mk = (key: Hex) => {
      const account = privateKeyToAccount(key);
      return { account, wallet: createWalletClient({ account, transport: http(deps.rpcUrl) }) };
    };
    this.drill = mk(deps.drillKey);
    this.admin = mk(deps.adminKey);
  }

  getStatus(): DrillStatus {
    const cooldown = Math.max(0, this.lastFinishedAt + COOLDOWN_MS - Date.now());
    return { ...this.status, steps: [...this.status.steps], cooldownMsRemaining: this.running ? 0 : cooldown };
  }

  /** Start a drill. Returns false when locked out (already running / cooldown). */
  start(): boolean {
    if (this.running) return false;
    if (Date.now() - this.lastFinishedAt < COOLDOWN_MS) return false;
    this.running = true;
    this.status = {
      state: "preparing",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      steps: [],
      cooldownMsRemaining: 0,
    };
    void this.run()
      .catch(async (e) => {
        await this.restorePrice().catch(() => {});
        this.status.state = "failed";
        this.status.error = (e as Error).message;
      })
      .finally(() => {
        this.status.finishedAt = new Date().toISOString();
        this.lastFinishedAt = Date.now();
        this.running = false;
      });
    return true;
  }

  private step(name: string, detail: string, tx?: Hex): void {
    this.status.steps.push({ name, detail, tx, at: new Date().toISOString() });
  }

  private async send(
    who: { account: Account; wallet: WalletClient },
    to: Address,
    abi: readonly unknown[],
    functionName: string,
    args: readonly unknown[],
  ): Promise<Hex> {
    const hash = await who.wallet.writeContract({
      address: to,
      abi: abi as never,
      functionName: functionName as never,
      args: args as never,
      account: who.account,
      chain: null,
    });
    const rcpt = await this.deps.publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
    if (rcpt.status !== "success") throw new Error(`${functionName} reverted (${hash})`);
    return hash;
  }

  private async read<T>(functionName: string, args: readonly unknown[]): Promise<T> {
    return (await this.deps.publicClient.readContract({
      address: this.deps.vaultAddress,
      abi: vaultAbi,
      functionName: functionName as never,
      args: args as never,
    })) as T;
  }

  private async setPrice(price: bigint): Promise<Hex> {
    return this.send(this.admin, this.deps.oracleAddress, ORACLE_ABI, "setPrice", [
      this.deps.drillAsset,
      price,
    ]);
  }

  private async restorePrice(): Promise<void> {
    await this.setPrice(BASELINE_PRICE);
  }

  private fmtHf(hf: bigint): string {
    return (Number(hf) / 1e18).toFixed(2);
  }

  private async run(): Promise<void> {
    const d = this.deps;
    const me = this.drill.account.address;

    // 1. Fresh baseline price (also clears staleness on the drill asset).
    await this.setPrice(BASELINE_PRICE);
    this.step("baseline", "Drill asset priced at $100.00 (fresh oracle round)");

    // 2. Reset any leftover position from a previous drill.
    const leftoverDebt = await this.read<bigint>("debtOf", [me]);
    if (leftoverDebt > 0n) {
      const tx = await this.send(this.drill, d.vaultAddress, vaultAbi, "repay", [leftoverDebt]);
      this.step("reset", "Cleared leftover drill debt", tx);
    }
    const leftoverColl = await this.read<bigint>("collateralOf", [me, d.drillAsset]);
    if (leftoverColl > 0n) {
      const tx = await this.send(this.drill, d.vaultAddress, vaultAbi, "withdrawCollateral", [
        d.drillAsset,
        leftoverColl,
      ]);
      this.step("reset", "Withdrew leftover drill collateral", tx);
    }

    // 3. Open the position: 20 tDRILL ($2,000) collateral, borrow 720 USDC.
    const dep = await this.send(this.drill, d.vaultAddress, vaultAbi, "depositCollateral", [
      d.drillAsset,
      COLLATERAL,
    ]);
    this.step("deposit", "Deposited 20 tDRILL ($2,000) as collateral", dep);
    const bor = await this.send(this.drill, d.vaultAddress, vaultAbi, "borrow", [BORROW]);
    const hf0 = await this.read<bigint>("getHealthFactor", [me]);
    this.status.hf = this.fmtHf(hf0);
    this.status.debt = "720";
    this.status.state = "position-open";
    this.step("borrow", `Borrowed 720 USDC — health factor ${this.fmtHf(hf0)}`, bor);

    // 4. The gap: −33% overnight-style drop.
    const gapTx = await this.setPrice(GAP_PRICE);
    const hf1 = await this.read<bigint>("getHealthFactor", [me]);
    this.status.hf = this.fmtHf(hf1);
    this.status.state = "gap";
    this.step("gap", `Price gapped $100 → $67.42 (−33%). Health factor ${this.fmtHf(hf1)} — danger zone`, gapTx);

    // 5. Wait for the LIVE agent (production tick path) to auto-repay.
    this.status.state = "waiting-for-agent";
    const gapAtIso = new Date().toISOString();
    const deadline = Date.now() + SAVE_TIMEOUT_MS;
    let newDebt = BORROW;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3_000));
      newDebt = await this.read<bigint>("debtOf", [me]);
      if (newDebt < BORROW) break;
    }
    if (newDebt >= BORROW) {
      await this.restorePrice();
      this.status.state = "failed";
      this.status.error =
        "The agent did not act within the drill window — likely between ticks or the host was waking. Price restored; try again in a few minutes.";
      this.step("timeout", "No auto-repay observed in time; price restored to $100");
      return;
    }

    // 6. Saved — verify on-chain + surface the agent's own decision record.
    const hf2 = await this.read<bigint>("getHealthFactor", [me]);
    const repaid = Number(BORROW - newDebt) / 1e6;
    this.status.hf = this.fmtHf(hf2);
    this.status.debt = (Number(newDebt) / 1e6).toFixed(2);
    const entry = this.deps.log
      .tail(30)
      .reverse()
      .find(
        (a) =>
          a.kind === "auto_repay" &&
          (a.status === "confirmed" || a.status === "submitted") &&
          a.ts >= gapAtIso,
      );
    if (entry && entry.kind === "auto_repay") {
      this.status.rescueTx = entry.tx;
      this.status.rationale = entry.rationale;
    }
    this.status.state = "saved";
    this.step(
      "saved",
      `Agent auto-repaid ~${repaid.toFixed(2)} USDC from the pre-approved cap — health factor restored to ${this.fmtHf(hf2)}`,
      this.status.rescueTx,
    );

    // 7. Restore the world for the next drill.
    await this.restorePrice();
    this.step("restore", "Drill-asset price restored to $100.00");
  }
}
