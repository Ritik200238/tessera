/**
 * Tessera Risk Agent — entrypoint.
 *
 * Boots:
 *   1. SQLite (state + idempotency)
 *   2. JSONL action log
 *   3. Alert snapshot
 *   4. viem clients
 *   5. HTTP server (/health, /actions, /alerts/latest, /metrics, /config)
 *   6. Tick loop with exponential backoff on RPC errors
 *
 * Lifecycle: SIGINT/SIGTERM stops the tick loop + closes the server cleanly.
 */

import { erc20Abi, parseGwei, type Address, type Hex } from "viem";
import { loadConfig } from "./config.js";
import { getLogger } from "./logger.js";
import { AgentDB } from "./db/index.js";
import { JsonlLog } from "./log/jsonl.js";
import { AlertSnapshot } from "./log/alerts.js";
import { action } from "./log/action.js";
import { makeVaultClients } from "./vault-client.js";
import { makeLLMClient } from "./llm/client.js";
import { runTick } from "./strategy/tick.js";
import type { LiquidatorDeps } from "./strategy/liquidator.js";
import type { AutoRepayDeps } from "./strategy/auto-repay.js";
import type { AlerterDeps } from "./strategy/alerter.js";
import { startServer } from "./http/server.js";
import { metrics } from "./metrics.js";
import { registerProtocol } from "./vibekit-shim.js";
import { IncidentNotifier } from "./notify/webhook.js";
import type { AgentConfig } from "./types.js";

/** Consecutive failed ticks before we page on-call (avoids alerting on a blip). */
const DEGRADED_AFTER_FAILURES = 3;

const ERRORS_24H_WINDOW_MS = 24 * 60 * 60 * 1000;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const logger = getLogger();

  // Fail fast on a misconfigured deployment rather than silently ticking against
  // the zero address (which reverts every read and looks like a dead chain).
  if (cfg.VAULT_ADDRESS.toLowerCase() === ZERO_ADDRESS) {
    throw new Error(
      "VAULT_ADDRESS is unset (zero address). Set it from shared/addresses/<env>.json in .env before starting the agent.",
    );
  }
  if (cfg.USDC_ADDRESS.toLowerCase() === ZERO_ADDRESS) {
    throw new Error(
      "USDC_ADDRESS is unset (zero address). The liquidator and auto-repay need it — set it in .env.",
    );
  }
  if (!cfg.NVIDIA_API_KEY && !cfg.ANTHROPIC_API_KEY) {
    logger.warn(
      "No LLM key set (NVIDIA_API_KEY / ANTHROPIC_API_KEY). Alerts will use the deterministic template fallback.",
    );
  }
  // Never ship the insecure default admin secret in production — /config can
  // pause the agent and mutate thresholds, so an unset secret is a real footgun.
  if (cfg.NODE_ENV === "production" && cfg.AGENT_ADMIN_SECRET === "dev-admin-secret-change-me") {
    throw new Error(
      "AGENT_ADMIN_SECRET is the insecure default. Set a strong AGENT_ADMIN_SECRET before running in production.",
    );
  }

  logger.info({ port: cfg.AGENT_HTTP_PORT }, "tessera-agent: starting");

  // On-call incident comms (disabled unless AGENT_INCIDENT_WEBHOOK_URL is set).
  const incidents = new IncidentNotifier({
    webhookUrl: cfg.AGENT_INCIDENT_WEBHOOK_URL,
    logger,
    label: `tessera-agent (chain ${cfg.CHAIN_ID})`,
  });

  // 1. state
  const db = new AgentDB(cfg.AGENT_DB_PATH);
  const log = new JsonlLog(cfg.AGENT_LOG_DIR, cfg.AGENT_LOG_RETENTION_DAYS);
  const alerts = new AlertSnapshot(`${cfg.AGENT_LOG_DIR}/latest_alerts.json`);
  let currentConfig: AgentConfig = db.getAgentConfig();

  // 2. clients
  const { publicClient, walletClient, account, address: vaultAddress } = makeVaultClients({
    rpcUrl: cfg.RPC_URL,
    chainId: cfg.CHAIN_ID,
    vaultAddress: cfg.VAULT_ADDRESS as Address,
    privateKey: cfg.AGENT_PRIVATE_KEY as Hex,
  });

  // 3. LLM — NVIDIA NIM open-model chain primary, Claude fallback, templates otherwise.
  const llm = makeLLMClient({
    nvidiaApiKey: cfg.NVIDIA_API_KEY,
    nvidiaBaseUrl: cfg.NVIDIA_BASE_URL,
    nimModels: cfg.NIM_MODELS.split(",").map((m) => m.trim()).filter(Boolean),
    nimTimeoutMs: cfg.NIM_TIMEOUT_MS,
    anthropicApiKey: cfg.ANTHROPIC_API_KEY,
    anthropicModel: cfg.LLM_MODEL,
  });
  if (llm.available) {
    logger.info({ provider: llm.provider }, "LLM alert copy enabled");
  } else {
    logger.warn("no LLM key (NVIDIA_API_KEY / ANTHROPIC_API_KEY) — alerts use template fallback");
  }

  // 4. Vibekit registration (shim until upstream package exists)
  registerProtocol({
    name: "tessera",
    chainId: cfg.CHAIN_ID,
    vaultAddress: vaultAddress,
    tools: [],
  });

  // 5. error tracking for /health
  const errorTimestamps: number[] = [];
  let lastTickAt: string | null = null;
  let usersTracked = 0;
  const trackError = (where: string, message: string): void => {
    errorTimestamps.push(Date.now());
    metrics.errorsTotal.inc({ where });
    logger.error({ where }, message);
  };
  const recentErrors = (): number => {
    const cutoff = Date.now() - ERRORS_24H_WINDOW_MS;
    while (errorTimestamps.length && errorTimestamps[0]! < cutoff) errorTimestamps.shift();
    return errorTimestamps.length;
  };

  // 6. USDC balance reader — the liquidator's float check (liquidator.ts step 2).
  //    USDC address comes from config (shared/addresses/<env>.json), not a bare env var.
  const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
  const getUsdcBalance = async (): Promise<bigint> => {
    const usdcAddr = cfg.USDC_ADDRESS as Address;
    if (usdcAddr === ZERO_ADDR) return 0n;
    try {
      const bal = await publicClient.readContract({
        address: usdcAddr,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account.address],
      });
      metrics.usdcBalance.set(Number(bal));
      return bal as bigint;
    } catch (e) {
      trackError("usdc.balance", (e as Error).message);
      return 0n;
    }
  };

  // 7. tick deps
  const alerter: AlerterDeps = { llm, log, alerts };
  const liquidator: LiquidatorDeps = {
    publicClient,
    walletClient,
    account,
    vaultAddress,
    getUsdcBalance,
    log,
    db,
    maxGasGwei: currentConfig.maxGasGwei,
  };
  const autoRepay: AutoRepayDeps = {
    publicClient,
    walletClient,
    account,
    vaultAddress,
    usdcAddress: cfg.USDC_ADDRESS as Address,
    log,
    db,
    maxGasGwei: currentConfig.maxGasGwei,
  };

  // 8. HTTP server
  const server = await startServer(cfg.AGENT_HTTP_PORT, {
    log,
    alerts,
    db,
    llm,
    adminSecret: cfg.AGENT_ADMIN_SECRET,
    corsOrigins: cfg.AGENT_CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
    healthSource: {
      getLastTickAt: () => lastTickAt,
      getErrors24h: () => recentErrors(),
      getUsersTracked: () => usersTracked,
    },
    onConfigUpdate: () => {
      currentConfig = db.getAgentConfig();
      liquidator.maxGasGwei = currentConfig.maxGasGwei;
      autoRepay.maxGasGwei = currentConfig.maxGasGwei;
      void parseGwei; // keep import in case route handlers need it
      logger.info({ config: currentConfig }, "config reloaded");
    },
  });
  logger.info({ port: server.port }, "http server listening");
  void incidents.notify(
    "info",
    "agent online",
    `vault ${vaultAddress} · chain ${cfg.CHAIN_ID} · port ${server.port}`,
  );

  // 9. user discovery — lightweight event indexer. Public RPCs are non-archive
  // and cap getLogs ranges, so we scan in bounded chunks from a recent lookback
  // (or AGENT_START_BLOCK) and persist the checkpoint after every chunk. Known
  // borrowers can be pinned via AGENT_TRACKED_USERS and are watched immediately.
  const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;
  const pinned = new Set<Address>();
  for (const raw of cfg.AGENT_TRACKED_USERS.split(",").map((s) => s.trim())) {
    if (ADDR_RE.test(raw)) pinned.add(raw.toLowerCase() as Address);
  }
  if (pinned.size > 0) logger.info({ pinned: [...pinned] }, "pinned tracked users");

  const START_BLOCK = BigInt(cfg.AGENT_START_BLOCK);
  const LOOKBACK = BigInt(cfg.AGENT_LOG_LOOKBACK);
  const CHUNK = BigInt(cfg.AGENT_LOG_CHUNK);
  const indexUsers = async (): Promise<Address[]> => {
    try {
      const head = await publicClient.getBlockNumber();
      const checkpoint = BigInt(db.getCheckpoint());
      // Resume from the checkpoint (with a small reorg overlap) once we have one;
      // otherwise cold-start from the lookback window (or the configured start).
      let cursor =
        checkpoint > 0n
          ? checkpoint > 5n
            ? checkpoint - 5n
            : 0n
          : head > LOOKBACK
            ? head - LOOKBACK
            : 0n;
      if (cursor < START_BLOCK) cursor = START_BLOCK;

      while (cursor <= head) {
        const to = cursor + CHUNK > head ? head : cursor + CHUNK;
        const logs = await publicClient.getLogs({
          address: vaultAddress,
          fromBlock: cursor,
          toBlock: to,
        });
        for (const ev of logs) {
          // The first indexed topic is the acting user for every user-bearing
          // vault event (Borrow/Repay/Deposit/Withdraw/AgentRepay). Over-including
          // a non-user address is harmless: it simply reads as having no debt.
          const t1 = ev.topics[1];
          if (t1 && t1.length === 66) {
            const user = `0x${t1.slice(26)}`.toLowerCase() as Address;
            if (user !== ZERO_ADDR) db.upsertBorrower(user, Number(to));
          }
        }
        db.setCheckpoint(Number(to));
        cursor = to + 1n;
      }
    } catch (e) {
      trackError("indexUsers", (e as Error).message);
    }
    // Durable active borrower set (persisted, survives restart) ∪ pinned (always
    // watched). A repaid borrower is evicted by the tick but the row remains, so
    // a re-borrow re-activates them instantly.
    return [...new Set<Address>([...(db.getActiveBorrowers() as Address[]), ...pinned])];
  };

  // 10. tick loop with exponential backoff
  let running = true;
  let backoffMs = 0;
  let consecutiveTickFailures = 0;
  let degraded = false;
  const MAX_BACKOFF = 60_000;
  const loop = async (): Promise<void> => {
    while (running) {
      try {
        const end = metrics.tickDuration.startTimer();
        const result = await runTick({
          publicClient,
          vaultAddress,
          getTrackedUsers: indexUsers,
          alerter,
          liquidator,
          autoRepay,
          markInactive: (u) => db.setBorrowerActive(u, false),
          log,
          config: currentConfig,
        });
        end();
        metrics.ticksTotal.inc();
        metrics.usersTracked.set(result.usersChecked);
        metrics.liquidationsTotal.inc({ status: "submitted" }, result.liquidated);
        metrics.alertsTotal.inc({ level: "watch" }, result.alerted);
        usersTracked = result.usersChecked;
        lastTickAt = new Date().toISOString();
        metrics.secondsSinceLastTick.set(0);
        if (degraded) {
          void incidents.notify(
            "info",
            "tick loop recovered",
            `after ${consecutiveTickFailures} consecutive failures`,
          );
          degraded = false;
        }
        consecutiveTickFailures = 0;
        backoffMs = 0;
      } catch (e) {
        trackError("tick", (e as Error).message);
        log.append(action.error("tick", (e as Error).message));
        consecutiveTickFailures += 1;
        if (consecutiveTickFailures >= DEGRADED_AFTER_FAILURES && !degraded) {
          degraded = true;
          void incidents.notify(
            "critical",
            "tick loop failing",
            `${consecutiveTickFailures} consecutive failures — last: ${(e as Error).message}`,
          );
        }
        backoffMs = Math.min(Math.max(1_000, backoffMs * 2), MAX_BACKOFF);
      }
      const wait = backoffMs > 0 ? backoffMs : currentConfig.pollIntervalMs;
      await new Promise((r) => setTimeout(r, wait));
    }
  };

  // Heartbeat: update seconds-since-last-tick gauge once per second
  const heartbeat = setInterval(() => {
    if (lastTickAt) {
      metrics.secondsSinceLastTick.set((Date.now() - Date.parse(lastTickAt)) / 1000);
    }
  }, 1_000);

  void loop();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "shutdown signal received");
    running = false;
    clearInterval(heartbeat);
    await incidents.notify("warn", "agent stopping", `signal ${signal}`);
    await server.close();
    db.close();
    logger.info("shutdown complete");
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

// Only run main() when executed directly, not when imported by tests.
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isMain) {
  main().catch((e) => {
    console.error("fatal:", e);
    process.exit(1);
  });
}
