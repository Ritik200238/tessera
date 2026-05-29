import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readdirSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlLog, utcDateStr } from "../src/log/jsonl.js";
import { action } from "../src/log/action.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "tessera-jsonl-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe("JsonlLog", () => {
  it("appends entries and tails newest-first", () => {
    const log = new JsonlLog(dir, 7);
    for (let i = 0; i < 1000; i++) log.append(action.tick(i, i));
    const last50 = log.tail(50);
    expect(last50.length).toBe(50);
    // newest first: usersChecked descending
    expect((last50[0] as { usersChecked: number }).usersChecked).toBe(999);
    expect((last50[49] as { usersChecked: number }).usersChecked).toBe(950);
  });

  it("caps tail() at 200", () => {
    const log = new JsonlLog(dir, 7);
    for (let i = 0; i < 500; i++) log.append(action.tick(i, 0));
    expect(log.tail(1000).length).toBe(200);
  });

  it("returns empty on empty dir", () => {
    const log = new JsonlLog(dir, 7);
    expect(log.tail(50)).toEqual([]);
  });

  it("rotates by UTC day (creates new file when date rolls over)", () => {
    const log = new JsonlLog(dir, 7);
    // Force the log to think "yesterday" is its current file
    log._setCurrentDateForTests("1999-01-01");
    // Append — should detect rollover and write to today's file
    log.append(action.tick(1, 1));
    const files = readdirSync(dir);
    const today = utcDateStr();
    expect(files.some((f) => f.includes(today))).toBe(true);
    // The "old" 1999 file should NOT have been created (we never wrote to it)
    expect(files.some((f) => f.includes("1999-01-01"))).toBe(false);
  });

  it("prunes files older than retention window", () => {
    const log = new JsonlLog(dir, 7);
    // Create a fake old file
    const oldPath = join(dir, "actions-2000-01-01.jsonl");
    writeFileSync(oldPath, '{"ts":"2000-01-01T00:00:00.000Z","kind":"tick","usersChecked":0,"durationMs":0}\n');
    const old = new Date("2000-01-01T00:00:00Z");
    utimesSync(oldPath, old, old);
    log.prune();
    const files = readdirSync(dir);
    expect(files.includes("actions-2000-01-01.jsonl")).toBe(false);
  });
});
