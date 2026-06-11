/**
 * better-sqlite3 connection + migration runner + typed accessors.
 */

import Database, { type Database as SQLiteDB } from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { MIGRATIONS } from "./schema.js";
import { DEFAULT_AGENT_CONFIG, agentConfigSchema } from "../config.js";
import type { AgentConfig } from "../types.js";

export interface IdempotencyRow {
  user: string;
  blockNumber: number;
  status: string;
}

/**
 * Wraps the SQLite handle with typed helpers. All migrations run on
 * construction; safe to call repeatedly (IF NOT EXISTS).
 */
export class AgentDB {
  private readonly db: SQLiteDB;

  constructor(path: string) {
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true });
    }
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  private migrate(): void {
    const tx = this.db.transaction(() => {
      for (let i = 0; i < MIGRATIONS.length; i++) {
        const version = i + 1;
        const already = this.db
          .prepare("SELECT version FROM schema_version WHERE version = ?")
          .get(version) as { version: number } | undefined;
        if (already) continue;
        this.db.exec(MIGRATIONS[i]!);
        // schema_version table may not exist until first migration runs; idempotent insert
        this.db
          .prepare("INSERT OR IGNORE INTO schema_version (version) VALUES (?)")
          .run(version);
      }
    });
    // Bootstrap: ensure schema_version row presence for migration 1
    try {
      this.db.exec(MIGRATIONS[0]!);
    } catch {
      // tables already exist — fine
    }
    try {
      tx();
    } catch {
      // schema_version was created by the bootstrap above
    }
  }

  /** Returns the last indexed block number (0 if never set). */
  getCheckpoint(): number {
    const row = this.db
      .prepare("SELECT block_number AS blockNumber FROM checkpoint WHERE id = 1")
      .get() as { blockNumber: number } | undefined;
    return row?.blockNumber ?? 0;
  }

  /** Persists the latest indexed block number. */
  setCheckpoint(blockNumber: number): void {
    this.db
      .prepare(
        "INSERT INTO checkpoint (id, block_number, updated_at) VALUES (1, ?, datetime('now')) " +
          "ON CONFLICT(id) DO UPDATE SET block_number = excluded.block_number, updated_at = excluded.updated_at",
      )
      .run(blockNumber);
  }

  /** Records a money-moving action; returns false if (user, block) already seen. */
  recordIdempotency(user: string, blockNumber: number, status: string): boolean {
    const res = this.db
      .prepare(
        "INSERT OR IGNORE INTO idempotency (user, block_number, status) VALUES (?, ?, ?)",
      )
      .run(user.toLowerCase(), blockNumber, status);
    return res.changes > 0;
  }

  /** Read-only: has a money-moving action already been recorded for (user, block)?
   *  Used as the per-block dedupe guard so transient pre-submit failures (RPC/gas/
   *  balance) do NOT burn the block — only a *broadcast* tx records idempotency. */
  hasIdempotency(user: string, blockNumber: number): boolean {
    const row = this.db
      .prepare("SELECT 1 FROM idempotency WHERE user = ? AND block_number = ?")
      .get(user.toLowerCase(), blockNumber);
    return row !== undefined;
  }

  /** Record a discovered borrower (active by default). Re-activates if seen again. */
  upsertBorrower(user: string, block: number): void {
    this.db
      .prepare(
        "INSERT INTO borrowers (user, first_seen_block, active) VALUES (?, ?, 1) " +
          "ON CONFLICT(user) DO UPDATE SET active = 1, updated_at = datetime('now')",
      )
      .run(user.toLowerCase(), block);
  }

  /** Flip a borrower active/inactive (a tick sets inactive once debt hits zero). */
  setBorrowerActive(user: string, active: boolean): void {
    this.db
      .prepare("UPDATE borrowers SET active = ?, updated_at = datetime('now') WHERE user = ?")
      .run(active ? 1 : 0, user.toLowerCase());
  }

  /** All borrowers currently believed to carry debt. */
  getActiveBorrowers(): string[] {
    return (this.db.prepare("SELECT user FROM borrowers WHERE active = 1").all() as { user: string }[]).map(
      (r) => r.user,
    );
  }

  /** True once at least one borrower has ever been recorded (for cold-start backfill). */
  hasAnyBorrower(): boolean {
    return this.db.prepare("SELECT 1 FROM borrowers LIMIT 1").get() !== undefined;
  }

  /** Loads persisted AgentConfig or returns defaults. */
  getAgentConfig(): AgentConfig {
    const row = this.db
      .prepare("SELECT config_json FROM agent_config WHERE id = 1")
      .get() as { config_json: string } | undefined;
    if (!row) return { ...DEFAULT_AGENT_CONFIG };
    try {
      const raw = JSON.parse(row.config_json) as Record<string, unknown>;
      // Stored values for bigint thresholds come back as strings; coerce.
      const parsed = agentConfigSchema.parse(raw);
      return parsed;
    } catch {
      return { ...DEFAULT_AGENT_CONFIG };
    }
  }

  /** Persists a validated AgentConfig. Caller must have already validated. */
  setAgentConfig(cfg: AgentConfig): void {
    const json = JSON.stringify({
      ...cfg,
      alertThreshold: cfg.alertThreshold.toString(),
      liquidationThreshold: cfg.liquidationThreshold.toString(),
    });
    this.db
      .prepare(
        "INSERT INTO agent_config (id, config_json, updated_at) VALUES (1, ?, datetime('now')) " +
          "ON CONFLICT(id) DO UPDATE SET config_json = excluded.config_json, updated_at = excluded.updated_at",
      )
      .run(json);
  }

  /** Records an early-access signup. Returns false if the email is already on the list. */
  addToWaitlist(email: string, source: string): boolean {
    const res = this.db
      .prepare("INSERT OR IGNORE INTO waitlist (email, source) VALUES (?, ?)")
      .run(email.trim().toLowerCase(), source);
    return res.changes > 0;
  }

  /** Public count of early-access signups. */
  waitlistCount(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS n FROM waitlist").get() as { n: number };
    return row.n;
  }

  close(): void {
    this.db.close();
  }
}
