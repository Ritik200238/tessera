/**
 * Typed viem wrapper around the TesseraVault ABI (TDD §3.3).
 *
 * The full vault ABI is finalized in Phase 2 by Agent B. To avoid blocking
 * THIS code on that, we declare a minimal `vaultAbi` covering the surface
 * the agent uses (health, debt, collateral, liquidate). When the canonical
 * ABI lands at `shared/abis/TesseraVault.json`, this file's `vaultAbi`
 * constant becomes a JSON import and types regenerate automatically.
 */

import {
  type Account,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  http,
  getContract,
  type GetContractReturnType,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Minimal ABI subset used by the agent. Authoritative ABI lives in
 * `shared/abis/TesseraVault.json` once Phase 2 lands.
 */
export const vaultAbi = [
  {
    type: "function",
    name: "getHealthFactor",
    stateMutability: "nonpayable",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "debtOf",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getAccountData",
    stateMutability: "nonpayable",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "collateralUsd", type: "uint256" },
      { name: "debtUsd", type: "uint256" },
      { name: "healthFactor", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "liquidate",
    stateMutability: "nonpayable",
    inputs: [
      { name: "borrower", type: "address" },
      { name: "repayAmount", type: "uint256" },
      { name: "collateralToken", type: "address" },
    ],
    outputs: [{ name: "seized", type: "uint256" }],
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
    name: "Repay",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "newPrincipal", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Liquidate",
    inputs: [
      { name: "borrower", type: "address", indexed: true },
      { name: "liquidator", type: "address", indexed: true },
      { name: "repayAmount", type: "uint256", indexed: false },
      { name: "collateralToken", type: "address", indexed: false },
      { name: "seizeAmount", type: "uint256", indexed: false },
    ],
  },
] as const;

export type VaultAbi = typeof vaultAbi;

export interface VaultClients {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: Account;
  vault: GetContractReturnType<VaultAbi, { public: PublicClient; wallet: WalletClient }, Address>;
  address: Address;
}

/**
 * Build the public + wallet clients and a typed vault contract handle.
 * The caller owns the lifetime; nothing here is global.
 */
export function makeVaultClients(opts: {
  rpcUrl: string;
  chainId: number;
  vaultAddress: Address;
  privateKey: Hex;
}): VaultClients {
  const account = privateKeyToAccount(opts.privateKey);
  const chain = {
    id: opts.chainId,
    name: "tessera-chain",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [opts.rpcUrl] } },
  } as const;

  const publicClient = createPublicClient({ chain, transport: http(opts.rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(opts.rpcUrl) });

  const vault = getContract({
    address: opts.vaultAddress,
    abi: vaultAbi,
    client: { public: publicClient, wallet: walletClient },
  });

  return { publicClient, walletClient, account, vault, address: opts.vaultAddress };
}
