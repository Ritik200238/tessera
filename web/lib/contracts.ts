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

/**
 * TesseraLens — the read-only data provider (`contracts/crates/lens`). The
 * ERC-4626 quoting (`convertToShares`/`convertToAssets`/`preview*`) and the
 * aggregate account views (`getAccountData`/`getSafetyScore`) moved here off the
 * funds-holding vault, so the UI reads those derived numbers from the Lens. The
 * Lens reuses the vault's raw getters + the same interest-model math, so the
 * numbers are identical. Signatures mirror the vault's old ones exactly.
 *
 * Hand-written (`as const satisfies Abi`) like `oracleAbi`/`faucetAbi`: the
 * Stylus `export-abi` path needs `solc`, which isn't in CI, and these few
 * signatures are stable. Regenerate from `cargo stylus export-abi` when solc is
 * available.
 */
export const lensAbi = [
  {
    type: "function",
    name: "getAccountData",
    stateMutability: "nonpayable",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
  },
  {
    type: "function",
    name: "getHealthFactor",
    stateMutability: "nonpayable",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getSafetyScore",
    stateMutability: "nonpayable",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "convertToAssets",
    stateMutability: "nonpayable",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "convertToShares",
    stateMutability: "nonpayable",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "previewRedeem",
    stateMutability: "nonpayable",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
] as const satisfies Abi;

export const lens: { address: Address | null; abi: Abi } = {
  address: addresses.lens,
  abi: lensAbi,
};

export function isLensDeployed(): boolean {
  return addresses.lens !== null;
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
