/**
 * Tessera oracle price keeper — cross-platform (Node), hostable anywhere.
 *
 * Plays Chainlink's role on testnet: re-stamps each MockOracle feed on an
 * interval so vault reads stay fresh (reads revert past the staleness window,
 * by design). Last-close equity prices come from shared/addresses/testnet.json.
 *
 * Run locally:   node scripts/keeper.mjs
 * One-shot:      node scripts/keeper.mjs --once
 * Host it (Railway/Render/Fly/cron) with these env vars:
 *   RPC_URL              (default https://sepolia-rollup.arbitrum.io/rpc)
 *   KEEPER_PRIVATE_KEY   oracle owner key (falls back to DEPLOYER_PRIVATE_KEY)
 *   KEEPER_INTERVAL_SEC  refresh cadence (default 1800)
 *   KEEPER_MAX_AGE       if set, calls setMaxAge once on start
 *   ADDR_FILE            address book (default shared/addresses/testnet.json)
 */
import { readFileSync } from "node:fs";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { validateBook } from "./validate-addresses.mjs";

const RPC = process.env.RPC_URL ?? "https://sepolia-rollup.arbitrum.io/rpc";
const PK = process.env.KEEPER_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATE_KEY;
const INTERVAL = Number(process.env.KEEPER_INTERVAL_SEC ?? "1800") * 1000;
const MAX_AGE = process.env.KEEPER_MAX_AGE ? BigInt(process.env.KEEPER_MAX_AGE) : null;
const ADDR_FILE = process.env.ADDR_FILE ?? new URL("../shared/addresses/testnet.json", import.meta.url);
const ONCE = process.argv.includes("--once");

if (!PK) {
  console.error("KEEPER_PRIVATE_KEY (or DEPLOYER_PRIVATE_KEY) is required.");
  process.exit(1);
}

const book = JSON.parse(readFileSync(ADDR_FILE, "utf8"));
if (!book.oracle) {
  console.error("No oracle address in the address book.");
  process.exit(1);
}

const ORACLE_ABI = [
  { type: "function", name: "setPrice", stateMutability: "nonpayable", inputs: [{ name: "token", type: "address" }, { name: "answer", type: "int256" }], outputs: [] },
  { type: "function", name: "setMaxAge", stateMutability: "nonpayable", inputs: [{ name: "newMaxAge", type: "uint256" }], outputs: [] },
];

const account = privateKeyToAccount(PK.startsWith("0x") ? PK : `0x${PK}`);
// CHAIN_ID must match the RPC's chain (EIP-155): 421614 = Arbitrum Sepolia,
// 46630 = Robinhood Chain. A mismatch makes the node reject every signed tx.
const CHAIN_ID = Number(process.env.CHAIN_ID ?? "421614");
const chain = { id: CHAIN_ID, name: process.env.CHAIN_NAME ?? "tessera-keeper-chain", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } };
const wallet = createWalletClient({ account, chain, transport: http(RPC) });
const pub = createPublicClient({ chain, transport: http(RPC) });

/** Structured one-line JSON log (greppable, machine-parseable for the watchdog). */
function jlog(fields) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...fields }));
}

async function send(functionName, args) {
  const hash = await wallet.writeContract({ address: book.oracle, abi: ORACLE_ABI, functionName, args });
  const rcpt = await pub.waitForTransactionReceipt({ hash });
  return { ok: rcpt.status === "success", hash, gasUsed: rcpt.gasUsed?.toString() };
}

/**
 * Re-stamp every feed. PER-TOKEN error isolation: one token's revert / nonce
 * collision / RPC blip must NOT abort the whole refresh and leave later tokens
 * unstamped (which would let them age past the staleness window and freeze the
 * vault). Returns counts so the loop + watchdog can see partial failures.
 */
async function refresh() {
  let ok = 0;
  let failed = 0;
  for (const t of book.collateralTokens ?? []) {
    const price = BigInt(t.priceUsd8);
    try {
      const r = await send("setPrice", [t.address, price]);
      if (r.ok) {
        ok += 1;
        jlog({ evt: "setPrice", token: t.symbol, address: t.address, priceUsd8: t.priceUsd8, status: "ok", tx: r.hash, gasUsed: r.gasUsed });
      } else {
        failed += 1;
        jlog({ evt: "setPrice", token: t.symbol, address: t.address, priceUsd8: t.priceUsd8, status: "reverted", tx: r.hash });
      }
    } catch (e) {
      failed += 1;
      jlog({ evt: "setPrice", token: t.symbol, address: t.address, priceUsd8: t.priceUsd8, status: "error", error: e?.shortMessage ?? e?.message ?? String(e) });
    }
  }
  jlog({ evt: "refresh", ok, failed, total: ok + failed });
  return { ok, failed };
}

// Startup gate: refuse to run against a scrambled / mis-wired address book.
// (Errors fail; stale-feed warnings are expected before the first stamp.)
if (process.env.SKIP_ADDRESS_VALIDATION !== "1") {
  const v = await validateBook(book, pub);
  for (const w of v.warnings) jlog({ evt: "validate", level: "warn", msg: w });
  if (!v.ok) {
    for (const e of v.errors) jlog({ evt: "validate", level: "error", msg: e });
    jlog({ evt: "exit", status: "error", reason: "address-book validation failed" });
    process.exit(1);
  }
  jlog({ evt: "validate", status: "ok" });
}

if (MAX_AGE) {
  try {
    const r = await send("setMaxAge", [MAX_AGE]);
    jlog({ evt: "setMaxAge", maxAge: MAX_AGE.toString(), status: r.ok ? "ok" : "reverted", tx: r.hash });
  } catch (e) {
    jlog({ evt: "setMaxAge", maxAge: MAX_AGE.toString(), status: "error", error: e?.shortMessage ?? e?.message ?? String(e) });
  }
}
const first = await refresh();
// One-shot mode (CI/GHA): exit non-zero if NOTHING got stamped, so a fully
// broken run fails the job loudly instead of looking green.
if (ONCE && first.ok === 0) {
  jlog({ evt: "exit", status: "error", reason: "no feeds stamped" });
  process.exit(1);
}

if (!ONCE) {
  jlog({ evt: "loop_start", intervalSec: INTERVAL / 1000 });
  setInterval(() => {
    refresh().catch((e) => jlog({ evt: "refresh", status: "error", error: e?.message ?? String(e) }));
  }, INTERVAL);
}
