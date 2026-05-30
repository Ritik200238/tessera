# `@tessera/agent` — Risk Agent

Autonomous DeFi monitoring + liquidation runtime for the Tessera vault on
Robinhood Chain. Implements TDD §4 (Risk Agent Design).

## Quickstart

```bash
pnpm install
cp .env.example .env          # fill in RPC_URL, VAULT_ADDRESS, AGENT_PRIVATE_KEY
pnpm typecheck && pnpm test
pnpm dev                      # tsx watch
# or
pnpm build && pnpm start
```

## What the agent does

Three deterministic behaviours (TDD §4.1):

1. **Poll** vault state every `AGENT_POLL_INTERVAL_MS` (default 10s).
2. **Liquidate** any user whose health factor falls below `liquidationThreshold` (1e18).
3. **Alert** users approaching liquidation (HF below `alertThreshold`, default 1.1e18).

The LLM is used **only** for (a) human-readable alert copy and (b) parsing
the natural-language strategy config from the `/agent` UI. Liquidation
decisions are 100% rules-based.

## HTTP API (TDD §4.7)

The agent exposes a small HTTP surface on `AGENT_HTTP_PORT` (default 8787).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/` | none | service info |
| GET | `/health` | none | liveness + freshness |
| GET | `/actions?limit=N` | none | last N action log entries (cap 200, newest-first) |
| GET | `/alerts/latest` | none | open alerts (HF below alertThreshold) |
| GET | `/metrics` | none | Prometheus exposition |
| GET | `/config` | Bearer | read current AgentConfig |
| POST | `/config` | Bearer | update AgentConfig (structured JSON OR `{"text": "..."}` NL) |

### Sample requests

```bash
# Liveness
curl http://localhost:8787/health
# → {"ok":true,"lastTickAt":"2026-05-22T17:00:00.000Z","errors24h":0,"usersTracked":3}

# Action tail
curl 'http://localhost:8787/actions?limit=5'

# Open alerts (used by /agent UI)
curl http://localhost:8787/alerts/latest

# Prometheus scrape
curl http://localhost:8787/metrics

# Update strategy in natural language
curl -X POST http://localhost:8787/config \
  -H "Authorization: Bearer $AGENT_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"text":"warn me earlier — at health factor 1.3"}'

# Update strategy with structured JSON
curl -X POST http://localhost:8787/config \
  -H "Authorization: Bearer $AGENT_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "alertThreshold": "1300000000000000000",
    "liquidationThreshold": "1000000000000000000",
    "pollIntervalMs": 5000,
    "paused": false,
    "maxGasGwei": 50,
    "notes": "manual override"
  }'
```

### Why Hono?

Picked over Fastify for: tiny footprint (~12KB), framework-agnostic deployment
(works on Node, Bun, Cloudflare Workers — useful if we ever move the agent's
read-only routes to the edge), and clean Web-standard `Request`/`Response`
ergonomics that match `fetch`-based tests.

## Environment

All env vars (consumed via dotenv in `src/config.ts` — the **only** place
allowed to read `process.env`).

| Var | Required | Default | Notes |
|---|---|---|---|
| `RPC_URL` | yes | `http://127.0.0.1:8545` | Robinhood Chain RPC |
| `CHAIN_ID` | yes | `412346` | numeric chain id |
| `VAULT_ADDRESS` | yes | zero | from `shared/addresses/<env>.json` |
| `USDC_ADDRESS` | for liquidation | zero | borrow asset |
| `AGENT_PRIVATE_KEY` | yes | dummy | hot key — testnet only |
| `AGENT_POLL_INTERVAL_MS` | no | `10000` | 1000..60000 |
| `AGENT_LOG_DIR` | no | `./logs` | JSONL log directory |
| `AGENT_DB_PATH` | no | `./.data/state.sqlite` | better-sqlite3 file |
| `AGENT_HTTP_PORT` | no | `8787` | HTTP port |
| `AGENT_ADMIN_SECRET` | yes | dev | bearer for `/config` |
| `AGENT_LOG_RETENTION_DAYS` | no | `7` | rotation policy |
| `AGENT_TRACKED_USERS` | no | unset | comma-separated addresses to always watch |
| `AGENT_START_BLOCK` | no | `0` | indexer start block (`0` ⇒ use lookback) |
| `AGENT_LOG_LOOKBACK` | no | `50000` | blocks scanned back on a cold start |
| `AGENT_LOG_CHUNK` | no | `9000` | per-`getLogs` span (RPC range cap) |
| `NVIDIA_API_KEY` | recommended | unset | NVIDIA NIM key; enables LLM alert copy |
| `NIM_MODELS` | no | `llama-3.3-70b…,qwen3.5…,kimi-k2.6` | ordered NIM fallback chain |
| `NIM_TIMEOUT_MS` | no | `12000` | per-model attempt timeout (cold-start guard) |
| `ANTHROPIC_API_KEY` | optional | unset | cross-provider fallback; also NL `/config` |
| `LLM_MODEL` | no | `claude-haiku-4-5` | Anthropic model id |
| `LOG_LEVEL` | no | `info` | pino level |

## Action log rotation

JSONL files are named `actions-YYYY-MM-DD.jsonl` in `AGENT_LOG_DIR`. Rotation
happens lazily on the first append after a UTC-day boundary. Files older
than `AGENT_LOG_RETENTION_DAYS` are unlinked at the same time. Per TDD §4.7,
the `GET /actions` endpoint caps `limit` at 200.

## Overriding config

Config is owned by the `agent_config` SQLite row. To override:

- **Quickly during dev**: edit defaults in `src/config.ts` and restart.
- **At runtime**: `POST /config` (see above). Both structured JSON and
  natural-language text are accepted; both are validated against the same
  zod schema (`agentConfigSchema`). Invalid input does **not** mutate state.

## Vibekit decision

Per TDD §4.5 the agent is supposed to register with `@emberagi/vibekit`.
That package is **not currently published to npm** (`npm view @emberagi/vibekit`
returns 404 as of 2026-05-22) and no local clone exists under `docs/`.

We ship `src/vibekit-shim.ts` — a thin module exposing the expected surface
(`registerProtocol`, `defineTool`, `LLMClient`) so the rest of the agent is
written against the real shape from TDD §4.5. When upstream lands, the shim
file is swapped for a re-export.

## Tests

`pnpm test` runs vitest. Coverage thresholds enforced in `vitest.config.ts`
(85% lines/functions, 75% branches). Tests live under `test/`.

## Production readiness checklist

- HTTP server boots and binds to `AGENT_HTTP_PORT` ✓
- JSONL logger writes, rotates daily, retains N days ✓
- SQLite migrations run on first start ✓
- Tick loop with try/catch + exponential backoff (1s → 60s) ✓
- Liquidator: pre-flight balance + gas + simulation, then send ✓
- LLM fallback: alerts work without `ANTHROPIC_API_KEY` ✓
- All `process.env` reads centralized in `src/config.ts` ✓
- `pino` everywhere — no `console.log` on hot paths ✓

## Reference

- TDD: `../TDD/TDD.md` — especially §4, §17, §20.
- PRD: `../PRD/PRD.md` — §8 agent responsibilities, §8.3 demo scenario.
- Action log contract: TDD §4.7.
- Config schema: TDD §4.6.
