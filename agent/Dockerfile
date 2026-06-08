# Tessera Risk Agent — production image.
#
# Multi-stage: the builder compiles the native better-sqlite3 binding and the
# TypeScript; the runtime is a slim, non-root image carrying only prod deps +
# the compiled output. Build context is the agent/ directory.
#
#   docker build -t tessera-agent ./agent
#   docker run --env-file ./agent/.env -p 8787:8787 -v tessera_data:/data tessera-agent

# ---------- builder ----------
FROM node:22-bookworm-slim AS builder
WORKDIR /app
# better-sqlite3 compiles a native addon → needs python3 + a C++ toolchain.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---------- runtime ----------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# State (SQLite) + JSONL logs live on a mounted volume so they survive restarts.
ENV AGENT_DB_PATH=/data/db/state.sqlite
ENV AGENT_LOG_DIR=/data/logs
ENV AGENT_HTTP_PORT=8787
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
RUN mkdir -p /data/db /data/logs && chown -R node:node /data /app
USER node
EXPOSE 8787
# Liveness: the agent's own /health endpoint (200 only while it is ticking).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||process.env.AGENT_HTTP_PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
