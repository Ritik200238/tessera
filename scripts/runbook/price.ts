#!/usr/bin/env tsx
/**
 * Runbook: update a MockOracle price feed.
 *
 * Usage:
 *   pnpm runbook:price --token=tAAPL --usd=200
 *   pnpm runbook:price --token=tAAPL --usd=199.50
 *
 * Reads the MockOracle and token addresses from `shared/addresses/local.json`,
 * builds a typed `setPrice` call via viem, and submits it from `DEPLOYER_PRIVATE_KEY`.
 *
 * The `--usd` value is decimal dollars. We multiply by 1e8 (Chainlink convention,
 * matching `MockOracle.DECIMALS`) before sending. Fractional cents below 1e-8 are
 * truncated.
 *
 * See TDD §16.1 for the operator runbook this script implements.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  isAddress,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "../..");

loadEnv({ path: resolve(REPO_ROOT, ".env") });

type CollateralToken = { symbol: string; address: string; priceUsd8?: number | string };
type AddressesFile = {
  vault: string | null;
  usdc: string | null;
  oracle: string | null;
  collateralTokens: CollateralToken[];
};

type Args = { token: string; usd: string };

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = {};
  for (const raw of argv) {
    const m = raw.match(/^--([^=]+)=(.*)$/);
    if (!m) continue;
    const [, key, value] = m;
    if (key === "token" || key === "usd") {
      args[key] = value;
    }
  }
  if (!args.token || !args.usd) {
    throw new Error("Usage: pnpm runbook:price --token=<SYMBOL> --usd=<DECIMAL>");
  }
  return args as Args;
}

/** Convert a decimal dollar string (e.g. "199.50") to a BigInt at 1e8 precision. */
function usdToScaled8(input: string): bigint {
  if (!/^\d+(\.\d+)?$/.test(input)) {
    throw new Error(`Invalid --usd value: ${input}`);
  }
  const [wholePart, fracPartRaw = ""] = input.split(".");
  const frac = (fracPartRaw + "00000000").slice(0, 8); // pad / truncate to 8 decimals
  const scaled = BigInt(wholePart) * 100_000_000n + BigInt(frac);
  if (scaled <= 0n) throw new Error("Price must be > 0");
  return scaled;
}

function loadAddresses(): AddressesFile {
  const path = resolve(REPO_ROOT, "shared/addresses/local.json");
  const parsed = JSON.parse(readFileSync(path, "utf8")) as AddressesFile;
  return parsed;
}

const ORACLE_ABI = parseAbi([
  "function setPrice(address token, int256 answer) external",
  "function priceUsd8(address token) external view returns (uint256)",
]);

async function main() {
  const { token, usd } = parseArgs(process.argv.slice(2));
  const addrs = loadAddresses();

  const tokens = addrs.collateralTokens ?? [];
  const entry = tokens.find((t) => t.symbol.toLowerCase() === token.toLowerCase());
  if (!entry || !isAddress(entry.address)) {
    const avail = tokens.map((t) => t.symbol).join(", ") || "(none — has the deploy script run?)";
    throw new Error(`Token ${token} not found in shared/addresses/local.json. Available: ${avail}`);
  }
  const tokenAddress = entry.address as Address;
  const oracleAddress = addrs.oracle as Address | null;
  if (!oracleAddress || !isAddress(oracleAddress) || oracleAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("Oracle address missing in shared/addresses/local.json — has the deploy script run?");
  }

  const scaled = usdToScaled8(usd);

  const rpc = process.env.RPC_URL_LOCAL ?? "http://127.0.0.1:8545";
  const pk = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY must be set in .env");

  const account = privateKeyToAccount(pk);
  const wallet = createWalletClient({ account, transport: http(rpc) });
  const pub = createPublicClient({ transport: http(rpc) });

  console.log(`[runbook:price] ${token} (${tokenAddress}) → $${usd} (scaled ${scaled})`);
  console.log(`[runbook:price] oracle=${oracleAddress} signer=${account.address}`);

  const hash = await wallet.writeContract({
    address: oracleAddress,
    abi: ORACLE_ABI,
    functionName: "setPrice",
    args: [tokenAddress as Address, scaled],
    chain: null,
  });
  console.log(`[runbook:price] submitted tx ${hash}`);

  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`tx reverted: ${hash}`);
  }
  const onchain = await pub.readContract({
    address: oracleAddress,
    abi: ORACLE_ABI,
    functionName: "priceUsd8",
    args: [tokenAddress as Address],
  });
  console.log(`[runbook:price] confirmed in block ${receipt.blockNumber} — on-chain price now ${onchain}`);
}

main().catch((err) => {
  console.error(`[runbook:price] ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
