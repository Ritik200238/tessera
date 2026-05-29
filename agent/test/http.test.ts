import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer, type BoundServer } from "../src/http/server.js";
import { JsonlLog } from "../src/log/jsonl.js";
import { AlertSnapshot } from "../src/log/alerts.js";
import { AgentDB } from "../src/db/index.js";
import { action } from "../src/log/action.js";
import type { TesseraLLM } from "../src/llm/client.js";

let dir: string;
let bound: BoundServer;
let db: AgentDB;
let log: JsonlLog;
let alerts: AlertSnapshot;

const ADMIN = "test-admin-secret-1234";

const llm: TesseraLLM = {
  available: true,
  complete: async () =>
    JSON.stringify({
      alertThreshold: "1200000000000000000",
      liquidationThreshold: "1000000000000000000",
      pollIntervalMs: 8000,
      paused: false,
      maxGasGwei: 30,
      notes: "warn earlier",
    }),
};

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "tessera-http-"));
  log = new JsonlLog(dir, 7);
  alerts = new AlertSnapshot(join(dir, "latest_alerts.json"));
  db = new AgentDB(":memory:");
  log.append(action.tick(0, 1));
  bound = await startServer(0, {
    log, alerts, db, llm,
    adminSecret: ADMIN,
    healthSource: {
      getLastTickAt: () => new Date().toISOString(),
      getErrors24h: () => 2,
      getUsersTracked: () => 5,
    },
  });
});

afterEach(async () => {
  await bound.close();
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const url = (path: string): string => `http://127.0.0.1:${bound.port}${path}`;

describe("HTTP server", () => {
  it("GET / returns service info", async () => {
    const r = await fetch(url("/"));
    expect(r.status).toBe(200);
    const j = (await r.json()) as { ok: boolean };
    expect(j.ok).toBe(true);
  });

  it("GET /health returns 200 when fresh tick", async () => {
    const r = await fetch(url("/health"));
    expect(r.status).toBe(200);
    const j = (await r.json()) as { ok: boolean; errors24h: number; usersTracked: number };
    expect(j.ok).toBe(true);
    expect(j.errors24h).toBe(2);
    expect(j.usersTracked).toBe(5);
  });

  it("GET /actions returns entries", async () => {
    const r = await fetch(url("/actions?limit=10"));
    expect(r.status).toBe(200);
    const j = (await r.json()) as { entries: unknown[] };
    expect(j.entries.length).toBeGreaterThan(0);
  });

  it("GET /actions rejects negative limit", async () => {
    const r = await fetch(url("/actions?limit=-1"));
    expect(r.status).toBe(400);
  });

  it("GET /actions caps at 200", async () => {
    for (let i = 0; i < 300; i++) log.append(action.tick(i, 0));
    const r = await fetch(url("/actions?limit=1000"));
    const j = (await r.json()) as { entries: unknown[] };
    expect(j.entries.length).toBe(200);
  });

  it("GET /alerts/latest returns alerts array", async () => {
    const r = await fetch(url("/alerts/latest"));
    expect(r.status).toBe(200);
    const j = (await r.json()) as { alerts: unknown[] };
    expect(Array.isArray(j.alerts)).toBe(true);
  });

  it("GET /metrics returns Prometheus format", async () => {
    const r = await fetch(url("/metrics"));
    expect(r.status).toBe(200);
    const body = await r.text();
    expect(body).toMatch(/# HELP/);
    expect(r.headers.get("content-type")).toMatch(/text\/plain/);
  });

  it("POST /config rejects without bearer", async () => {
    const r = await fetch(url("/config"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "warn me" }),
    });
    expect(r.status).toBe(401);
  });

  it("POST /config accepts NL text with valid bearer", async () => {
    const r = await fetch(url("/config"), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${ADMIN}` },
      body: JSON.stringify({ text: "warn me earlier" }),
    });
    expect(r.status).toBe(200);
    const j = (await r.json()) as { ok: boolean; config: { pollIntervalMs: number } };
    expect(j.ok).toBe(true);
    expect(j.config.pollIntervalMs).toBe(8000);
  });

  it("POST /config rejects bad JSON body", async () => {
    const r = await fetch(url("/config"), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${ADMIN}` },
      body: "not json",
    });
    expect(r.status).toBe(400);
  });

  it("POST /config accepts direct structured config", async () => {
    const r = await fetch(url("/config"), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${ADMIN}` },
      body: JSON.stringify({
        alertThreshold: "1100000000000000000",
        liquidationThreshold: "1000000000000000000",
        pollIntervalMs: 10000,
        paused: false,
        maxGasGwei: 50,
        notes: "default",
      }),
    });
    expect(r.status).toBe(200);
  });

  it("GET /config requires bearer", async () => {
    const r1 = await fetch(url("/config"));
    expect(r1.status).toBe(401);
    const r2 = await fetch(url("/config"), { headers: { authorization: `Bearer ${ADMIN}` } });
    expect(r2.status).toBe(200);
  });

  it("POST /config rejects wrong bearer", async () => {
    const r = await fetch(url("/config"), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer wrong-secret-xx" },
      body: JSON.stringify({ text: "x" }),
    });
    expect(r.status).toBe(401);
  });
});
