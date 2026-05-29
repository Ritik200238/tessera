/**
 * Per-environment contract address registry.
 *
 * The deploy pipeline writes `shared/addresses/<env>.json` after each
 * deploy. We import each via the JSON module system so missing files
 * become a clean build error rather than silent `undefined` at runtime.
 *
 * If the deploy hasn't happened yet for a given env, that file may not
 * exist; we ship empty defaults here and the loader returns `null` for
 * everything, which the UI handles as "Vault not yet deployed".
 */

import { env } from "./env";

export interface AddressBook {
  vault: `0x${string}` | null;
  usdc: `0x${string}` | null;
  oracle: `0x${string}` | null;
  collateralTokens: {
    symbol: string;
    address: `0x${string}`;
    decimals: number;
  }[];
}

const empty: AddressBook = {
  vault: null,
  usdc: null,
  oracle: null,
  collateralTokens: [],
};

// We resolve the JSON files lazily — Node ESM JSON imports require an
// import attribute we can't issue from here without breaking Next's
// bundler. Instead use the conventional `require` shim available in the
// Next.js Node runtime, falling back to empty when the file is absent.
function tryLoad(envKey: string): AddressBook {
  try {
    // The path is intentionally relative to this file so it works at build
    // time without bundler config. If the file is missing we return empty.
    const data = require(`../../shared/addresses/${envKey}.json`) as Partial<AddressBook>;
    return {
      vault: (data.vault ?? null) as AddressBook["vault"],
      usdc: (data.usdc ?? null) as AddressBook["usdc"],
      oracle: (data.oracle ?? null) as AddressBook["oracle"],
      collateralTokens: data.collateralTokens ?? [],
    };
  } catch {
    return empty;
  }
}

const cache: Record<string, AddressBook> = {};

export function getAddresses(): AddressBook {
  const key = env.chainEnv;
  const hit = cache[key];
  if (hit) return hit;
  const loaded = tryLoad(key);
  cache[key] = loaded;
  return loaded;
}

export const addresses = getAddresses();
