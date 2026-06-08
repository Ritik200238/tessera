# Hosting the Tessera Risk Agent

The agent is a **24/7 worker**. While it's down, opted-in positions are not being
watched and auto-repay/liquidation won't fire — so host it somewhere always-on with
a persistent volume and an uptime monitor. This guide uses **Fly.io** (`fly.toml`
included), but the Docker image runs anywhere (Railway, Render, a VM, k8s).

## What the agent needs

- **Always-on** — never scale-to-zero (`auto_stop_machines = false`). A stopped agent = unprotected users.
- **A persistent volume** at `/data` — SQLite state (idempotency, the durable borrower set, the indexer checkpoint) and JSONL logs must survive restarts, or the agent re-scans and can re-alert on restart.
- **Secrets** (never bake into the image) — at minimum the agent key, RPC, and addresses (below).
- **A public URL** — the web app reads `/health`, `/actions`, `/alerts/latest` from it via `NEXT_PUBLIC_AGENT_URL`.

## Required environment / secrets

| Var | Notes |
|---|---|
| `AGENT_PRIVATE_KEY` | Hot key for the agent address (the vault's `setAgent`). **Secret.** Fund with a little ETH for gas + USDC float for auto-repay. |
| `RPC_URL` | Arbitrum Sepolia RPC. |
| `CHAIN_ID` | `421614` (Arb Sepolia). |
| `VAULT_ADDRESS` | From `shared/addresses/testnet.json`. |
| `USDC_ADDRESS` | From `shared/addresses/testnet.json`. |
| `AGENT_ADMIN_SECRET` | Bearer for `/config`, `/metrics`, `/alerts`. **No insecure default in prod — the agent refuses to boot with the dev default.** |
| `AGENT_CORS_ORIGINS` | Your web origin(s), comma-separated (e.g. `https://tessera-web-delta.vercel.app`). |
| `NVIDIA_API_KEY` / `ANTHROPIC_API_KEY` | LLM alert copy (optional — falls back to deterministic templates). |
| `AGENT_INCIDENT_WEBHOOK_URL` | Discord/Slack webhook for on-call comms (agent online/stopping, tick loop failing/recovered). Optional but recommended. |

`AGENT_DB_PATH`, `AGENT_LOG_DIR`, `AGENT_HTTP_PORT` are pre-set in `fly.toml` to the volume.

## Deploy to Fly.io

```bash
# one-time
fly launch --no-deploy --copy-config        # uses fly.toml; pick an app name/region
fly volumes create tessera_agent_data --size 1 --region iad

# secrets (never commit these)
fly secrets set \
  AGENT_PRIVATE_KEY=0x... \
  RPC_URL=https://sepolia-rollup.arbitrum.io/rpc \
  VAULT_ADDRESS=0x72adaa00e2eaa98f62ee1c77e9b7714e0db57ba7 \
  USDC_ADDRESS=0xf10aCF61b480c24102B303ebAFB97d9392d693F2 \
  AGENT_ADMIN_SECRET=$(openssl rand -hex 24) \
  AGENT_CORS_ORIGINS=https://tessera-web-delta.vercel.app \
  NVIDIA_API_KEY=nvapi-... \
  AGENT_INCIDENT_WEBHOOK_URL=https://discord.com/api/webhooks/...

fly deploy
fly logs        # watch it boot, index users, and start ticking
```

## Deploy to Railway (the CLI is already installed here)

The repo ships `agent/railway.json` (Dockerfile build + `/health` check + auto-restart),
and the agent honours Railway's injected `PORT`.

```bash
railway login                       # interactive (browser) — only you can do this
cd agent
railway init                        # create a project (or `railway link` to an existing one)
# In the Railway dashboard set the service Root Directory to `agent` (monorepo),
# so railway.json + Dockerfile are picked up.

# Non-secret variables (safe in a shell):
railway variables \
  --set "NODE_ENV=production" \
  --set "CHAIN_ID=421614" \
  --set "RPC_URL=https://sepolia-rollup.arbitrum.io/rpc" \
  --set "VAULT_ADDRESS=0x72adaa00e2eaa98f62ee1c77e9b7714e0db57ba7" \
  --set "USDC_ADDRESS=0xf10aCF61b480c24102B303ebAFB97d9392d693F2" \
  --set "AGENT_CORS_ORIGINS=https://tessera-web-delta.vercel.app"

# SECRETS — set in the Railway dashboard → Variables (never paste keys in a shared shell):
#   AGENT_PRIVATE_KEY            (the key for the agent address 0x7Dfe…9ee9)
#   AGENT_ADMIN_SECRET           (a strong random string)
#   NVIDIA_API_KEY               (optional — LLM alert copy)
#   AGENT_INCIDENT_WEBHOOK_URL   (optional — Discord/Slack)

railway up                          # build + deploy
railway domain                      # generate the public URL
railway logs                        # watch it boot, index users, tick
```

Optional: add a Railway **Volume** mounted at `/data` for persistent SQLite state
(without it the agent re-scans from the lookback window after each redeploy — harmless,
just less efficient).

## Local Docker (smoke test)

```bash
docker build -t tessera-agent ./agent
docker run --rm --env-file ./agent/.env -p 8787:8787 -v tessera_data:/data tessera-agent
curl localhost:8787/health    # { ok: true, ... } once it has ticked
```

## After it's live

1. On-chain, point the vault at this agent's address: `setAgent(<agent address>)` (owner-only).
2. Set `NEXT_PUBLIC_AGENT_URL=https://<your-app>.fly.dev` in the web app's env and redeploy — the agent panel/feed flips from **Offline** to live.
3. Add an external uptime monitor on `/health` (the in-process incident webhook covers degradation, but a crash-loop needs an outside watcher).

## HTTP endpoints (and who consumes each)

The agent exposes one HTTP surface. Public endpoints feed the web app; the
bearer-gated ones are **operational** surfaces (consumed by monitoring + on-call,
deliberately NOT in the public UI — they leak float / distressed-position data).

| Endpoint | Auth | Consumed by |
|---|---|---|
| `GET /` | public | liveness ping |
| `GET /health` | public | uptime monitor + the web dashboard/status "agent" cards |
| `GET /actions` | public | the web `/agent` + `/transparency` activity feeds |
| `GET /alerts/latest` | bearer (`AGENT_ADMIN_SECRET`) | on-call: current at-risk snapshot (`curl -H "authorization: Bearer …"`); push alerts go via `AGENT_INCIDENT_WEBHOOK_URL` |
| `GET /metrics` | bearer | Prometheus / Grafana / Fly metrics scrape (set your scraper's bearer token) |
| `POST /config` | bearer | the web admin panel, via its server-side `/api/agent/config` proxy |

So `/alerts/latest` and `/metrics` are not dead — they're the on-call + metrics
surfaces. Point your Prometheus scrape and on-call tooling at them once hosted.

## Operating notes

- **Key rotation / compromise:** see `SECURITY.md` — `setAgent(0x0)` is the on-chain kill switch.
- **State reset:** deleting the volume re-scans from the lookback window and rebuilds the borrower set; idempotency history is lost, so a restart can re-emit alerts. Prefer keeping the volume.
- **Scaling:** one machine is correct for the MVP (the tick loop is single-writer over SQLite). Do **not** run two replicas against the same key — they'd double-submit.
