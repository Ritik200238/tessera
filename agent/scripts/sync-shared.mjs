#!/usr/bin/env node
/**
 * Sync the agent's local copies of the shared ABI + address book from the
 * monorepo source of truth (`shared/`), so the agent can never silently drift
 * from what the web and the deployed contract use.
 *
 * Why generate instead of import: the agent is built/deployed from its own
 * directory (Docker build context = `agent/`), so it cannot import
 * `../../shared` at build time. We therefore GENERATE committed TypeScript
 * copies under `src/generated/` and the agent imports those. Run after changing
 * the shared ABI/addresses; CI runs `--check` to fail the build on drift.
 *
 *   node scripts/sync-shared.mjs          # regenerate the committed copies
 *   node scripts/sync-shared.mjs --check  # exit 1 if the committed copies are stale
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const abiPath = join(repoRoot, "shared", "abis", "TesseraVault.json");
const addrPath = join(repoRoot, "shared", "addresses", "testnet.json");
const outDir = join(here, "..", "src", "generated");

// getHealthFactor / getAccountData / getSafetyScore are `nonpayable` in the
// canonical ABI (they lazily accrue interest when sent as a tx), but the agent
// only ever READS them via eth_call. Force them to `view` so viem's typed
// readContract/multicall accepts them.
const READ_AS_VIEW = new Set(["getHealthFactor", "getAccountData", "getSafetyScore"]);

const HEADER = (src) =>
  `// AUTO-GENERATED from ${src} by scripts/sync-shared.mjs — DO NOT EDIT BY HAND.\n` +
  `// Run \`npm run sync:shared\` after changing the shared file; CI fails on drift.\n\n`;

function buildAbiTs() {
  const raw = JSON.parse(readFileSync(abiPath, "utf8"));
  const list = Array.isArray(raw) ? raw : raw.abi;
  const abi = list.map((item) =>
    item.type === "function" && READ_AS_VIEW.has(item.name) && item.stateMutability === "nonpayable"
      ? { ...item, stateMutability: "view" }
      : item,
  );
  return (
    HEADER("shared/abis/TesseraVault.json") +
    `// (getHealthFactor/getAccountData/getSafetyScore forced to \`view\` — read via eth_call.)\n` +
    `export const vaultAbi = ${JSON.stringify(abi, null, 2)} as const;\n`
  );
}

function buildAddrTs() {
  const addr = JSON.parse(readFileSync(addrPath, "utf8"));
  return HEADER("shared/addresses/testnet.json") + `export const sharedAddresses = ${JSON.stringify(addr, null, 2)} as const;\n`;
}

const targets = [
  { file: join(outDir, "vault-abi.ts"), content: buildAbiTs() },
  { file: join(outDir, "shared-addresses.ts"), content: buildAddrTs() },
];

const check = process.argv.includes("--check");
const norm = (s) => s.replace(/\r\n/g, "\n"); // ignore git's CRLF on Windows checkouts
let drift = false;

if (!check) mkdirSync(outDir, { recursive: true });

for (const { file, content } of targets) {
  let current = "";
  try {
    current = readFileSync(file, "utf8");
  } catch {
    /* missing → treated as drift in check mode, written in sync mode */
  }
  if (check) {
    if (norm(current) !== content) {
      drift = true;
      console.error(`[sync-shared] OUT OF SYNC: ${file}`);
    }
  } else {
    writeFileSync(file, content);
    console.log(`[sync-shared] wrote ${file}`);
  }
}

if (check) {
  if (drift) {
    console.error("[sync-shared] generated files are stale — run `npm run sync:shared` and commit.");
    process.exit(1);
  }
  console.log("[sync-shared] in sync.");
}
