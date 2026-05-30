/**
 * Environment-driven runtime configuration. This is the ONE module allowed
 * to read `process.env`. See TDD §20 (Configuration & Secrets).
 */

import "dotenv/config";
import { z } from "zod";
import type { AgentConfig } from "./types.js";

const ONE_E18 = 1_000_000_000_000_000_000n;
const ALERT_DEFAULT = 1_100_000_000_000_000_000n; // 1.1e18

/** Zod schema for the persisted (JSON) AgentConfig (TDD §4.6). */
export const agentConfigSchema = z
  .object({
    alertThreshold: z.coerce.bigint().min(ONE_E18).max(2n * ONE_E18),
    liquidationThreshold: z.coerce.bigint().min(ONE_E18).max(ONE_E18),
    pollIntervalMs: z.number().int().min(1_000).max(60_000),
    paused: z.boolean(),
    maxGasGwei: z.number().positive().max(10_000),
    notes: z.string().max(2_000),
  })
  .strict();

export const DEFAULT_AGENT_CONFIG: AgentConfig = Object.freeze({
  alertThreshold: ALERT_DEFAULT,
  liquidationThreshold: ONE_E18,
  pollIntervalMs: 10_000,
  paused: false,
  maxGasGwei: 50,
  notes: "default — set via /agent UI",
});

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Network
  RPC_URL: z.string().url().default("http://127.0.0.1:8545"),
  CHAIN_ID: z.coerce.number().int().positive().default(412346),
  VAULT_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .default("0x0000000000000000000000000000000000000000"),
  // USDC (the debt asset) — the liquidator reads its own balance here before
  // attempting a liquidation. Sourced from shared/addresses/<env>.json.
  USDC_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .default("0x0000000000000000000000000000000000000000"),

  // Agent
  AGENT_PRIVATE_KEY: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .default("0x" + "1".repeat(64)),
  AGENT_POLL_INTERVAL_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
  AGENT_LOG_DIR: z.string().default("./logs"),
  AGENT_DB_PATH: z.string().default("./.data/state.sqlite"),
  AGENT_HTTP_PORT: z.coerce.number().int().min(1).max(65_535).default(8787),
  AGENT_ADMIN_SECRET: z.string().min(8).default("dev-admin-secret-change-me"),
  AGENT_LOG_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(7),

  // User discovery (event indexer). Public RPCs are non-archive and cap getLogs
  // ranges, so the indexer scans in bounded chunks from a recent lookback window
  // (or AGENT_START_BLOCK) and persists progress. Known borrowers can be pinned
  // so they are watched immediately, independent of log retention.
  AGENT_TRACKED_USERS: z.string().default(""), // comma-separated addresses to always watch
  AGENT_START_BLOCK: z.coerce.number().int().min(0).default(0), // 0 => use lookback
  AGENT_LOG_LOOKBACK: z.coerce.number().int().min(0).default(50_000), // blocks back on a cold start
  AGENT_LOG_CHUNK: z.coerce.number().int().min(100).max(50_000).default(9_000), // per-getLogs span

  // LLM — open models on NVIDIA NIM are primary; Anthropic Claude is the fallback.
  // NIM endpoints cold-start, so we ship an ordered chain and bound each attempt.
  // Reliability-first order: Llama 3.3 70B and Qwen 3.5 answer in ~2s; Kimi K2.6
  // is kept last (Moonshot's current model, but frequently cold on NIM).
  NVIDIA_API_KEY: z.string().optional(),
  NVIDIA_BASE_URL: z.string().url().default("https://integrate.api.nvidia.com/v1"),
  NIM_MODELS: z
    .string()
    .default("meta/llama-3.3-70b-instruct,qwen/qwen3.5-122b-a10b,moonshotai/kimi-k2.6"),
  NIM_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(12_000),
  ANTHROPIC_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default("claude-haiku-4-5"),

  // Observability
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type RuntimeConfig = z.infer<typeof envSchema> & {
  defaultAgentConfig: AgentConfig;
};

let cached: RuntimeConfig | null = null;

/**
 * Parses and caches the environment-derived runtime config. Throws on
 * validation failure; the agent process must not start with an invalid env.
 */
export function loadConfig(): RuntimeConfig {
  if (cached) return cached;
  const parsed = envSchema.parse(process.env);
  cached = { ...parsed, defaultAgentConfig: DEFAULT_AGENT_CONFIG };
  return cached;
}

/** Test-only helper. Clears the memoised config so tests can re-load env. */
export function _resetConfigForTests(): void {
  cached = null;
}
