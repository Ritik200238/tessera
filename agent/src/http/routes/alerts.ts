/**
 * GET /alerts/latest — open alerts (HF below alertThreshold).
 */

import type { Hono } from "hono";
import type { AlertSnapshot } from "../../log/alerts.js";

export function registerAlertsRoute(app: Hono, alerts: AlertSnapshot): void {
  app.get("/alerts/latest", (c) => {
    return c.json({ alerts: alerts.list() });
  });
}
