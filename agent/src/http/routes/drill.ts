/**
 * Live Drill endpoints. Public by design (the whole point is that a judge can
 * press the button), but safe: one drill at a time, a 10-minute cooldown, the
 * global rate limiter, and an asset that is isolated from every real user.
 * Routes 404 when the drill rig isn't configured (no keys in env).
 */

import type { Hono } from "hono";
import type { DrillOrchestrator } from "../../drill/orchestrator.js";

export function registerDrillRoutes(app: Hono, drill: DrillOrchestrator | null): void {
  if (!drill) return;
  app.get("/drill/status", (c) => c.json(drill.getStatus()));
  app.post("/drill/start", (c) => {
    const started = drill.start();
    if (!started) {
      return c.json({ ok: false, status: drill.getStatus() }, 409);
    }
    return c.json({ ok: true, status: drill.getStatus() });
  });
}
