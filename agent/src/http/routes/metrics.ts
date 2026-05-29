/**
 * GET /metrics — Prometheus exposition.
 */

import type { Hono } from "hono";
import { renderMetrics } from "../../metrics.js";

export function registerMetricsRoute(app: Hono): void {
  app.get("/metrics", async (c) => {
    const body = await renderMetrics();
    return c.text(body, 200, { "content-type": "text/plain; version=0.0.4" });
  });
}
