import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseGwei, type Address, type Hex } from "viem";
import { tryLiquidate, type LiquidatorDeps } from "../src/strategy/liquidator.js";
import { JsonlLog } from "../src/log/jsonl.js";
import { AgentDB } from "../src/db/index.js";

const USER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const TOKEN = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Address;
const VAULT = "0xcccccccccccccccccccccccccccccccccccccccc" as Address;
const TX_HASH = ("0x" + "1".repeat(64)) as Hex;

let dir: string;
let log: JsonlLog;
let db: AgentDB;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tessera-liq-"));
  log = new JsonlLog(dir, 7);
  db = new AgentDB(":memory:");
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

function makeDeps(overrides: Partial<LiquidatorDeps> = {}): LiquidatorDeps {
  const publicClient = {
    simulateContract: async () => ({ result: 12345n }),
    getGasPrice: async () => parseGwei("1"),
  } as unknown as LiquidatorDeps["publicClient"];
  const walletClient = {
    writeContract: async () => TX_HASH,
  } as unknown as LiquidatorDeps["walletClient"];
  const account = { address: "0xdddddddddddddddddddddddddddddddddddddddd" } as unknown as LiquidatorDeps["account"];
  return {
    publicClient,
    walletClient,
    account,
    vaultAddress: VAULT,
    getUsdcBalance: async () => 1_000_000_000_000n,
    log,
    db,
    maxGasGwei: 50,
    ...overrides,
  };
}

describe("tryLiquidate", () => {
  it("submits when simulation passes", async () => {
    const r = await tryLiquidate(makeDeps(), { borrower: USER, repayAmount: 100n, collateralToken: TOKEN }, 1);
    expect(r.kind).toBe("submitted");
    if (r.kind === "submitted") {
      expect(r.tx).toBe(TX_HASH);
      expect(r.seizedEstimate).toBe(12345n);
    }
  });

  it("skips on simulation revert", async () => {
    const publicClient = {
      simulateContract: async () => { throw new Error("HF >= 1 now"); },
      getGasPrice: async () => parseGwei("1"),
    } as unknown as LiquidatorDeps["publicClient"];
    const r = await tryLiquidate(makeDeps({ publicClient }), { borrower: USER, repayAmount: 100n, collateralToken: TOKEN }, 2);
    expect(r.kind).toBe("reverted");
  });

  it("skips on insufficient USDC", async () => {
    const r = await tryLiquidate(
      makeDeps({ getUsdcBalance: async () => 10n }),
      { borrower: USER, repayAmount: 1_000n, collateralToken: TOKEN }, 3,
    );
    expect(r.kind).toBe("skipped");
    if (r.kind === "skipped") expect(r.reason).toMatch(/insufficient USDC/);
  });

  it("skips when gas price exceeds cap", async () => {
    const publicClient = {
      simulateContract: async () => ({ result: 1n }),
      getGasPrice: async () => parseGwei("9999"),
    } as unknown as LiquidatorDeps["publicClient"];
    const r = await tryLiquidate(
      makeDeps({ publicClient, maxGasGwei: 50 }),
      { borrower: USER, repayAmount: 100n, collateralToken: TOKEN }, 4,
    );
    expect(r.kind).toBe("skipped");
    if (r.kind === "skipped") expect(r.reason).toMatch(/gas/);
  });

  it("is idempotent per (user, block)", async () => {
    const deps = makeDeps();
    const r1 = await tryLiquidate(deps, { borrower: USER, repayAmount: 100n, collateralToken: TOKEN }, 99);
    const r2 = await tryLiquidate(deps, { borrower: USER, repayAmount: 100n, collateralToken: TOKEN }, 99);
    expect(r1.kind).toBe("submitted");
    expect(r2.kind).toBe("skipped");
    if (r2.kind === "skipped") expect(r2.reason).toMatch(/already attempted/);
  });
});
