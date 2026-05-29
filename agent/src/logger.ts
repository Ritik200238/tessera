/**
 * Centralized pino logger. Production code MUST import from here rather than
 * calling `console.*` directly (enforced by ESLint `no-console`).
 */

import pino, { type Logger } from "pino";
import { loadConfig } from "./config.js";

let cached: Logger | null = null;

export function getLogger(): Logger {
  if (cached) return cached;
  const cfg = loadConfig();
  cached = pino({
    level: cfg.LOG_LEVEL,
    base: { service: "tessera-agent" },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
  return cached;
}
