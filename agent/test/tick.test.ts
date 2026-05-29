import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Address, Hex } from "viem";
import { runTick } from "../src/strategy/tick.js";
import { JsonlLog } from "../src/log/jsonl.js";
import { AlertSnapshot } from "../src/log/alerts.js";
import { AgentDB } from "../src/db/index.js";
import { DEFAULT_AGENT_CONFIG } from "../src/config.js";
import type { TesseraLLM } from "../src/llm/client.js";

const VAULT = "0xcccccccccccccccccccccccccccccccccccccccc" as Address;
const USER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
const TX_HASH = ("0x" + "1".repeat(64)) as Hex;

let dir: string;
let db: AgentDB;
let log: JsonlLog;
let alerts: AlertSnapshot;
const llm: TesseraLLM = { available: false, complete: async () => { throw new Error("nope"); } };

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tessera-tick-"));
  log = new JsonlLog(dir, 7);
  alerts = new AlertSnapshot(join(dir, "latest_alerts.json"));
  db = new AgentDB(":memory:");
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

function makeMockClient(hfByUser: Map<Address, bigint>, debtByUser?: Map<Address, bigint>) {
  return {
    getBlockNumber: async () => 100n,
    getGasPrice: async () => 1_000_000_000n,
    readContract: async (args: { functionName: string; args?: unknown[] }) => {
      // Collateral discovery (used by the liquidation path): one listed asset
      // that the borrower holds a non-zero balance in.
      if (args.functionName === "listedAssetCount") return 1n;
      if (args.functionName === "listedAssetAt") return "0xdddddddddddddddddddddddddddddddddddddddd" as Address;
      if (args.functionName === "collateralOf") return 1_000_000_000_000_000_000n;
      const u = (args.args?.[0] as string).toLowerCase() as Address;
      if (args.functionName === "getHealthFactor") return hfByUser.get(u) ?? 2_000_000_000_000_000_000n;
      if (args.functionName === "debtOf") return debtByUser?.get(u) ?? 0n;
      return 0n;
    },
    simulateContract: async () => ({ result: 100n }),
  };
}

describe("runTick", () => {
  it("skips work when paused", async () => {
    const result = await runTick({
      publicClient: makeMockClient(new Map()) as never,
      vaultAddress: VAULT,
      getTrackedUsers: async () => [USER],
      alerter: { llm, log, alerts },
      liquidator: {
        publicClient: makeMockClient(new Map()) as never,
        walletClient: { writeContract: async () => TX_HASH } as never,
        account: { address: USER } as never,
        vaultAddress: VAULT,
        getUsdcBalance: async () => 0n,
        log, db, maxGasGwei: 50,
      },
      log,
      config: { ...DEFAULT_AGENT_CONFIG, paused: true },
    });
    expect(result.usersChecked).toBe(0);
  });

  it("alerts user with HF below alertThreshold", async () => {
    const pub = makeMockClient(new Map([[USER, 1_050_000_000_000_000_000n]]));
    const result = await runTick({
      publicClient: pub as never,
      vaultAddress: VAULT,
      getTrackedUsers: async () => [USER],
      alerter: { llm, log, alerts },
      liquidator: {
        publicClient: pub as never,
        walletClient: { writeContract: async () => TX_HASH } as never,
        account: { address: USER } as never,
        vaultAddress: VAULT,
        getUsdcBalance: async () => 0n,
        log, db, maxGasGwei: 50,
      },
      log,
      config: { ...DEFAULT_AGENT_CONFIG },
    });
    expect(result.alerted).toBe(1);
    expect(alerts.list().length).toBe(1);
  });

  it("does not alert safe users", async () => {
    const pub = makeMockClient(new Map([[USER, 2_000_000_000_000_000_000n]]));
    const result = await runTick({
      publicClient: pub as never,
      vaultAddress: VAULT,
      getTrackedUsers: async () => [USER],
      alerter: { llm, log, alerts },
      liquidator: {
        publicClient: pub as never,
        walletClient: { writeContract: async () => TX_HASH } as never,
        account: { address: USER } as never,
        vaultAddress: VAULT,
        getUsdcBalance: async () => 0n,
        log, db, maxGasGwei: 50,
      },
      log,
      config: { ...DEFAULT_AGENT_CONFIG },
    });
    expect(result.alerted).toBe(0);
  });

  it("attempts liquidation when HF < 1e18", async () => {
    const pub = makeMockClient(
      new Map([[USER, 900_000_000_000_000_000n]]),
      new Map([[USER, 1_000n]]),
    );
    const result = await runTick({
      publicClient: pub as never,
      vaultAddress: VAULT,
      getTrackedUsers: async () => [USER],
      alerter: { llm, log, alerts },
      liquidator: {
        publicClient: pub as never,
        walletClient: { writeContract: async () => TX_HASH } as never,
        account: { address: USER } as never,
        vaultAddress: VAULT,
        getUsdcBalance: async () => 10_000n,
        log, db, maxGasGwei: 50,
      },
      log,
      config: { ...DEFAULT_AGENT_CONFIG },
    });
    expect(result.liquidated).toBe(1);
  });

  it("recovers when getBlockNumber throws", async () => {
    const pub = {
      ...makeMockClient(new Map()),
      getBlockNumber: async () => { throw new Error("rpc down"); },
    };
    const result = await runTick({
      publicClient: pub as never,
      vaultAddress: VAULT,
      getTrackedUsers: async () => [USER],
      alerter: { llm, log, alerts },
      liquidator: {
        publicClient: pub as never,
        walletClient: { writeContract: async () => TX_HASH } as never,
        account: { address: USER } as never,
        vaultAddress: VAULT,
        getUsdcBalance: async () => 0n,
        log, db, maxGasGwei: 50,
      },
      log,
      config: { ...DEFAULT_AGENT_CONFIG },
    });
    expect(result.usersChecked).toBe(0);
    const entries = log.tail(10);
    expect(entries.some((e) => e.kind === "error")).toBe(true);
  });
});
