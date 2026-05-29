import { erc20Abi, type Abi, type Address } from "viem";
import { addresses } from "./addresses";

/**
 * Vault ABI.
 *
 * Source of truth is the Stylus contract — `cargo stylus export-abi`
 * writes the canonical ABI to `shared/abis/TesseraVault.json`. We try to
 * import that file at build time; if it isn't present yet (week 1 day 1
 * we don't have one), we fall back to a hand-derived ABI of the public
 * interface defined in TDD §3.3 so the UI can still type-check and
 * function-encode every call.
 *
 * If/when the export drifts, the imported JSON wins and the fallback is
 * ignored.
 */

const fallbackVaultAbi = [
  // ===== ERC-4626 (lender side, USDC) =====
  { type: "function", name: "asset", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "totalAssets", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "convertToShares",
    stateMutability: "view",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "convertToAssets",
    stateMutability: "view",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  // ===== Borrower side =====
  {
    type: "function",
    name: "depositCollateral",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawCollateral",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "borrow",
    stateMutability: "nonpayable",
    inputs: [{ name: "usdcAmount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "repay",
    stateMutability: "nonpayable",
    inputs: [{ name: "usdcAmount", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  // ===== Liquidation =====
  {
    type: "function",
    name: "liquidate",
    stateMutability: "nonpayable",
    inputs: [
      { name: "borrower", type: "address" },
      { name: "repayAmount", type: "uint256" },
      { name: "collateralToken", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  // ===== Views =====
  {
    type: "function",
    name: "healthFactor",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "collateralValueUsd",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "debtOf",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  { type: "function", name: "utilizationBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "borrowRateBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "supplyRateBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  // ===== Admin =====
  { type: "function", name: "pause", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "unpause", stateMutability: "nonpayable", inputs: [], outputs: [] },
  // ===== Events (subset used by UI) =====
  {
    type: "event",
    name: "Deposit",
    inputs: [
      { name: "asset", type: "address", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "shares", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Borrow",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "newPrincipal", type: "uint256", indexed: false },
      { name: "newIndex", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Liquidate",
    inputs: [
      { name: "borrower", type: "address", indexed: true },
      { name: "liquidator", type: "address", indexed: true },
      { name: "repayAmount", type: "uint256", indexed: false },
      { name: "collateralToken", type: "address", indexed: true },
      { name: "seizeAmount", type: "uint256", indexed: false },
    ],
  },
] as const satisfies Abi;

/**
 * Attempt to load the canonical exported ABI. The `require` resolution is
 * wrapped so a missing file is non-fatal during early development.
 */
function loadCanonicalAbi(): Abi | null {
  try {
    const json = require("../../shared/abis/TesseraVault.json") as unknown;
    if (Array.isArray(json)) return json as Abi;
    if (
      json &&
      typeof json === "object" &&
      "abi" in (json as Record<string, unknown>) &&
      Array.isArray((json as { abi: unknown }).abi)
    ) {
      return (json as { abi: Abi }).abi;
    }
    return null;
  } catch {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[tessera/contracts] shared/abis/TesseraVault.json not found — " +
          "using the hand-derived fallback ABI from TDD §3.3. Run " +
          "`cargo stylus export-abi` and place the result in shared/abis/.",
      );
    }
    return null;
  }
}

export const vaultAbi: Abi = loadCanonicalAbi() ?? fallbackVaultAbi;
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
