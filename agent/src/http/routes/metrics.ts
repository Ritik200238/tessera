/**
 * GET /metrics — Prometheus exposition.
 */

import type { Hono } from "hono";
import { renderMetrics } from "../../metrics.js";
import { checkBearer } from "../auth.js";

// Metrics include the agent's exact USDC liquidation float and stall timing — an
// operational-security side channel an attacker can use to engineer a
// denial-of-liquidation. Gated behind the admin bearer; Prometheus scrapers run
// server-side and can carry the header.
export function registerMetricsRoute(app: Hono, adminSecret: string): void {
  app.get("/metrics", async (c) => {
    if (!checkBearer(c, adminSecret)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const body = await renderMetrics();
    return c.text(body, 200, { "content-type": "text/plain; version=0.0.4" });
  });
}
