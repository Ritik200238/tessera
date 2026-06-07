/**
 * Minimal in-memory per-IP rate limiter. The agent's public endpoints (/actions,
 * /health) are unauthenticated by design; this stops a scraper from pinning the
 * event loop with file I/O or amplifying a DoS. Not distributed — one process,
 * which matches the single-agent MVP.
 */

import type { MiddlewareHandler } from "hono";

export function rateLimit(opts: { windowMs: number; max: number }): MiddlewareHandler {
  const hits = new Map<string, number[]>();
  return async (c, next) => {
    const fwd = c.req.header("x-forwarded-for");
    const ip = (fwd ? fwd.split(",")[0]?.trim() : undefined) || c.req.header("x-real-ip") || "unknown";
    const nowMs = Date.now();
    const recent = (hits.get(ip) ?? []).filter((t) => nowMs - t < opts.windowMs);
    if (recent.length >= opts.max) {
      return c.json({ error: "rate limited" }, 429);
    }
    recent.push(nowMs);
    hits.set(ip, recent);
    // Opportunistic cleanup so the map can't grow unbounded.
    if (hits.size > 5_000) {
      for (const [k, v] of hits) {
        if (v.every((t) => nowMs - t > opts.windowMs)) hits.delete(k);
      }
    }
    await next();
  };
}
