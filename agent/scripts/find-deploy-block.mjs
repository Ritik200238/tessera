// One-off: binary-search the block at which the vault bytecode first appears.
// Used to seed AGENT_START_BLOCK so the event indexer doesn't scan from genesis.
import { createPublicClient, http } from "viem";
import { readFileSync } from "node:fs";

const rpc = (readFileSync(new URL("../.env", import.meta.url), "utf8")
  .match(/^RPC_URL=(.+)$/m) || [])[1].trim();
const vault = (readFileSync(new URL("../.env", import.meta.url), "utf8")
  .match(/^VAULT_ADDRESS=(.+)$/m) || [])[1].trim();

const client = createPublicClient({ transport: http(rpc) });
const hasCode = async (bn) => {
  const c = await client.getBytecode({ address: vault, blockNumber: bn });
  return !!c && c !== "0x";
};

let lo = 0n;
let hi = await client.getBlockNumber();
console.log("head", hi.toString(), "vault", vault);
if (!(await hasCode(hi))) { console.log("no code at head?!"); process.exit(1); }
while (lo < hi) {
  const mid = (lo + hi) / 2n;
  if (await hasCode(mid)) hi = mid;
  else lo = mid + 1n;
}
console.log("DEPLOY_BLOCK", lo.toString());
