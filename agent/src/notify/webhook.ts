/**
 * Incident notifier — on-call comms for the agent (TDD §15 / blueprint §15).
 *
 * Posts lifecycle + degradation events to a Discord/Slack-compatible webhook so
 * an operator learns the agent went down / is failing WITHOUT watching logs. It
 * is deliberately small and dependency-free:
 *
 *   - no webhook URL configured  -> disabled (no-op), so dev/test are unaffected
 *   - debounced per (level+title) -> a flapping error can't spam the channel
 *   - bounded fetch + never throws -> a hung/broken webhook can't stall the agent
 *
 * Payload carries both `content` (Discord) and `text` (Slack); each platform
 * reads its own key and ignores the other.
 */

export type IncidentLevel = "info" | "warn" | "critical";

interface MinimalLogger {
  warn: (obj: unknown, msg?: string) => void;
}

export interface IncidentNotifierOptions {
  /** Discord/Slack incoming-webhook URL. Falsy => notifier disabled. */
  webhookUrl?: string;
  /** Suppress repeats of the same (level+title) within this window (default 10m). */
  cooldownMs?: number;
  /** Per-POST timeout (default 5s). */
  timeoutMs?: number;
  /** Injected for tests; defaults to the global `fetch`. */
  fetchFn?: typeof fetch;
  logger?: MinimalLogger;
  /** Prefix identifying this deployment, e.g. "tessera-agent (chain 421614)". */
  label?: string;
}

const EMOJI: Record<IncidentLevel, string> = {
  info: "\u{1F7E2}", // green
  warn: "\u{1F7E0}", // orange
  critical: "\u{1F534}", // red
};

export class IncidentNotifier {
  private readonly url?: string;
  private readonly cooldownMs: number;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly logger?: MinimalLogger;
  private readonly label: string;
  private readonly lastSent = new Map<string, number>();

  constructor(opts: IncidentNotifierOptions) {
    this.url = opts.webhookUrl?.trim() || undefined;
    this.cooldownMs = opts.cooldownMs ?? 10 * 60_000;
    this.timeoutMs = opts.timeoutMs ?? 5_000;
    this.fetchFn = opts.fetchFn ?? fetch;
    this.logger = opts.logger;
    this.label = opts.label ?? "tessera-agent";
  }

  get enabled(): boolean {
    return Boolean(this.url);
  }

  /**
   * Fire-and-forget notification. Never throws. Returns `true` when a POST was
   * attempted, `false` when suppressed (disabled or still inside the cooldown).
   * `now` is injectable for deterministic debounce tests.
   */
  async notify(
    level: IncidentLevel,
    title: string,
    detail?: string,
    now: number = Date.now(),
  ): Promise<boolean> {
    if (!this.url) return false;
    const key = `${level}:${title}`;
    const last = this.lastSent.get(key);
    // Fire the first occurrence; debounce only subsequent repeats inside the window.
    if (last !== undefined && now - last < this.cooldownMs) return false;
    // Record BEFORE the POST so a failing webhook can't be retried into a spam loop.
    this.lastSent.set(key, now);

    const text = `${EMOJI[level]} **${this.label}** — ${title}${detail ? `\n${detail}` : ""}`;
    const body = JSON.stringify({ content: text, text });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchFn(this.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        signal: controller.signal,
      });
      if (!res.ok) this.logger?.warn({ status: res.status }, "incident webhook returned non-2xx");
    } catch (e) {
      this.logger?.warn({ err: (e as Error).message }, "incident webhook POST failed");
    } finally {
      clearTimeout(timer);
    }
    return true;
  }
}
