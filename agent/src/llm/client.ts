/**
 * LLM client wrapper (TDD §20.3, D8).
 *
 * Used for two paths only:
 *   1. Alert copy — rule JSON -> plain English (`src/llm/alert-copy.ts`)
 *   2. NL config parsing — free-form text -> AgentConfig (`src/llm/nl-config.ts`)
 *
 * Provider precedence:
 *   1. Kimi K2 via NVIDIA NIM (OpenAI-compatible) when `NVIDIA_API_KEY` is set.
 *      This is Tessera's stated primary model.
 *   2. Anthropic Claude (Haiku) when `ANTHROPIC_API_KEY` is set — fallback.
 *   3. Neither -> `available = false`; callers MUST fall back to deterministic
 *      templates (TDD §4.4 alert path). The deterministic core never depends on
 *      the LLM; the LLM only phrases what the core already decided.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { LLMClient } from "../vibekit-shim.js";

export interface LLMConfig {
  /** NVIDIA NIM API key (`nvapi-...`). Primary provider when present. */
  nvidiaApiKey?: string | undefined;
  /** OpenAI-compatible base URL for NVIDIA NIM. */
  nvidiaBaseUrl: string;
  /** Kimi K2 model id on NVIDIA NIM, e.g. `moonshotai/kimi-k2-instruct`. */
  kimiModel: string;
  /** Anthropic API key — fallback provider. */
  anthropicApiKey?: string | undefined;
  /** Anthropic model id, e.g. `claude-haiku-4-5`. */
  anthropicModel: string;
}

export interface TesseraLLM extends LLMClient {
  available: boolean;
  /** Human-readable active provider, surfaced in alerts/feed ("Kimi K2" etc.).
   *  Optional so lightweight test mocks needn't declare it; production always sets it. */
  provider?: string;
}

interface CompleteOpts {
  system?: string;
  maxTokens?: number;
}

/** Kimi K2 via NVIDIA NIM — OpenAI-compatible chat completions over fetch. */
function makeNvidiaKimi(cfg: LLMConfig): TesseraLLM {
  const url = `${cfg.nvidiaBaseUrl.replace(/\/$/, "")}/chat/completions`;
  return {
    available: true,
    provider: "Kimi K2",
    async complete(prompt: string, opts?: CompleteOpts): Promise<string> {
      const messages: Array<{ role: string; content: string }> = [];
      if (opts?.system) messages.push({ role: "system", content: opts.system });
      messages.push({ role: "user", content: prompt });

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.nvidiaApiKey}`,
        },
        body: JSON.stringify({
          model: cfg.kimiModel,
          messages,
          max_tokens: opts?.maxTokens ?? 512,
          temperature: 0.2,
        }),
      });
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        throw new Error(`NVIDIA NIM error ${resp.status}: ${body.slice(0, 300)}`);
      }
      const json = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = json.choices?.[0]?.message?.content ?? "";
      return text.trim();
    },
  };
}

/** Anthropic Claude — fallback provider via the official SDK. */
function makeAnthropic(cfg: LLMConfig): TesseraLLM {
  const client = new Anthropic({ apiKey: cfg.anthropicApiKey });
  return {
    available: true,
    provider: "Claude",
    async complete(prompt: string, opts?: CompleteOpts): Promise<string> {
      const resp = await client.messages.create({
        model: cfg.anthropicModel,
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

/**
 * Build the LLM client. Always returns an object; check `.available` before
 * trusting the LLM path. When unavailable, `complete()` throws so callers must
 * consciously catch and fall back to deterministic templates.
 */
export function makeLLMClient(cfg: LLMConfig): TesseraLLM {
  if (cfg.nvidiaApiKey) return makeNvidiaKimi(cfg);
  if (cfg.anthropicApiKey) return makeAnthropic(cfg);
  return {
    available: false,
    provider: "none",
    async complete(): Promise<string> {
      throw new Error("LLM unavailable: set NVIDIA_API_KEY (Kimi K2) or ANTHROPIC_API_KEY");
    },
  };
}
