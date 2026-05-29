/**
 * Bearer-token check for owner-only routes (TDD §4.7 POST /config).
 *
 * MVP gating: a single shared secret in `AGENT_ADMIN_SECRET`. Mainnet plan
 * is signature-based with the owner key (see TDD §8.1).
 */

import type { Context } from "hono";

export function checkBearer(c: Context, expected: string): boolean {
  const header = c.req.header("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;
  // Constant-time-ish compare. Length-based short-circuit acceptable here
  // because the secret length is not sensitive.
  const provided = match[1] ?? "";
  if (provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return mismatch === 0;
}
