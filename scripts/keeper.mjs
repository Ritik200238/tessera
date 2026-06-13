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

async function send(functionName, args) {
  const hash = await wallet.writeContract({ address: book.oracle, abi: ORACLE_ABI, functionName, args });
  const rcpt = await pub.waitForTransactionReceipt({ hash });
  return rcpt.status === "success";
}

async function refresh() {
  const stamp = new Date().toISOString();
  for (const t of book.collateralTokens ?? []) {
    const ok = await send("setPrice", [t.address, BigInt(t.priceUsd8)]);
    console.log(`[${stamp}] setPrice ${t.symbol} = $${(Number(t.priceUsd8) / 1e8).toFixed(2)} -> ${ok ? "ok" : "REVERT"}`);
  }
}

if (MAX_AGE) {
  console.log(`Setting oracle maxAge = ${MAX_AGE}s`);
  await send("setMaxAge", [MAX_AGE]);
}
await refresh();

if (!ONCE) {
  console.log(`Keeper loop started; refreshing every ${INTERVAL / 1000}s. Ctrl+C to stop.`);
  setInterval(() => {
    refresh().catch((e) => console.error("refresh failed:", e.message));
  }, INTERVAL);
}
