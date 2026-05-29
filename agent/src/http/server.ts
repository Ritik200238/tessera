/**
 * Hono HTTP server boot. Decision (TDD §4.7): hono picked over fastify for
 * size + zero-dependency typed routing + uniform handler shape across
 * runtimes (we may host this on Fly + serverless later — TDD §10.3).
 */

import { Hono } from "hono";
import { serve, type ServerType } from "@hono/node-server";
import { registerHealthRoute, type HealthSource } from "./routes/health.js";
import { registerActionsRoute } from "./routes/actions.js";
import { registerAlertsRoute } from "./routes/alerts.js";
import { registerMetricsRoute } from "./routes/metrics.js";
import { registerConfigRoute, type ConfigDeps } from "./routes/config.js";
import type { JsonlLog } from "../log/jsonl.js";
import type { AlertSnapshot } from "../log/alerts.js";

export interface HttpDeps extends ConfigDeps {
  log: JsonlLog;
  alerts: AlertSnapshot;
  healthSource: HealthSource;
}

export function buildApp(deps: HttpDeps): Hono {
  const app = new Hono();
  app.get("/", (c) => c.json({ service: "tessera-agent", ok: true }));
  registerHealthRoute(app, deps.healthSource);
  registerActionsRoute(app, deps.log);
  registerAlertsRoute(app, deps.alerts);
  registerMetricsRoute(app);
  registerConfigRoute(app, deps);
  return app;
}

export interface BoundServer {
  app: Hono;
  server: ServerType;
  port: number;
  close: () => Promise<void>;
}

/**
 * Build the app and bind it to `port`. Returns the underlying server so
 * tests can close it cleanly.
 */
export async function startServer(port: number, deps: HttpDeps): Promise<BoundServer> {
  const app = buildApp(deps);
  return new Promise((resolve) => {
    const server = serve({ fetch: app.fetch, port }, (info) => {
      resolve({
        app,
        server,
        port: info.port,
        close: () =>
          new Promise<void>((res) => {
            server.close(() => res());
          }),
      });
    });
  });
}
