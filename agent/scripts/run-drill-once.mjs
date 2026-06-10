/**
 * One-shot Live Drill test runner. Drives the SAME DrillOrchestrator the agent
 * service uses (from dist/), against the live chain — while the HOSTED
 * production agent performs the rescue. Verifies the whole loop end-to-end
 * before the public button is armed.
 *
 *   DRILL_PRIVATE_KEY=... DRILL_ADMIN_KEY=... node scripts/run-drill-once.mjs
 */
import { createPublicClient, http } from "viem";
import { DrillOrchestrator } from "../dist/drill/orchestrator.js";

const RPC = process.env.RPC_URL ?? "https://sepolia-rollup.arbitrum.io/rpc";
const need = (k) => {
  const v = process.env[k];
  if (!v) {
    console.error(`missing env ${k}`);
    process.exit(1);
  }
  return v;
};

const drill = new DrillOrchestrator({
  publicClient: createPublicClient({ transport: http(RPC) }),
  vaultAddress: process.env.VAULT_ADDRESS ?? "0x72adaa00e2eaa98f62ee1c77e9b7714e0db57ba7",
  oracleAddress: need("ORACLE_ADDRESS"),
  usdcAddress: need("USDC_ADDRESS"),
  drillAsset: process.env.DRILL_ASSET ?? "0x4304f82834d2b429a48dec7a64979ca10a4ec060",
  drillKey: need("DRILL_PRIVATE_KEY"),
  adminKey: need("DRILL_ADMIN_KEY"),
  rpcUrl: RPC,
  log: { tail: () => [] }, // local runner has no shared log; rescue verified via debt
});

if (!drill.start()) {
  console.error("drill refused to start (lock/cooldown)");
  process.exit(1);
}
const t0 = Date.now();
const seen = new Set();
const timer = setInterval(() => {
  const s = drill.getStatus();
  for (const step of s.steps) {
    const key = step.at + step.name;
    if (!seen.has(key)) {
      seen.add(key);
      console.log(`[${Math.round((Date.now() - t0) / 1000)}s] ${step.name}: ${step.detail}${step.tx ? ` (${step.tx})` : ""}`);
    }
  }
  if (s.state === "saved" || s.state === "failed") {
    console.log("FINAL:", s.state, s.error ?? "", "HF:", s.hf, "debt:", s.debt);
    clearInterval(timer);
    process.exit(s.state === "saved" ? 0 : 2);
  }
}, 2000);
