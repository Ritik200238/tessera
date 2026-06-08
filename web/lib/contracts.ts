import { erc20Abi, type Abi, type Address } from "viem";
import { addresses } from "./addresses";

/**
 * Vault ABI — SINGLE SOURCE OF TRUTH is the Stylus export at
 * `shared/abis/TesseraVault.json` (regenerated on every contract change via
 * `cargo stylus export-abi`). We load that file and nothing else: a missing or
 * malformed ABI is a HARD error, never a silent fall back to a hand-written
 * copy. (The old fallback drifted — it declared `healthFactor` /
 * `collateralValueUsd`, which the deployed contract does not expose — so a
 * missing JSON would have silently mis-encoded every read.)
 */
function loadCanonicalAbi(): Abi {
  let json: unknown;
  try {
    // `require` (not a static JSON import) keeps Next/Turbopack happy and
    // matches lib/addresses.ts; the path is relative to this file.
    json = require("../../shared/abis/TesseraVault.json");
  } catch {
    throw new Error(
      "[tessera/contracts] shared/abis/TesseraVault.json not found. " +
        "Re-export the Stylus ABI (`cargo stylus export-abi`) into shared/abis/.",
    );
  }
  if (Array.isArray(json)) return json as Abi;
  if (json && typeof json === "object" && Array.isArray((json as { abi?: unknown }).abi)) {
    return (json as { abi: Abi }).abi;
  }
  throw new Error(
    "[tessera/contracts] shared/abis/TesseraVault.json is malformed (expected an ABI array).",
  );
}

export const vaultAbi: Abi = loadCanonicalAbi();
export const usdcAbi = erc20Abi;
export const erc20StockAbi = erc20Abi;

export interface VaultRef {
  address: Address | null;
  abi: Abi;
}

export const vault: VaultRef = {
  address: addresses.vault,
  abi: vaultAbi,
};

export function isVaultDeployed(): boolean {
  return addresses.vault !== null;
}

/** Minimal MockOracle surface used by the Status page to read price freshness. */
export const oracleAbi = [
  { type: "function", name: "maxAge", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "DECIMALS", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  {
    type: "function",
    name: "getFeed",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "answer", type: "int256" },
      { name: "updatedAt", type: "uint64" },
      { name: "roundId", type: "uint80" },
      { name: "initialized", type: "bool" },
    ],
  },
] as const satisfies Abi;

export const oracle: { address: Address | null; abi: Abi } = {
  address: addresses.oracle,
  abi: oracleAbi,
};

/** Testnet Faucet — mints a fixed bundle of test USDC + stocks per address. */
export const faucetAbi = [
  { type: "function", name: "drip", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "cooldown", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "nextDripAt",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const satisfies Abi;

export const faucet: { address: Address | null; abi: Abi } = {
  address: addresses.faucet,
  abi: faucetAbi,
};

export function isFaucetAvailable(): boolean {
  return addresses.faucet !== null;
}
