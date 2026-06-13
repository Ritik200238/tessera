/**
 * Market-hours driver — flips PriceGuard.setMarketClosed on the on-chain feed so
 * the vault's weekend/overnight LTV haircut actually engages. Without this nothing
 * ever calls setMarketClosed, so market_closed stays permanently false and a user
 * can max-LTV borrow against a stale last-close price right before a Monday gap
 * (gap risk borne 100% by lenders). See rulbookImprvmnts.md #8.
 *
 * Approximation (testnet): OPEN iff a weekday AND 14:30 <= UTC < 21:00. This
 * covers NYSE 9:30-16:00 ET and ERRS TOWARD CLOSED (haircut ON) during EDT and
 * around the edges — the conservative, safe direction. Holiday calendar is out of
 * scope for testnet (it would just leave the haircut ON, which is safe).
 *
 * Idempotent: reads marketClosed() first and only sends a tx when it must change.
 *
 * CLI:  RPC_URL=.. CHAIN_ID=.. ADDR_FILE=.. KEEPER_PRIVATE_KEY=..  node scripts/market-hours.mjs
 */
import { readFileSync } from "node:fs";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = process.env.RPC_URL ?? "https://rpc.testnet.chain.robinhood.com/rpc";
const CHAIN_ID = Number(process.env.CHAIN_ID ?? "46630");
const PK = process.env.KEEPER_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATE_KEY;
const ADDR_FILE = process.env.ADDR_FILE ?? new URL("../shared/addresses/robinhood.json", import.meta.url);

const jlog = (f) => console.log(JSON.stringify({ ts: new Date().toISOString(), ...f }));

if (!PK) { jlog({ level: "error", msg: "KEEPER_PRIVATE_KEY (or DEPLOYER_PRIVATE_KEY) required" }); process.exit(1); }
const book = JSON.parse(readFileSync(ADDR_FILE, "utf8"));
if (!book.priceguard) { jlog({ level: "error", msg: "no priceguard in address book" }); process.exit(1); }

/** NYSE regular session, approximated in UTC, erring toward CLOSED (safe). */
function isMarketOpenUtc(d) {
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  if (day === 0 || day === 6) return false;
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  return mins >= 14 * 60 + 30 && mins < 21 * 60; // 14:30–21:00 UTC
}

const PG_ABI = [
  { type: "function", name: "marketClosed", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "setMarketClosed", stateMutability: "nonpayable", inputs: [{ name: "value", type: "bool" }], outputs: [] },
];

const account = privateKeyToAccount(PK.startsWith("0x") ? PK : `0x${PK}`);
const chain = { id: CHAIN_ID, name: "tessera-market-hours", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } };
const wallet = createWalletClient({ account, chain, transport: http(RPC) });
const pub = createPublicClient({ chain, transport: http(RPC) });

const open = isMarketOpenUtc(new Date());
const wantClosed = !open;
try {
  const isClosed = await pub.readContract({ address: book.priceguard, abi: PG_ABI, functionName: "marketClosed" });
  if (isClosed === wantClosed) {
    jlog({ evt: "market-hours", open, marketClosed: isClosed, action: "noop" });
    process.exit(0);
  }
  const hash = await wallet.writeContract({ address: book.priceguard, abi: PG_ABI, functionName: "setMarketClosed", args: [wantClosed] });
  await pub.waitForTransactionReceipt({ hash });
  jlog({ evt: "market-hours", open, setMarketClosed: wantClosed, tx: hash, action: "changed" });
} catch (e) {
  jlog({ evt: "market-hours", level: "error", error: e?.shortMessage ?? e?.message ?? String(e) });
  process.exit(1);
}
