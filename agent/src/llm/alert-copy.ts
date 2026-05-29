/**
 * Generate human-readable alert copy from rule facts.
 *
 * Path A (preferred): LLM rewrite of structured JSON.
 * Path B (fallback): deterministic template — MUST always work, even with
 * no LLM key, no network, no Anthropic dependency. This is TDD §4.4's
 * "graceful degradation" requirement made explicit.
 */

import type { Address } from "viem";
import type { AlertLevel } from "../types.js";
import type { TesseraLLM } from "./client.js";

export interface AlertFacts {
  user: Address;
  hf: bigint;
  level: AlertLevel;
  score: number;
  /** Optional context the operator wants surfaced (e.g. "AAPL -18% in 1h"). */
  context?: string;
}

/** Deterministic, jargon-light alert copy used as both fallback and prompt input. */
export function templateAlertCopy(f: AlertFacts): string {
  const ctx = f.context ? ` (${f.context})` : "";
  switch (f.level) {
    case "liquidating":
      return `Tessera is closing your position to protect lenders. Safety score ${f.score}/100${ctx}.`;
    case "at-risk":
      return `Your position is at risk${ctx}. Add collateral or repay to avoid liquidation. Safety score ${f.score}/100.`;
    case "watch":
      return `Markets are moving${ctx}. Tessera is monitoring your position closely. Safety score ${f.score}/100.`;
    case "healthy":
      return `Your position has a comfortable buffer${ctx}. Safety score ${f.score}/100.`;
    case "safe":
    default:
      return `Tessera is watching. No action needed${ctx}. Safety score ${f.score}/100.`;
  }
}

const SYSTEM_PROMPT = `You are Tessera, an AI risk agent for a DeFi lending protocol on Arbitrum.
You write extremely concise alert messages for retail users about their loan health.

Rules:
- Output ONE sentence, max 30 words.
- No emojis. No markdown. No jargon (no "LTV", "health factor", "liquidation threshold").
- Tone: calm, reassuring, professional. Never alarmist.
- Never invent facts not in the JSON facts I give you.
- Always reference the safety score 0-100 if provided.
- Respond with the alert text ONLY, no preamble.`;

/**
 * Build LLM-authored alert copy. If the LLM is unavailable or errors,
 * falls back to `templateAlertCopy` so callers always get a usable string.
 */
export async function generateAlertCopy(
  llm: TesseraLLM,
  facts: AlertFacts,
): Promise<string> {
  if (!llm.available) return templateAlertCopy(facts);
  try {
    const prompt = `Facts (JSON): ${JSON.stringify({
      level: facts.level,
      safetyScore: facts.score,
      context: facts.context ?? null,
    })}\n\nWrite the alert sentence now.`;
    const text = await llm.complete(prompt, { system: SYSTEM_PROMPT, maxTokens: 120 });
    const cleaned = text.replace(/^["']|["']$/g, "").trim();
    if (!cleaned) return templateAlertCopy(facts);
    return cleaned;
  } catch {
    return templateAlertCopy(facts);
  }
}
