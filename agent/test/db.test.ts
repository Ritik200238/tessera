import { describe, it, expect } from "vitest";
import { AgentDB } from "../src/db/index.js";
import { DEFAULT_AGENT_CONFIG } from "../src/config.js";

describe("AgentDB", () => {
  it("starts with checkpoint=0", () => {
    const db = new AgentDB(":memory:");
    expect(db.getCheckpoint()).toBe(0);
    db.close();
  });

  it("persists checkpoint", () => {
    const db = new AgentDB(":memory:");
    db.setCheckpoint(42);
    expect(db.getCheckpoint()).toBe(42);
    db.setCheckpoint(100);
    expect(db.getCheckpoint()).toBe(100);
    db.close();
  });

  it("idempotency: second insert returns false", () => {
    const db = new AgentDB(":memory:");
    expect(db.recordIdempotency("0xabc", 1, "attempt")).toBe(true);
    expect(db.recordIdempotency("0xabc", 1, "attempt")).toBe(false);
    expect(db.recordIdempotency("0xabc", 2, "attempt")).toBe(true);
    db.close();
  });

  it("returns defaults when no config persisted", () => {
    const db = new AgentDB(":memory:");
    const cfg = db.getAgentConfig();
    expect(cfg.alertThreshold).toBe(DEFAULT_AGENT_CONFIG.alertThreshold);
    db.close();
  });

  it("round-trips AgentConfig", () => {
    const db = new AgentDB(":memory:");
    db.setAgentConfig({
      alertThreshold: 1_200_000_000_000_000_000n,
      liquidationThreshold: 1_000_000_000_000_000_000n,
      pollIntervalMs: 5000,
      paused: true,
      maxGasGwei: 20,
      notes: "test",
    });
    const cfg = db.getAgentConfig();
    expect(cfg.alertThreshold).toBe(1_200_000_000_000_000_000n);
    expect(cfg.pollIntervalMs).toBe(5000);
    expect(cfg.paused).toBe(true);
    db.close();
  });
});
