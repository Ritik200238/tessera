/**
 * Address-book validator + startup gate.
 *
 * The per-chain address books in shared/addresses/<chain>.json are hand-edited
 * and reuse the SAME physical addresses across chains with different role labels
 * (e.g. an address that is tTSLA on one chain is the oracle on another). A
 * keeper or agent pointed at a scrambled book reads prices/positions against the
 * wrong contracts. This module verifies a book against the live chain BEFORE any
 * keeper/agent acts, and fails fast on any mismatch.
 *
 * Checks:
 *   1. no address serves two roles within one book;
 *   2. every collateral token resolves to a contract whose on-chain symbol +
 *      decimals match the book;
 *   3. USDC resolves to a 6-decimal contract;
 *   4. the oracle returns a positive price for every listed token;
 *   5. if `priceguard` is present, it prices every token AND `vault.oracle()`
 *      equals the PriceGuard address (the whole "prices route through PriceGuard"
 *      design is false otherwise).
 *
 * CLI:   RPC_URL=.. CHAIN_ID=.. ADDR_FILE=..  node scripts/validate-addresses.mjs
 * Module: import { validateBook } from "./validate-addresses.mjs"
 */
import { readFileSync } from "node:fs";
import { createPublicClient, http, getAddress } from "viem";

const ERC20_ABI = [
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
];
const ORACLE_ABI = [
  { type: "function", name: "priceUsd8", stateMutability: "view", inputs: [{ name: "token", type: "address" }], outputs: [{ type: "uint256" }] },
];
const PRICEGUARD_ABI = [
  { type: "function", name: "getPrice", stateMutability: "nonpayable", inputs: [{ name: "token", type: "address" }], outputs: [{ type: "uint256" }] },
];
const VAULT_ABI = [
  { type: "function", name: "oracle", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
];

const eq = (a, b) => a && b && a.toLowerCase() === b.toLowerCase();

/**
 * @returns {Promise<{ok: boolean, errors: string[], warnings: string[]}>}
 */
export async function validateBook(book, publicClient) {
  const errors = [];
  const warnings = [];
  const pc = publicClient;

  // 1. no address in two roles
  const roles = [];
  const push = (role, addr) => { if (addr) roles.push({ role, addr: addr.toLowerCase() }); };
  push("vault", book.vault); push("lens", book.lens); push("priceguard", book.priceguard);
  push("usdc", book.usdc); push("oracle", book.oracle); push("faucet", book.faucet);
  for (const t of book.collateralTokens ?? []) push(`token:${t.symbol}`, t.address);
  const seen = new Map();
  for (const { role, addr } of roles) {
    if (seen.has(addr)) errors.push(`address ${addr} serves two roles: ${seen.get(addr)} AND ${role}`);
    else seen.set(addr, role);
  }

  const hasCode = async (addr) => {
    try { const c = await pc.getBytecode({ address: getAddress(addr) }); return !!c && c !== "0x"; }
    catch { return false; }
  };

  // 2. collateral tokens: contract + symbol + decimals match the book
  for (const t of book.collateralTokens ?? []) {
    if (!(await hasCode(t.address))) { errors.push(`token ${t.symbol} (${t.address}) has NO contract code`); continue; }
    try {
      const [sym, dec] = await Promise.all([
        pc.readContract({ address: getAddress(t.address), abi: ERC20_ABI, functionName: "symbol" }),
        pc.readContract({ address: getAddress(t.address), abi: ERC20_ABI, functionName: "decimals" }),
      ]);
      if (sym !== t.symbol) errors.push(`token ${t.symbol}: on-chain symbol is "${sym}" (book says "${t.symbol}") — SCRAMBLED book`);
      if (Number(dec) !== Number(t.decimals)) errors.push(`token ${t.symbol}: on-chain decimals ${dec} != book ${t.decimals}`);
    } catch (e) { errors.push(`token ${t.symbol}: symbol/decimals read failed: ${e?.shortMessage ?? e?.message}`); }
  }

  // 3. USDC: 6-decimal contract
  if (book.usdc) {
    if (!(await hasCode(book.usdc))) errors.push(`usdc (${book.usdc}) has NO contract code`);
    else {
      try {
        const dec = await pc.readContract({ address: getAddress(book.usdc), abi: ERC20_ABI, functionName: "decimals" });
        if (Number(dec) !== 6) errors.push(`usdc decimals ${dec} != 6`);
      } catch (e) { errors.push(`usdc decimals read failed: ${e?.shortMessage ?? e?.message}`); }
    }
  } else warnings.push("no usdc in book");

  // 4. oracle prices every token
  if (book.oracle) {
    for (const t of book.collateralTokens ?? []) {
      try {
        const p = await pc.readContract({ address: getAddress(book.oracle), abi: ORACLE_ABI, functionName: "priceUsd8", args: [getAddress(t.address)] });
        if (p <= 0n) errors.push(`oracle returns non-positive price for ${t.symbol}`);
      } catch (e) {
        const msg = e?.shortMessage ?? e?.message ?? String(e);
        if (/stale/i.test(msg)) warnings.push(`oracle feed for ${t.symbol} is STALE (run the keeper): ${msg}`);
        else errors.push(`oracle has no usable feed for ${t.symbol}: ${msg}`);
      }
    }
  } else warnings.push("no oracle in book");

  // 5. priceguard prices every token AND vault.oracle() == priceguard
  if (book.priceguard) {
    if (!(await hasCode(book.priceguard))) errors.push(`priceguard (${book.priceguard}) has NO contract code`);
    for (const t of book.collateralTokens ?? []) {
      try {
        const p = await pc.readContract({ address: getAddress(book.priceguard), abi: PRICEGUARD_ABI, functionName: "getPrice", args: [getAddress(t.address)] });
        if (p <= 0n) errors.push(`priceguard returns non-positive price for ${t.symbol}`);
      } catch (e) {
        const msg = e?.shortMessage ?? e?.message ?? String(e);
        if (/stale/i.test(msg)) warnings.push(`priceguard price for ${t.symbol} is STALE (run the keeper): ${msg}`);
        else errors.push(`priceguard cannot price ${t.symbol}: ${msg}`);
      }
    }
    if (book.vault) {
      try {
        const vaultOracle = await pc.readContract({ address: getAddress(book.vault), abi: VAULT_ABI, functionName: "oracle" });
        if (!eq(vaultOracle, book.priceguard)) {
          errors.push(`vault.oracle() == ${vaultOracle} but book.priceguard == ${book.priceguard} — vault is NOT routing prices through PriceGuard`);
        }
      } catch (e) { errors.push(`vault.oracle() read failed: ${e?.shortMessage ?? e?.message}`); }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ---- CLI / startup gate ----
const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("validate-addresses.mjs");
if (isMain) {
  const RPC = process.env.RPC_URL ?? "https://rpc.testnet.chain.robinhood.com/rpc";
  const CHAIN_ID = Number(process.env.CHAIN_ID ?? "46630");
  const ADDR_FILE = process.env.ADDR_FILE ?? new URL("../shared/addresses/robinhood.json", import.meta.url);
  const book = JSON.parse(readFileSync(ADDR_FILE, "utf8"));
  const chain = { id: CHAIN_ID, name: "tessera-validate", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } };
  const pc = createPublicClient({ chain, transport: http(RPC) });
  const res = await validateBook(book, pc);
  for (const w of res.warnings) console.log(JSON.stringify({ level: "warn", msg: w }));
  for (const e of res.errors) console.log(JSON.stringify({ level: "error", msg: e }));
  console.log(JSON.stringify({ level: "result", ok: res.ok, errors: res.errors.length, warnings: res.warnings.length }));
  process.exit(res.ok ? 0 : 1);
}
