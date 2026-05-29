/**
 * GET /health — liveness + freshness signal (TDD §4.7, §17.1).
 */

import type { Hono } from "hono";

export interface HealthSource {
  getLastTickAt(): string | null;
  getErrors24h(): number;
  getUsersTracked(): number;
}

export function registerHealthRoute(app: Hono, source: HealthSource): void {
  app.get("/health", (c) => {
    const lastTickAt = source.getLastTickAt();
    const ageMs = lastTickAt ? Date.now() - Date.parse(lastTickAt) : null;
    const ok = lastTickAt !== null && ageMs !== null && ageMs < 60_000;
    return c.json(
      {
        ok,
        lastTickAt,
        errors24h: source.getErrors24h(),
        usersTracked: source.getUsersTracked(),
      },
      ok ? 200 : 503,
    );
  });
}
