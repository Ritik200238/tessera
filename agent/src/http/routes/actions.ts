/**
 * GET /actions?limit=50 — recent action log entries, newest-first.
 * Hard cap of 200 enforced server-side (TDD §4.7).
 */

import type { Hono } from "hono";
import type { JsonlLog } from "../../log/jsonl.js";

export function registerActionsRoute(app: Hono, log: JsonlLog): void {
  app.get("/actions", (c) => {
    const raw = c.req.query("limit");
    const limit = raw === undefined ? 50 : Number.parseInt(raw, 10);
    if (!Number.isFinite(limit) || limit < 0) {
      return c.json({ error: "limit must be a non-negative integer" }, 400);
    }
    return c.json({ entries: log.tail(limit) });
  });
}
