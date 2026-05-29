/**
 * Vibekit shim — TDD §4.5.
 *
 * STATUS: `@emberagi/vibekit` is not currently published to npm (verified by
 * `npm view @emberagi/vibekit` → 404). No local clone exists at `docs/` either.
 *
 * This shim exposes the EXPECTED surface so the rest of the agent is written
 * against the real shape from TDD §4.5:
 *   - `registerProtocol(spec)` — declare Tessera as an addressable protocol
 *   - `defineTool(spec)`       — register a tool the framework can call
 *   - `LLMClient`              — thin LLM wrapper used by alert-copy + nl-config
 *
 * When the real package lands, this file's exports map one-to-one onto the
 * upstream API; consumers should not need to change.
 */

import type { Address, Hex } from "viem";

export interface ToolSpec<TInput, TOutput> {
  name: string;
  description: string;
  /** JSON-Schema-like description; in real Vibekit, zod schemas are accepted. */
  inputSchema: Record<string, unknown>;
  handler: (input: TInput) => Promise<TOutput> | TOutput;
}

export interface ProtocolSpec {
  name: string;
  chainId: number;
  vaultAddress: Address;
  tools: ToolSpec<unknown, unknown>[];
}

interface Registry {
  protocols: Map<string, ProtocolSpec>;
  tools: Map<string, ToolSpec<unknown, unknown>>;
}

const registry: Registry = {
  protocols: new Map(),
  tools: new Map(),
};

/** Register the Tessera protocol so the framework can address it. */
export function registerProtocol(spec: ProtocolSpec): void {
  registry.protocols.set(spec.name, spec);
  for (const tool of spec.tools) registry.tools.set(tool.name, tool);
}

/** Define a standalone tool (not tied to a protocol). */
export function defineTool<TInput, TOutput>(spec: ToolSpec<TInput, TOutput>): ToolSpec<TInput, TOutput> {
  registry.tools.set(spec.name, spec as ToolSpec<unknown, unknown>);
  return spec;
}

/** Inspect the registry (test/debug). */
export function _getRegistry(): Registry {
  return registry;
}

/**
 * Minimal LLM client surface. Concrete implementation lives in
 * `src/llm/client.ts`; this just types the contract Vibekit will provide.
 */
export interface LLMClient {
  complete(prompt: string, opts?: { system?: string; maxTokens?: number }): Promise<string>;
}

export type { Address, Hex };
