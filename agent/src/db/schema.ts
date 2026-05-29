/**
 * SQLite schema + migrations for the agent's local state (TDD §4.3, §4.6).
 *
 * Tables:
 *   - `checkpoint`     — last block we indexed events up to (single row)
 *   - `idempotency`    — (user, block) tuples to prevent double-liquidation
 *   - `agent_config`   — single-row JSON-encoded AgentConfig
 */

export const MIGRATIONS: readonly string[] = Object.freeze([
  // 001 — initial schema
  `
  CREATE TABLE IF NOT EXISTS checkpoint (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    block_number INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  INSERT OR IGNORE INTO checkpoint (id, block_number) VALUES (1, 0);

  CREATE TABLE IF NOT EXISTS idempotency (
    user TEXT NOT NULL,
    block_number INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user, block_number)
  );

  CREATE TABLE IF NOT EXISTS agent_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    config_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `,
]);
