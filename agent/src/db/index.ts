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

  /** Records a liquidation attempt; returns false if (user, block) already seen. */
  recordIdempotency(user: string, blockNumber: number, status: string): boolean {
    const res = this.db
      .prepare(
        "INSERT OR IGNORE INTO idempotency (user, block_number, status) VALUES (?, ?, ?)",
      )
      .run(user.toLowerCase(), blockNumber, status);
    return res.changes > 0;
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

  close(): void {
    this.db.close();
  }
}
