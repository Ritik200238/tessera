/**
 * POST /config — owner-only AgentConfig mutation (TDD §4.6, §4.7).
 *
 * Two input shapes are accepted:
 *   1. Structured JSON matching `agentConfigSchema` (machine clients)
 *   2. `{ "text": "natural-language strategy..." }` (the /agent UI)
 *
 * Both go through validation; invalid bodies do NOT mutate state.
 */

import type { Hono } from "hono";
import { agentConfigSchema } from "../../config.js";
import type { AgentDB } from "../../db/index.js";
import type { TesseraLLM } from "../../llm/client.js";
import { parseNLConfig } from "../../llm/nl-config.js";
import { checkBearer } from "../auth.js";

export interface ConfigDeps {
  db: AgentDB;
  llm: TesseraLLM;
  adminSecret: string;
  onConfigUpdate?: () => void;
}

export function registerConfigRoute(app: Hono, deps: ConfigDeps): void {
  app.get("/config", (c) => {
    if (!checkBearer(c, deps.adminSecret)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const cfg = deps.db.getAgentConfig();
    return c.json({
      ...cfg,
      alertThreshold: cfg.alertThreshold.toString(),
      liquidationThreshold: cfg.liquidationThreshold.toString(),
    });
  });

  app.post("/config", async (c) => {
    if (!checkBearer(c, deps.adminSecret)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }

    // NL path
    if (
      typeof body === "object" &&
      body !== null &&
      "text" in body &&
      typeof (body as { text: unknown }).text === "string"
    ) {
      const result = await parseNLConfig(deps.llm, (body as { text: string }).text);
      if (!result.ok || !result.config) {
        return c.json({ error: result.error ?? "parse failed" }, 400);
      }
      deps.db.setAgentConfig(result.config);
      deps.onConfigUpdate?.();
      return c.json({
        ok: true,
        config: {
          ...result.config,
          alertThreshold: result.config.alertThreshold.toString(),
          liquidationThreshold: result.config.liquidationThreshold.toString(),
        },
      });
    }

    // Structured path
    const parsed = agentConfigSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.message }, 400);
    }
    deps.db.setAgentConfig(parsed.data);
    deps.onConfigUpdate?.();
    return c.json({
      ok: true,
      config: {
        ...parsed.data,
        alertThreshold: parsed.data.alertThreshold.toString(),
        liquidationThreshold: parsed.data.liquidationThreshold.toString(),
      },
    });
  });
}
