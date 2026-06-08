import type { BrowserContext } from "@playwright/test";
import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { RPC_URL, CHAIN_ID } from "./personas";

/**
 * Install a REAL-key injected wallet into a browser context (guide §11A).
 *
 * The page-side provider is a thin EIP-1193 + EIP-6963 facade exposed as
 * `window.ethereum`; the actual signing + broadcasting is done Node-side by viem
 * with the persona's private key against Arbitrum Sepolia. So connect + every tx
 * are REAL on-chain actions (real hashes, real state) — not a stub. eth_* reads
 * fall through to the public RPC. There is no popup (the provider auto-approves),
 * so this proves the dApp flows; the live-extension popup is a separate concern.
 */
export async function installWallet(context: BrowserContext, key: Hex): Promise<Hex> {
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ account, chain: arbitrumSepolia, transport: http(RPC_URL) });

  // Node-side signer/sender (real viem → real Sepolia tx).
  await context.exposeFunction(
    "__tesseraSend",
    async (tx: { to: Hex; data?: Hex; value?: string; from?: string }): Promise<string> => {
      return await wallet.sendTransaction({
        to: tx.to,
        data: (tx.data ?? "0x") as Hex,
        value: tx.value ? BigInt(tx.value) : undefined,
        account,
        chain: arbitrumSepolia,
      });
    },
  );
  await context.exposeFunction(
    "__tesseraSign",
    async (method: string, params: string[]): Promise<string> => {
      if (method === "personal_sign") {
        return await wallet.signMessage({ account, message: { raw: params[0] as Hex } });
      }
      if (method === "eth_signTypedData_v4") {
        return await wallet.signTypedData({ account, ...(JSON.parse(params[1]) as object) } as never);
      }
      throw new Error(`unsupported sign method: ${method}`);
    },
  );

  await context.addInitScript(
    ({ address, rpc, chainIdHex }: { address: string; rpc: string; chainIdHex: string }) => {
      let rpcId = 1;
      const rawRpc = async (method: string, params: unknown[]) => {
        const res = await fetch(rpc, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method, params: params ?? [] }),
        });
        const j = await res.json();
        if (j.error) throw Object.assign(new Error(j.error.message), { code: j.error.code });
        return j.result;
      };
      const listeners: Record<string, ((...a: unknown[]) => void)[]> = {};
      const provider = {
        isMetaMask: true,
        isTesseraTestWallet: true,
        async request({ method, params }: { method: string; params?: unknown[] }) {
          const p = (params ?? []) as never[];
          switch (method) {
            case "eth_requestAccounts":
            case "eth_accounts":
              return [address];
            case "eth_chainId":
              return chainIdHex;
            case "net_version":
              return String(parseInt(chainIdHex, 16));
            case "wallet_switchEthereumChain":
            case "wallet_addEthereumChain":
            case "wallet_watchAsset":
            case "wallet_requestPermissions":
              return null;
            case "eth_sendTransaction":
              // @ts-expect-error exposed binding
              return await window.__tesseraSend(p[0]);
            case "personal_sign":
            case "eth_signTypedData_v4":
              // @ts-expect-error exposed binding
              return await window.__tesseraSign(method, p);
            default:
              return await rawRpc(method, p as unknown[]);
          }
        },
        on(event: string, handler: (...a: unknown[]) => void) {
          (listeners[event] ||= []).push(handler);
          return provider;
        },
        removeListener(event: string, handler: (...a: unknown[]) => void) {
          listeners[event] = (listeners[event] || []).filter((h) => h !== handler);
          return provider;
        },
      };
      // EIP-1193 legacy
      (window as unknown as { ethereum: unknown }).ethereum = provider;
      // EIP-6963 discovery (wagmi v2 / ConnectKit)
      const info = {
        uuid: "f1e2d3c4-b5a6-7890-1234-567890abcdef",
        name: "Tessera Test Wallet",
        icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=",
        rdns: "xyz.tessera.testwallet",
      };
      const announce = () =>
        window.dispatchEvent(
          new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider }) }),
        );
      window.addEventListener("eip6963:requestProvider", announce);
      announce();
      setTimeout(() => (listeners["connect"] || []).forEach((h) => h({ chainId: chainIdHex })), 0);
    },
    { address: account.address, rpc: RPC_URL, chainIdHex: "0x" + CHAIN_ID.toString(16) },
  );

  return account.address;
}
