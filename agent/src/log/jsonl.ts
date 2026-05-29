/**
 * Append-only JSONL action log with daily rotation and N-day retention.
 *
 * Per TDD §4.7:
 *   - One JSON object per line, newest-last in file
 *   - File rotates daily; filename: `actions-YYYY-MM-DD.jsonl`
 *   - Last N days retained (default 7); older files unlinked on rotation
 *   - Reads via `tail(limit)` — returns newest-first across rotated files
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import type { Action } from "../types.js";

const FILE_RE = /^actions-(\d{4}-\d{2}-\d{2})\.jsonl$/;

/** Returns the YYYY-MM-DD UTC date for a given Date (or now). */
export function utcDateStr(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** JSON.stringify that converts bigints to decimal strings (defensive). */
function serialize(a: Action): string {
  return JSON.stringify(a, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
}

export class JsonlLog {
  private readonly dir: string;
  private readonly retentionDays: number;
  private currentDate: string;

  constructor(dir: string, retentionDays = 7) {
    this.dir = dir;
    this.retentionDays = retentionDays;
    mkdirSync(dir, { recursive: true });
    this.currentDate = utcDateStr();
  }

  /** Path for the active file (today's UTC date). */
  currentFile(): string {
    return join(this.dir, `actions-${this.currentDate}.jsonl`);
  }

  /** Append one action; rotates and prunes if UTC day has rolled over. */
  append(a: Action): void {
    const today = utcDateStr();
    if (today !== this.currentDate) {
      this.currentDate = today;
      this.prune();
    }
    appendFileSync(this.currentFile(), serialize(a) + "\n", "utf8");
  }

  /**
   * Deletes log files older than `retentionDays`. Public so tests + a daily
   * cron can call it explicitly.
   */
  prune(): void {
    if (!existsSync(this.dir)) return;
    const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
    for (const name of readdirSync(this.dir)) {
      const m = FILE_RE.exec(name);
      if (!m) continue;
      const fpath = join(this.dir, name);
      const mtime = statSync(fpath).mtimeMs;
      // Use both filename date AND mtime to decide; filename is authoritative.
      const fileDate = Date.parse(m[1] + "T00:00:00Z");
      if (fileDate < cutoff && mtime < cutoff) {
        try {
          unlinkSync(fpath);
        } catch {
          // best-effort
        }
      }
    }
  }

  /**
   * Return the most recent `limit` entries across all retained files,
   * newest-first. Cap enforced at 200 per TDD §4.7.
   */
  tail(limit: number): Action[] {
    const cap = Math.max(0, Math.min(limit, 200));
    if (cap === 0) return [];
    if (!existsSync(this.dir)) return [];
    const files = readdirSync(this.dir)
      .filter((n) => FILE_RE.test(n))
      .sort()
      .reverse(); // newest date first

    const out: Action[] = [];
    for (const name of files) {
      const lines = readFileSync(join(this.dir, name), "utf8").split("\n");
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (!line) continue;
        try {
          out.push(JSON.parse(line) as Action);
          if (out.length >= cap) return out;
        } catch {
          // skip malformed line
        }
      }
    }
    return out;
  }

  /** Test/internal helper to force-set the current date (simulates rollover). */
  _setCurrentDateForTests(date: string): void {
    this.currentDate = date;
  }
}
