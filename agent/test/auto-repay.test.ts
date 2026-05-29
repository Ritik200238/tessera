import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Address, Hex } from "viem";
import { tryAutoRepay, type AutoRepayDeps } from "../src/strategy/auto-repay.js";
import { JsonlLog } from "../src/log/jsonl.js";
import { AgentDB } from "../src/db/index.js";

const VAULT = "0xcccccccccccccccccccccccccccccccccccccccc" as Address;
const USDC = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as Address;
const USER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const AGENT = "0x7dfe429056abb84b7cd4a1852f12e7416bea9ee9" as Address;
const TX = ("0x" + "2".repeat(64)) as Hex;
const AT_RISK_HF = 1_100_000_000_000_000_000n;

let dir: string;
let db: AgentDB;
let log: JsonlLog;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tessera-ar-"));
  log = new JsonlLog(dir, 7);
  db = new AgentDB(":memory:");
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

interface Opts {
  allowance?: bigint;
  balance?: bigint;
  gasPrice?: bigint;
  simulateThrows?: boolean;
}
function makeDeps(o: Opts = {}): AutoRepayDeps {
  return {
    publicClient: {
      getGasPrice: async () => o.gasPrice ?? 1_000_000_000n,
      readContract: async (a: { functionName: string }) => {
        if (a.functionName === "allowance") return o.allowance ?? 0n;
        if (a.functionName === "balanceOf") return o.balance ?? 0n;
        return 0n;
      },
      simulateContract: async () => {
        if (o.simulateThrows) throw new Error("execution reverted");
        return { result: 0n };
      },
    } as never,
    walletClient: { writeContract: async () => TX } as never,
    account: { address: AGENT } as never,
    vaultAddress: VAULT,
    usdcAddress: USDC,
    log,
    db,
    maxGasGwei: 50,
  };
}

describe("tryAutoRepay", () => {
  it("skips when the user has not opted in (zero allowance)", async () => {
    const r = await tryAutoRepay(
      makeDeps({ allowance: 0n, balance: 10_000n }),
      { user: USER, repayAmount: 1_000n, hfBefore: AT_RISK_HF },
      1,
    );
    expect(r.kind).toBe("skipped");
  });

  it("caps the repay to the user's allowance (the spending cap)", async () => {
    const r = await tryAutoRepay(
      makeDeps({ allowance: 500n, balance: 10_000n }),
      { user: USER, repayAmount: 2_000n, hfBefore: AT_RISK_HF },
      2,
    );
    expect(r.kind).toBe("submitted");
    if (r.kind === "submitted") expect(r.repaid).toBe(500n);
  });

  it("caps the repay to the user's balance", async () => {
    const r = await tryAutoRepay(
      makeDeps({ allowance: 5_000n, balance: 300n }),
      { user: USER, repayAmount: 2_000n, hfBefore: AT_RISK_HF },
      3,
    );
    expect(r.kind).toBe("submitted");
    if (r.kind === "submitted") expect(r.repaid).toBe(300n);
  });

  it("skips when gas price exceeds the cap", async () => {
    const r = await tryAutoRepay(
      makeDeps({ allowance: 5_000n, balance: 10_000n, gasPrice: 999_000_000_000n }),
      { user: USER, repayAmount: 1_000n, hfBefore: AT_RISK_HF },
      4,
    );
    expect(r.kind).toBe("skipped");
  });

  it("reports reverted when the simulation fails", async () => {
    const r = await tryAutoRepay(
      makeDeps({ allowance: 5_000n, balance: 10_000n, simulateThrows: true }),
      { user: USER, repayAmount: 1_000n, hfBefore: AT_RISK_HF },
      5,
    );
    expect(r.kind).toBe("reverted");
  });

  it("submits when budget and simulation are OK", async () => {
    const r = await tryAutoRepay(
      makeDeps({ allowance: 5_000n, balance: 10_000n }),
      { user: USER, repayAmount: 1_000n, hfBefore: AT_RISK_HF },
      6,
    );
    expect(r.kind).toBe("submitted");
    if (r.kind === "submitted") expect(r.repaid).toBe(1_000n);
  });

  it("is idempotent within a block (no double-repay)", async () => {
    const d = makeDeps({ allowance: 5_000n, balance: 10_000n });
    const first = await tryAutoRepay(d, { user: USER, repayAmount: 1_000n, hfBefore: AT_RISK_HF }, 7);
    const second = await tryAutoRepay(d, { user: USER, repayAmount: 1_000n, hfBefore: AT_RISK_HF }, 7);
    expect(first.kind).toBe("submitted");
    expect(second.kind).toBe("skipped");
  });
});
