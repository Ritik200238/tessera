import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes, type Hex } from "viem";

/**
 * Deterministic test personas (TESTNET ONLY — Arbitrum Sepolia, mock assets).
 * Keys are DERIVED at runtime from fixed labels (keccak256(utf8("tessera-e2e-
 * <name>-v2"))) so addresses / tx hashes / share URLs are identical across runs
 * and NO private key is committed to the repo. These wallets hold only worthless
 * mock USDC/stocks + a little Sepolia ETH for gas. NEVER fund these on mainnet.
 */
export const RPC_URL = "https://sepolia-rollup.arbitrum.io/rpc";
export const CHAIN_ID = 421614;

export interface Persona {
  name: string;
  key: Hex;
  address: Hex;
  role: string;
}

const deriveKey = (label: string): Hex => keccak256(toBytes(label));

function mk(name: string, label: string, role: string): Persona {
  const key = deriveKey(label);
  return { name, key, address: privateKeyToAccount(key).address, role };
}

export const personas = {
  alice: mk("Alice", "tessera-e2e-alice-v2", "lender"),
  bob: mk("Bob", "tessera-e2e-bob-v2", "borrower"),
  carol: mk("Carol", "tessera-e2e-carol-v2", "borrower-2"),
} as const;

export type PersonaKey = keyof typeof personas;
