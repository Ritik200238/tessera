import { describe, it, expect, vi } from "vitest";
import { IncidentNotifier } from "../src/notify/webhook.js";

function okFetch() {
  return vi.fn(async () => ({ ok: true, status: 204 }) as unknown as Response);
}

describe("IncidentNotifier", () => {
  it("is a no-op when no webhook URL is set", async () => {
    const fetchFn = okFetch();
    const n = new IncidentNotifier({ fetchFn });
    expect(n.enabled).toBe(false);
    expect(await n.notify("info", "agent online")).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("POSTs a Discord+Slack payload to the webhook", async () => {
    const fetchFn = okFetch();
    const n = new IncidentNotifier({ webhookUrl: "https://hook.test/x", fetchFn, label: "tessera (421614)" });
    expect(await n.notify("critical", "tick loop failing", "3 in a row")).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://hook.test/x");
    const body = JSON.parse(init.body as string);
    expect(body.content).toContain("tick loop failing");
    expect(body.content).toContain("tessera (421614)");
    expect(body.text).toBe(body.content); // Slack reads `text`, Discord reads `content`
  });

  it("debounces repeats of the same incident within the cooldown", async () => {
    const fetchFn = okFetch();
    const n = new IncidentNotifier({ webhookUrl: "https://hook.test/x", fetchFn, cooldownMs: 60_000 });
    expect(await n.notify("warn", "rpc slow", undefined, 1_000)).toBe(true);
    expect(await n.notify("warn", "rpc slow", undefined, 5_000)).toBe(false); // inside cooldown
    expect(await n.notify("warn", "rpc slow", undefined, 70_000)).toBe(true); // cooldown elapsed
    // A different incident is independent.
    expect(await n.notify("critical", "rpc slow", undefined, 5_000)).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("never throws when the webhook POST fails", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("connreset");
    });
    const warn = vi.fn();
    const n = new IncidentNotifier({ webhookUrl: "https://hook.test/x", fetchFn, logger: { warn } });
    await expect(n.notify("warn", "boom")).resolves.toBe(true);
    expect(warn).toHaveBeenCalled();
  });
});
