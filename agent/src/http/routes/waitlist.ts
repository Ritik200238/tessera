/**
 * Early-access waitlist — a real demand-capture channel.
 *
 *   POST /waitlist        { email, source? }  → { ok, added }
 *   GET  /waitlist/count                       → { count }
 *
 * Email is the only field stored (lower-cased, de-duped). The count is public
 * so the UI can show honest, real interest — never a fabricated number.
 */

import type { Hono } from "hono";
import type { AgentDB } from "../../db/index.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function registerWaitlistRoute(app: Hono, db: AgentDB): void {
  app.get("/waitlist/count", (c) => c.json({ count: db.waitlistCount() }));

  app.post("/waitlist", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ ok: false, error: "invalid body" }, 400);
    }
    const email = typeof (body as { email?: unknown })?.email === "string"
      ? ((body as { email: string }).email).trim()
      : "";
    const source = typeof (body as { source?: unknown })?.source === "string"
      ? ((body as { source: string }).source).slice(0, 40)
      : "web";

    if (email.length > 254 || !EMAIL_RE.test(email)) {
      return c.json({ ok: false, error: "enter a valid email" }, 400);
    }
    const added = db.addToWaitlist(email, source);
    return c.json({ ok: true, added, count: db.waitlistCount() });
  });
}
