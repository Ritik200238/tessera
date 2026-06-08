/**
 * Typed viem wrapper around the TesseraVault ABI (TDD §3.3).
 *
 * The ABI is the SINGLE SOURCE OF TRUTH at `shared/abis/TesseraVault.json`,
 * synced into `src/generated/vault-abi.ts` by `npm run sync:shared` (the agent
 * builds from `agent/`, which can't import `../../shared` at build time, so we
 * use a committed generated copy; CI fails on drift). We re-export it here so
 * existing importers (`import { vaultAbi } from "../vault-client.js"`) are
 * unchanged, and derive the typed contract handle from it.
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
import { vaultAbi } from "./generated/vault-abi.js";

export { vaultAbi };
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
