// AUTO-GENERATED from shared/addresses/testnet.json by scripts/sync-shared.mjs — DO NOT EDIT BY HAND.
// Run `npm run sync:shared` after changing the shared file; CI fails on drift.

export const sharedAddresses = {
  "vault": "0x72adaa00e2eaa98f62ee1c77e9b7714e0db57ba7",
  "usdc": "0xf10aCF61b480c24102B303ebAFB97d9392d693F2",
  "oracle": "0xd7fC0f4EA57272C7F5150EDA47f6BC318a0eC0be",
  "faucet": "0x0CabEe1bDED93aac4435d6F6EA6255922f9a3865",
  "collateralTokens": [
    {
      "symbol": "tAAPL",
      "address": "0xb88BB7FB901Df495cF6228F9E4293b8F91660762",
      "decimals": 18,
      "priceUsd8": 20000000000
    },
    {
      "symbol": "tTSLA",
      "address": "0x753b9aC945Feb9dD0C5DD1861B8905e8E03B41dD",
      "decimals": 18,
      "priceUsd8": 25000000000
    },
    {
      "symbol": "tSPY",
      "address": "0xFD0deB24BB217853A54a3D560cd3FdD794B9E8e8",
      "decimals": 18,
      "priceUsd8": 50000000000
    }
  ]
} as const;
