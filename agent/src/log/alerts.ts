/**
 * Rolling "latest alerts" snapshot persisted to a single JSON file so the
 * `/agent` UI can read open alerts in one fetch (TDD §4.7).
 *
 * Memory is the source of truth; disk is a crash-survival mirror.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Address } from "viem";
import type { LatestAlert } from "../types.js";

export class AlertSnapshot {
  private readonly path: string;
  private state = new Map<string, LatestAlert>();

  constructor(path: string) {
    this.path = path;
    mkdirSync(dirname(path), { recursive: true });
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (!existsSync(this.path)) return;
    try {
      const raw = JSON.parse(readFileSync(this.path, "utf8")) as LatestAlert[];
      for (const a of raw) this.state.set(a.user.toLowerCase(), a);
    } catch {
      // corrupt file — start fresh
    }
  }

  private flush(): void {
    writeFileSync(this.path, JSON.stringify(this.list(), null, 2), "utf8");
  }

  /** Add or update an open alert for `user`. */
  upsert(alert: LatestAlert): void {
    this.state.set(alert.user.toLowerCase(), alert);
    this.flush();
  }

  /** Remove an alert (e.g. user recovered or was liquidated). */
  clear(user: Address): void {
    if (this.state.delete(user.toLowerCase())) this.flush();
  }

  /** Snapshot of currently-open alerts, ordered by ascending HF. */
  list(): LatestAlert[] {
    return [...this.state.values()].sort((a, b) => {
      const ah = BigInt(a.hf);
      const bh = BigInt(b.hf);
      if (ah < bh) return -1;
      if (ah > bh) return 1;
      return 0;
    });
  }
}
