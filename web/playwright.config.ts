import { defineConfig } from "@playwright/test";

/**
 * E2E config for the human-like web3 suite (AI_WEB3_TESTING_GUIDE §10).
 * Sequential + single worker so on-chain nonces/balances stay deterministic
 * across the multi-persona contexts. Video always on; trace on failure.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 240_000, // testnet RPC + confirmations are slow
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: "./e2e/.artifacts/results",
  use: {
    baseURL: "http://localhost:3000",
    video: "on",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1280, height: 800 },
    actionTimeout: 30_000,
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 180_000,
    // Point the local dev server at the hosted agent so the activity feed is live.
    env: { NEXT_PUBLIC_AGENT_URL: "https://tessera-agent-k1rt.onrender.com" },
  },
});
