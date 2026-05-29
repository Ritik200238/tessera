/**
 * Prometheus metrics surface (TDD §17.1).
 *
 * One module-level Registry kept simple for MVP. If we ever multi-process,
 * we switch to a Registry-per-process aggregated by a sidecar.
 */

import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client";

const registry = new Registry();
collectDefaultMetrics({ register: registry, prefix: "tessera_agent_" });

export const metrics = {
  registry,
  ticksTotal: new Counter({
    name: "tessera_agent_ticks_total",
    help: "Total ticks executed",
    registers: [registry],
  }),
  errorsTotal: new Counter({
    name: "tessera_agent_errors_total",
    help: "Total errors observed",
    labelNames: ["where"] as const,
    registers: [registry],
  }),
  liquidationsTotal: new Counter({
    name: "tessera_agent_liquidations_total",
    help: "Liquidation transactions submitted",
    labelNames: ["status"] as const,
    registers: [registry],
  }),
  alertsTotal: new Counter({
    name: "tessera_agent_alerts_total",
    help: "Alerts emitted",
    labelNames: ["level"] as const,
    registers: [registry],
  }),
  usersTracked: new Gauge({
    name: "tessera_agent_users_tracked",
    help: "Borrowers currently tracked",
    registers: [registry],
  }),
  usdcBalance: new Gauge({
    name: "tessera_agent_usdc_balance",
    help: "Agent USDC float in raw 6-decimal units",
    registers: [registry],
  }),
  secondsSinceLastTick: new Gauge({
    name: "tessera_agent_seconds_since_last_tick",
    help: "Seconds since the agent last completed a tick",
    registers: [registry],
  }),
  tickDuration: new Histogram({
    name: "tessera_agent_tick_duration_seconds",
    help: "Wall-clock duration of one tick",
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
    registers: [registry],
  }),
};

/** Returns the full Prometheus exposition format string. */
export async function renderMetrics(): Promise<string> {
  return registry.metrics();
}
