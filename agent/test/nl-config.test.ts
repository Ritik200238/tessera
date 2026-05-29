import { describe, it, expect } from "vitest";
import { parseNLConfig } from "../src/llm/nl-config.js";
import type { TesseraLLM } from "../src/llm/client.js";

const VALID = JSON.stringify({
  alertThreshold: "1300000000000000000",
  liquidationThreshold: "1000000000000000000",
  pollIntervalMs: 5000,
  paused: false,
  maxGasGwei: 75,
  notes: "be more cautious",
});

describe("parseNLConfig", () => {
  it("returns config on valid LLM JSON", async () => {
    const llm: TesseraLLM = { available: true, complete: async () => VALID };
    const r = await parseNLConfig(llm, "warn me at HF 1.3");
    expect(r.ok).toBe(true);
    expect(r.config?.alertThreshold).toBe(1_300_000_000_000_000_000n);
    expect(r.config?.pollIntervalMs).toBe(5000);
  });

  it("extracts JSON when LLM wraps it in prose", async () => {
    const llm: TesseraLLM = {
      available: true,
      complete: async () => `Here you go: ${VALID} hope this helps`,
    };
    const r = await parseNLConfig(llm, "x");
    expect(r.ok).toBe(true);
  });

  it("rejects invalid JSON", async () => {
    const llm: TesseraLLM = { available: true, complete: async () => "not json at all" };
    const r = await parseNLConfig(llm, "x");
    expect(r.ok).toBe(false);
  });

  it("rejects out-of-range alertThreshold", async () => {
    const bad = JSON.stringify({
      alertThreshold: "500000000000000000",
      liquidationThreshold: "1000000000000000000",
      pollIntervalMs: 5000, paused: false, maxGasGwei: 75, notes: "",
    });
    const llm: TesseraLLM = { available: true, complete: async () => bad };
    const r = await parseNLConfig(llm, "x");
    expect(r.ok).toBe(false);
  });

  it("rejects empty user input", async () => {
    const llm: TesseraLLM = { available: true, complete: async () => VALID };
    expect((await parseNLConfig(llm, "")).ok).toBe(false);
  });

  it("rejects oversized input", async () => {
    const llm: TesseraLLM = { available: true, complete: async () => VALID };
    expect((await parseNLConfig(llm, "x".repeat(5000))).ok).toBe(false);
  });

  it("fails when LLM unavailable", async () => {
    const llm: TesseraLLM = { available: false, complete: async () => { throw new Error("no"); } };
    const r = await parseNLConfig(llm, "warn me");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/LLM unavailable/);
  });

  it("propagates LLM call errors", async () => {
    const llm: TesseraLLM = { available: true, complete: async () => { throw new Error("rate-limit"); } };
    const r = await parseNLConfig(llm, "x");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/rate-limit/);
  });

  it("rejects when LLM returns no JSON object", async () => {
    const llm: TesseraLLM = { available: true, complete: async () => "no braces here" };
    const r = await parseNLConfig(llm, "x");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/did not return JSON/);
  });
});
