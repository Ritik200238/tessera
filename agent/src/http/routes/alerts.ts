/**
 * GET /alerts/latest — open alerts (HF below alertThreshold).
 */

import type { Hono } from "hono";
import type { AlertSnapshot } from "../../log/alerts.js";
import { checkBearer } from "../auth.js";

// Open alerts are a live list of currently-distressed borrowers (address + HF).
// That has no public-transparency justification (unlike confirmed past actions,
// which carry a tx hash), so it is owner-gated to avoid a real-time targeting feed.
export function registerAlertsRoute(app: Hono, alerts: AlertSnapshot, adminSecret: string): void {
  app.get("/alerts/latest", (c) => {
    if (!checkBearer(c, adminSecret)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    return c.json({ alerts: alerts.list() });
  });
}
