import { describe, expect, it } from "vitest";
import { deriveAgentStatus, AGENT_STALE_MS } from "@/lib/agent";

// The protection banner is only honest if this mapping is. A wrong "live" here
// is the exact "liquidated while the UI said protected" failure we're closing.
describe("deriveAgentStatus", () => {
  const now = 1_000_000_000_000;
  const iso = (ms: number) => new Date(ms).toISOString();

  it("unknown when the agent endpoint isn't configured", () => {
    expect(deriveAgentStatus({ configured: false, available: false, lastTickAt: null }, now)).toBe("unknown");
  });

  it("down when configured but unreachable", () => {
    expect(deriveAgentStatus({ configured: true, available: false, lastTickAt: null }, now)).toBe("down");
  });

  it("down when reachable but it never ticked", () => {
    expect(deriveAgentStatus({ configured: true, available: true, lastTickAt: null }, now)).toBe("down");
  });

  it("live on a fresh tick", () => {
    expect(deriveAgentStatus({ configured: true, available: true, lastTickAt: iso(now - 10_000) }, now)).toBe("live");
  });

  it("stale once no tick within the staleness window", () => {
    expect(deriveAgentStatus({ configured: true, available: true, lastTickAt: iso(now - AGENT_STALE_MS - 1) }, now)).toBe("stale");
  });

  it("stale on an unparseable timestamp (fail safe, not silently live)", () => {
    expect(deriveAgentStatus({ configured: true, available: true, lastTickAt: "not-a-date" }, now)).toBe("stale");
  });
});
