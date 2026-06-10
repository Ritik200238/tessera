/**
 * Live Drill orchestrator — the judge-clickable "watch the AI save a position".
 *
 * Runs a REAL end-to-end protection drill on Arbitrum Sepolia, on an ISOLATED
 * drill-only asset (listed on-chain but absent from the app's address book, so
 * its price moves can never touch a real user's position):
 *
 *   1. stamp the drill-asset price ($100) and reset any leftover position
 *   2. deposit 20 tDRILL ($2,000) and borrow 550 USDC  → HF ≈ 2.00 (safe)
 *   3. gap the price by the JUDGE's chosen crash (−35 / −40 / −45%) → danger
 *      zone, and project the same crash on an unprotected borrower for contrast
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
const COLLATERAL = parseUnits("20", 18); // 20 tDRILL = $2,000 at baseline
const LIQ_THRESHOLD = 0.55; // tDRILL liquidation threshold (listed 40 / 55 / 5)
// Conservative borrower: HF = 2000 × 0.55 / 550 = 2.00 — safely above every
// regime's protect band (open 1.4 … weekend 1.7), so the agent never acts until
// the JUDGE gaps the price. Borrowing this against a fresh oracle round is the
// real on-chain position the live agent then rescues.
const BORROW = parseUnits("550", 6);
// Judge-authored crash sizes. Each keeps the live position in [1.0, 1.4) after
// the gap — so it is always AUTO-REPAID (rescued), never accidentally below 1.0
// where the agent would liquidate it instead — in every market regime. Dramatic
// but honest: a −45% overnight gap is extreme, and the agent still saves it.
const ALLOWED_GAP_PCT = [35, 40, 45] as const;
const DEFAULT_GAP_PCT = 40;
// The unprotected twin shown alongside: the SAME crash applied to an aggressive
// borrower (HF 1.25 ≈ max LTV) with no agent watching. Computed by this same
// deterministic engine and clearly labelled a projection — we don't liquidate a
// second real position on every public click (that would drain the rig's
// collateral + the liquidator's USDC). The live side is real on-chain; this side
// is the honest counterfactual.
const UNPROTECTED_START_HF = 1.25;
const CLOSE_FACTOR = 0.5; // 50% close factor (TDD §3.4.4)
const LIQ_BONUS = 0.05; // 5% liquidation bonus / penalty
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

export interface UnprotectedTwin {
  startHf: number;
  postHf: number;
  liquidated: boolean;
  seizedUsd: number;
  penaltyUsd: number;
}

export interface DrillStatus {
  state: DrillState;
  startedAt: string | null;
  finishedAt: string | null;
  steps: DrillStep[];
  gapPct: number;
  hf?: string;
  debt?: string;
  rescueTx?: Hex;
  rationale?: string;
  /** The same crash applied to an unprotected aggressive borrower (projection). */
  unprotected?: UnprotectedTwin;
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
  private gapPct = DEFAULT_GAP_PCT;
  private status: DrillStatus = {
    state: "idle",
    startedAt: null,
    finishedAt: null,
    steps: [],
    gapPct: DEFAULT_GAP_PCT,
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

  /**
   * Start a drill. The judge authors the crash size (one of ALLOWED_GAP_PCT);
   * an out-of-range value snaps to the default. Returns false when locked out
   * (already running / cooldown).
   */
  start(gapPct?: number): boolean {
    if (this.running) return false;
    if (Date.now() - this.lastFinishedAt < COOLDOWN_MS) return false;
    this.gapPct = (ALLOWED_GAP_PCT as readonly number[]).includes(gapPct ?? NaN)
      ? (gapPct as number)
      : DEFAULT_GAP_PCT;
    this.running = true;
    this.status = {
      state: "preparing",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      steps: [],
      gapPct: this.gapPct,
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

    // 4. The gap: the JUDGE-authored overnight-style drop.
    const g = this.gapPct;
    const gapPrice = (BASELINE_PRICE * BigInt(100 - g)) / 100n; // 8dp
    const gapUsd = (Number(gapPrice) / 1e8).toFixed(2);
    const gapTx = await this.setPrice(gapPrice);
    const hf1 = await this.read<bigint>("getHealthFactor", [me]);
    this.status.hf = this.fmtHf(hf1);
    this.status.state = "gap";
    this.step("gap", `Price gapped $100 → $${gapUsd} (−${g}%). Health factor ${this.fmtHf(hf1)} — danger zone`, gapTx);

    // The unprotected twin: the SAME crash on an aggressive (HF 1.25) borrower
    // with no agent watching. Pure projection by this same engine — labelled as
    // such in the UI; never a second live position.
    const frac = (100 - g) / 100;
    const postHf = UNPROTECTED_START_HF * frac;
    const liquidated = postHf < 1;
    // collateral $2,000 → risk-adjusted $1,100 → debt at HF 1.25 = $880.
    const unpDebt = (2000 * LIQ_THRESHOLD) / UNPROTECTED_START_HF;
    this.status.unprotected = {
      startHf: UNPROTECTED_START_HF,
      postHf: Math.round(postHf * 100) / 100,
      liquidated,
      seizedUsd: liquidated ? Math.round(unpDebt * CLOSE_FACTOR * (1 + LIQ_BONUS)) : 0,
      penaltyUsd: liquidated ? Math.round(unpDebt * CLOSE_FACTOR * LIQ_BONUS) : 0,
    };

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
