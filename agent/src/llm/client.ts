/**
 * LLM client wrapper (TDD §20.3, D8).
 *
 * Used for two paths only:
 *   1. Alert copy — rule JSON -> plain English (`src/llm/alert-copy.ts`)
 *   2. NL config parsing — free-form text -> AgentConfig (`src/llm/nl-config.ts`)
 *
 * Provider precedence (first that answers within the timeout wins):
 *   1. NVIDIA NIM (OpenAI-compatible) when `NVIDIA_API_KEY` is set. Tries an
 *      ordered list of open models — see `nimModels`. NIM endpoints cold-start,
 *      so each attempt is bounded by `nimTimeoutMs`; a slow model is skipped, the
 *      next is tried, and the agent's tick loop is never blocked.
 *   2. Anthropic Claude (Haiku) when `ANTHROPIC_API_KEY` is set — cross-provider
 *      fallback if every NIM model fails.
 *   3. Neither / all fail -> `complete()` throws; callers MUST catch and fall back
 *      to deterministic templates (TDD §4.4). The deterministic core never depends
 *      on the LLM; the LLM only phrases what the core already decided.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { LLMClient } from "../vibekit-shim.js";

export interface LLMConfig {
  /** NVIDIA NIM API key (`nvapi-...`). Primary provider when present. */
  nvidiaApiKey?: string | undefined;
  /** OpenAI-compatible base URL for NVIDIA NIM. */
  nvidiaBaseUrl: string;
  /** Ordered NIM model ids. The first to answer within `nimTimeoutMs` is used. */
  nimModels: string[];
  /** Per-attempt timeout (ms) for a single NIM model call. */
  nimTimeoutMs: number;
  /** Anthropic API key — cross-provider fallback. */
  anthropicApiKey?: string | undefined;
  /** Anthropic model id, e.g. `claude-haiku-4-5`. */
  anthropicModel: string;
}

export interface TesseraLLM extends LLMClient {
  available: boolean;
  /** Human-readable provider that actually answered, surfaced in alerts/feed
   *  ("Llama 3.3 70B (NVIDIA NIM)", "Claude"). Updated per successful call so the
   *  activity feed attributes copy honestly. Optional so test mocks needn't set it. */
  provider?: string;
}

interface CompleteOpts {
  system?: string;
  maxTokens?: number;
}

/** Friendly labels for the models we ship by default. Unknown ids pass through. */
const MODEL_LABELS: Record<string, string> = {
  "meta/llama-3.3-70b-instruct": "Llama 3.3 70B",
  "qwen/qwen3.5-122b-a10b": "Qwen 3.5",
  "moonshotai/kimi-k2.6": "Kimi K2.6",
  "moonshotai/kimi-k2-instruct": "Kimi K2",
};
function label(modelId: string): string {
  return MODEL_LABELS[modelId] ?? modelId;
}

/**
 * NVIDIA NIM — OpenAI-compatible chat completions over fetch, with an ordered
 * model fallback chain and a hard per-attempt timeout. Throws only if every
 * configured model fails, so `makeLLMClient` can then try Anthropic.
 */
function makeNvidiaNim(cfg: LLMConfig): TesseraLLM {
  const url = `${cfg.nvidiaBaseUrl.replace(/\/$/, "")}/chat/completions`;
  const models = cfg.nimModels.length > 0 ? cfg.nimModels : ["meta/llama-3.3-70b-instruct"];
  const self: TesseraLLM = {
    available: true,
    provider: `${label(models[0]!)} (NVIDIA NIM)`,
    async complete(prompt: string, opts?: CompleteOpts): Promise<string> {
      const messages: Array<{ role: string; content: string }> = [];
      if (opts?.system) messages.push({ role: "system", content: opts.system });
      messages.push({ role: "user", content: prompt });

      const errors: string[] = [];
      for (const model of models) {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), cfg.nimTimeoutMs);
        try {
          const resp = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${cfg.nvidiaApiKey}`,
            },
            body: JSON.stringify({
              model,
              messages,
              max_tokens: opts?.maxTokens ?? 512,
              temperature: 0.2,
            }),
            signal: ac.signal,
          });
          if (!resp.ok) {
            errors.push(`${model}:HTTP ${resp.status}`);
            continue;
          }
          const json = (await resp.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const text = (json.choices?.[0]?.message?.content ?? "").trim();
          if (!text) {
            errors.push(`${model}:empty`);
            continue;
          }
          self.provider = `${label(model)} (NVIDIA NIM)`;
          return text;
        } catch (err) {
          const reason = err instanceof Error && err.name === "AbortError"
            ? `timeout(${cfg.nimTimeoutMs}ms)`
            : err instanceof Error ? err.message : String(err);
          errors.push(`${model}:${reason}`);
        } finally {
          clearTimeout(timer);
        }
      }
      throw new Error(`NVIDIA NIM: all models failed [${errors.join(", ")}]`);
    },
  };
  return self;
}

/** Anthropic Claude — cross-provider fallback via the official SDK. */
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
 * trusting the LLM path. When more than one provider is configured they form a
 * fallback chain (NIM chain -> Anthropic). When all fail, `complete()` throws so
 * callers must consciously catch and fall back to deterministic templates.
 */
export function makeLLMClient(cfg: LLMConfig): TesseraLLM {
  const chain: TesseraLLM[] = [];
  if (cfg.nvidiaApiKey) chain.push(makeNvidiaNim(cfg));
  if (cfg.anthropicApiKey) chain.push(makeAnthropic(cfg));

  if (chain.length === 0) {
    return {
      available: false,
      provider: "none",
      async complete(): Promise<string> {
        throw new Error("LLM unavailable: set NVIDIA_API_KEY or ANTHROPIC_API_KEY");
      },
    };
  }
  if (chain.length === 1) return chain[0]!;

  const composite: TesseraLLM = {
    available: true,
    provider: chain[0]!.provider,
    async complete(prompt: string, opts?: CompleteOpts): Promise<string> {
      const errors: string[] = [];
      for (const provider of chain) {
        try {
          const text = await provider.complete(prompt, opts);
          composite.provider = provider.provider;
          return text;
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err));
        }
      }
      throw new Error(`all LLM providers failed: ${errors.join(" | ")}`);
    },
  };
  return composite;
}
