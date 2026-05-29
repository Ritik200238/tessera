/**
 * Anthropic LLM client wrapper (TDD §20.3, D8).
 *
 * Used for two paths only:
 *   1. Alert copy — rule JSON -> plain English (`src/llm/alert-copy.ts`)
 *   2. NL config parsing — free-form text -> AgentConfig (`src/llm/nl-config.ts`)
 *
 * If `ANTHROPIC_API_KEY` is unset the client returns `available = false` and
 * callers MUST fall back to deterministic templates (TDD §4.4 alert path).
 */

import Anthropic from "@anthropic-ai/sdk";
import type { LLMClient } from "../vibekit-shim.js";

export interface AnthropicConfig {
  apiKey?: string | undefined;
  model: string;
}

export interface TesseraLLM extends LLMClient {
  available: boolean;
}

/**
 * Build the LLM client. Always returns an object; check `.available` before
 * trusting the LLM path. When unavailable, `complete()` throws so callers
 * must consciously catch and fall back.
 */
export function makeLLMClient(cfg: AnthropicConfig): TesseraLLM {
  if (!cfg.apiKey) {
    return {
      available: false,
      async complete(): Promise<string> {
        throw new Error("LLM unavailable: ANTHROPIC_API_KEY not set");
      },
    };
  }

  const client = new Anthropic({ apiKey: cfg.apiKey });

  return {
    available: true,
    async complete(
      prompt: string,
      opts?: { system?: string; maxTokens?: number },
    ): Promise<string> {
      const resp = await client.messages.create({
        model: cfg.model,
        max_tokens: opts?.maxTokens ?? 512,
        ...(opts?.system ? { system: opts.system } : {}),
        messages: [{ role: "user", content: prompt }],
      });
      const text = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      return text.trim();
    },
  };
}
