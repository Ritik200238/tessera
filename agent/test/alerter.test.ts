import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlLog } from "../src/log/jsonl.js";
import { AlertSnapshot } from "../src/log/alerts.js";
import { emitAlert } from "../src/strategy/alerter.js";
import { generateAlertCopy, templateAlertCopy } from "../src/llm/alert-copy.js";
import type { TesseraLLM } from "../src/llm/client.js";
import { classify } from "../src/strategy/health-classifier.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "tessera-alert-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const USER = "0x1111111111111111111111111111111111111111" as const;

describe("alert-copy fallback", () => {
  it("uses template when LLM unavailable", async () => {
    const llm: TesseraLLM = {
      available: false,
      complete: async () => { throw new Error("nope"); },
    };
    const copy = await generateAlertCopy(llm, {
      user: USER, hf: 1_050_000_000_000_000_000n, level: "at-risk", score: 52,
    });
    expect(copy).toContain("at risk");
    expect(copy).toContain("52");
  });

  it("uses template when LLM throws", async () => {
    const llm: TesseraLLM = {
      available: true,
      complete: async () => { throw new Error("api down"); },
    };
    const copy = await generateAlertCopy(llm, {
      user: USER, hf: 950_000_000_000_000_000n, level: "liquidating", score: 47,
    });
    expect(copy).toContain("closing");
  });

  it("uses LLM output when available", async () => {
    const llm: TesseraLLM = {
      available: true,
      complete: async () => "Markets are volatile; your position is being watched.",
    };
    const copy = await generateAlertCopy(llm, {
      user: USER, hf: 1_150_000_000_000_000_000n, level: "watch", score: 57,
    });
    expect(copy).toBe("Markets are volatile; your position is being watched.");
  });

  it("falls back when LLM returns empty string", async () => {
    const llm: TesseraLLM = { available: true, complete: async () => "" };
    const copy = await generateAlertCopy(llm, {
      user: USER, hf: 1_150_000_000_000_000_000n, level: "watch", score: 57,
    });
    expect(copy.length).toBeGreaterThan(0);
  });

  it("templateAlertCopy covers all levels", () => {
    for (const level of ["safe", "healthy", "watch", "at-risk", "liquidating"] as const) {
      expect(templateAlertCopy({ user: USER, hf: 0n, level, score: 50 })).toMatch(/Safety score/);
    }
  });
});

describe("emitAlert", () => {
  it("writes one Action line + upserts snapshot", async () => {
    const log = new JsonlLog(dir, 7);
    const alerts = new AlertSnapshot(join(dir, "latest_alerts.json"));
    const llm: TesseraLLM = { available: false, complete: async () => "x" };
    const c = classify(1_050_000_000_000_000_000n);
    const a = await emitAlert({ log, alerts, llm }, USER, c);
    expect(a.level).toBe("at-risk");
    expect(alerts.list().length).toBe(1);
    expect(log.tail(10)[0]?.kind).toBe("alert");
  });
});
