/**
 * Natural-language strategy config parser (TDD §4.6).
 *
 * Pipeline:
 *   1. User types free-form text on /agent UI
 *   2. We send it + the JSON schema to the LLM
 *   3. LLM returns JSON; we validate against `agentConfigSchema`
 *   4. Invalid -> rejected, original config unchanged
 */

import { agentConfigSchema, DEFAULT_AGENT_CONFIG } from "../config.js";
import type { AgentConfig } from "../types.js";
import type { TesseraLLM } from "./client.js";

export interface NLConfigResult {
  ok: boolean;
  config?: AgentConfig;
  error?: string;
}

const SYSTEM_PROMPT = `You translate a user's natural-language risk strategy into strict JSON.

Output schema (all keys REQUIRED, JSON only — no markdown, no commentary):
{
  "alertThreshold":       "<decimal string, 1e18-scaled, range [1000000000000000000, 2000000000000000000]>",
  "liquidationThreshold": "1000000000000000000",
  "pollIntervalMs":       <integer 1000..60000>,
  "paused":               <boolean>,
  "maxGasGwei":           <number 0..10000>,
  "notes":                "<short echo of user intent, <= 200 chars>"
}

Defaults to use when the user does not specify:
  alertThreshold = "1100000000000000000"  (HF 1.1)
  pollIntervalMs = 10000
  paused = false
  maxGasGwei = 50

Examples:
  User: "be more cautious, warn me at HF 1.3"
  -> alertThreshold = "1300000000000000000"

  User: "pause the agent for now"
  -> paused = true

Respond with ONLY the JSON object.`;

/** Extract the first balanced JSON object substring from `text`. */
function extractJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Parse a natural-language strategy string into a validated AgentConfig.
 * If the LLM is unavailable, returns `{ok: false}` — we deliberately refuse
 * to mutate config without LLM validation (vs the alert path where we
 * gracefully fall back, because here the user EXPECTS interpretation).
 */
export async function parseNLConfig(
  llm: TesseraLLM,
  userText: string,
): Promise<NLConfigResult> {
  if (!userText.trim()) return { ok: false, error: "empty input" };
  if (userText.length > 4000) return { ok: false, error: "input too long" };

  if (!llm.available) {
    return { ok: false, error: "LLM unavailable — cannot parse natural-language config" };
  }

  let raw: string;
  try {
    raw = await llm.complete(userText, { system: SYSTEM_PROMPT, maxTokens: 400 });
  } catch (e) {
    return { ok: false, error: `LLM call failed: ${(e as Error).message}` };
  }

  const jsonStr = extractJson(raw);
  if (!jsonStr) return { ok: false, error: "LLM did not return JSON" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    return { ok: false, error: `invalid JSON: ${(e as Error).message}` };
  }

  // The schema coerces strings to bigint for the two threshold fields.
  const result = agentConfigSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: `schema validation failed: ${result.error.message}` };
  }
  return { ok: true, config: result.data };
}

export { DEFAULT_AGENT_CONFIG };
