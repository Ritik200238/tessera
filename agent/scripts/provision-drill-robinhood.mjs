/**
 * Provision the Live Drill rig on Robinhood Chain (46630).
 *
 * WHY: the drill rig was built on Arbitrum Sepolia and never migrated when the
 * app moved to Robinhood Chain. On Robinhood the drill ASSET (tDRILL) isn't
 * deployed, the drill wallet has no gas, and it has no USDC allowance — so the
 * public "watch the AI rescue a position" demo fails at step 2. This script
 * provisions everything in one run.
 *
 * It does, signed by the OWNER key (DRILL_ADMIN_KEY — which is the vault owner
 * AND the MockOracle owner on Robinhood):
 *   1. deploy a fresh tDRILL MockStock (18-dec, isolated from real users)
 *   2. set its oracle price to $100 (the drill baseline)
 *   3. listCollateral(tDRILL, 40% LTV / 55% liq / 5% bonus / 18 dec)  ← matches
 *      the orchestrator's LIQ_THRESHOLD = 0.55
 *   4. mint 1,000 tDRILL to the drill wallet (each drill deposits 20)
 *   5. send gas to the drill wallet
 * and, signed by the DRILL key (DRILL_PRIVATE_KEY):
 *   6. approve max USDC from the drill wallet to the vault (so the agent's
 *      agentRepayFor can pull the rescue repayment)
 *
 * SAFETY: dry-run by default. It resolves + validates everything and prints the
 * plan. Re-run with EXECUTE=1 to actually send the transactions.
 *
 * PREREQUISITES (you):
 *   - Top up the OWNER/admin wallet (0xF1d1…9124) with Robinhood gas first — it
 *     needs enough for a contract deploy + 4 calls + the drill-wallet funding
 *     (~0.1 ETH is plenty). The script aborts if it's too low.
 *   - Export the two keys (they live in render-drill-env.txt):
 *       export DRILL_ADMIN_KEY=0x...        # vault + oracle owner
 *       export DRILL_PRIVATE_KEY=0x...      # the drill position wallet
 *
 * RUN (from repo root or agent/):
 *   node agent/scripts/provision-drill-robinhood.mjs            # dry run
 *   EXECUTE=1 node agent/scripts/provision-drill-robinhood.mjs  # for real
 *
 * AFTER: set the agent's DRILL_ASSET env (Render) to the printed tDRILL address,
 * update shared/addresses/robinhood.json + .drill-asset, and redeploy the agent.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  erc20Abi,
  parseEther,
  parseUnits,
  formatEther,
  formatUnits,
  maxUint256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

// ---- config -----------------------------------------------------------------
const RPC = process.env.ROBINHOOD_RPC ?? "https://rpc.testnet.chain.robinhood.com/rpc";
const EXECUTE = process.env.EXECUTE === "1";
const MIN_OWNER_ETH = parseEther("0.08"); // refuse to start below this
const GAS_TO_DRILL = parseEther(process.env.GAS_TO_DRILL ?? "0.05");
const TDRILL_MINT = parseUnits("1000", 18); // plenty for many 20-tDRILL drills
const PRICE_8 = 100_00000000n; // $100.00, 8dp — the drill baseline

const adminKey = req("DRILL_ADMIN_KEY");
const drillKey = req("DRILL_PRIVATE_KEY");

function req(name) {
  const v = process.env[name];
  if (!v || !/^0x[0-9a-fA-F]{64}$/.test(v)) {
    fail(`Missing/invalid ${name}. Export it (it's in render-drill-env.txt).`);
  }
  return v;
}
function fail(msg) {
  console.error("\n✖ " + msg + "\n");
  process.exit(1);
}

const robinhood = {
  id: 46630,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
};

// ---- addresses --------------------------------------------------------------
const book = JSON.parse(
  readFileSync(resolve(repoRoot, "shared/addresses/robinhood.json"), "utf8"),
);
const VAULT = (process.env.VAULT_ADDRESS ?? book.vault)?.toLowerCase();
const USDC = (book.usdc ?? book.USDC)?.toLowerCase();
if (!VAULT || !USDC) fail("Could not resolve vault/usdc from shared/addresses/robinhood.json");

// ---- abis (inline so a stale committed ABI can't bite us) -------------------
const VAULT_ABI = [
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "oracle", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  {
    type: "function",
    name: "listCollateral",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "maxLtvBps", type: "uint16" },
      { name: "liqThresholdBps", type: "uint16" },
      { name: "liqBonusBps", type: "uint16" },
      { name: "decimals", type: "uint8" },
    ],
    outputs: [],
  },
];
const PRICEGUARD_ABI = [
  { type: "function", name: "primaryOracle", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
];
const ORACLE_ABI = [
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  {
    type: "function",
    name: "setPrice",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "answer", type: "int256" },
    ],
    outputs: [],
  },
];
const mock = JSON.parse(
  readFileSync(resolve(repoRoot, "contracts/solidity/out/MockStock.sol/MockStock.json"), "utf8"),
);
const MOCK_ABI = mock.abi;
const MOCK_BYTECODE = (typeof mock.bytecode === "object" ? mock.bytecode.object : mock.bytecode);

// ---- clients ----------------------------------------------------------------
const pub = createPublicClient({ chain: robinhood, transport: http(RPC) });
const admin = privateKeyToAccount(adminKey);
const drill = privateKeyToAccount(drillKey);
const adminWallet = createWalletClient({ account: admin, chain: robinhood, transport: http(RPC) });
const drillWallet = createWalletClient({ account: drill, chain: robinhood, transport: http(RPC) });

async function tx(label, hashPromise) {
  const hash = await hashPromise;
  process.stdout.write(`   ${label} … ${hash} `);
  const rcpt = await pub.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (rcpt.status !== "success") fail(`${label} reverted (${hash})`);
  console.log("✓");
  return rcpt;
}

async function main() {
  console.log(`\nTessera — provision Live Drill on Robinhood Chain (${robinhood.id})`);
  console.log(EXECUTE ? "MODE: EXECUTE (will send transactions)\n" : "MODE: DRY RUN (no transactions — set EXECUTE=1 to run)\n");

  // resolve the live oracle the vault actually reads
  const priceGuard = await pub.readContract({ address: VAULT, abi: VAULT_ABI, functionName: "oracle" });
  const mockOracle = await pub.readContract({ address: priceGuard, abi: PRICEGUARD_ABI, functionName: "primaryOracle" });
  const vaultOwner = await pub.readContract({ address: VAULT, abi: VAULT_ABI, functionName: "owner" });
  const oracleOwner = await pub.readContract({ address: mockOracle, abi: ORACLE_ABI, functionName: "owner" });
  const ownerGas = await pub.getBalance({ address: admin.address });
  const drillGas = await pub.getBalance({ address: drill.address });

  console.log("Resolved:");
  console.log("  vault        ", VAULT);
  console.log("  usdc         ", USDC);
  console.log("  priceGuard   ", priceGuard);
  console.log("  mockOracle   ", mockOracle, "(price source the vault reads)");
  console.log("  owner key    ", admin.address, `(${formatEther(ownerGas)} ETH)`);
  console.log("  drill wallet ", drill.address, `(${formatEther(drillGas)} ETH)`);
  console.log("");

  // validate authority + funds before doing anything
  if (vaultOwner.toLowerCase() !== admin.address.toLowerCase())
    fail(`DRILL_ADMIN_KEY (${admin.address}) is NOT the vault owner (${vaultOwner}). Use the owner key.`);
  if (oracleOwner.toLowerCase() !== admin.address.toLowerCase())
    fail(`DRILL_ADMIN_KEY is NOT the oracle owner (${oracleOwner}). Cannot set the drill price.`);
  const lowGas = ownerGas < MIN_OWNER_ETH;
  if (lowGas) {
    const msg = `Owner wallet ${admin.address} has only ${formatEther(ownerGas)} ETH — fund it to ≥ ${formatEther(MIN_OWNER_ETH)} ETH on Robinhood before EXECUTE.`;
    if (EXECUTE) fail(msg);
    console.log("⚠ " + msg + "\n");
  }

  console.log("Plan:");
  console.log("  1. deploy tDRILL (MockStock 'Tessera Drill Asset' / 'tDRILL', 18-dec)");
  console.log(`  2. mockOracle.setPrice(tDRILL, $100)`);
  console.log("  3. vault.listCollateral(tDRILL, 4000, 5500, 500, 18)   # 40/55/5%");
  console.log(`  4. tDRILL.mint(drillWallet, ${formatUnits(TDRILL_MINT, 18)} tDRILL)`);
  console.log(`  5. send ${formatEther(GAS_TO_DRILL)} ETH gas to drillWallet`);
  console.log("  6. drillWallet.approve(USDC → vault, max)");

  if (!EXECUTE) {
    console.log("\nDry run complete. Re-run with EXECUTE=1 to send these transactions.\n");
    return;
  }

  console.log("\nExecuting:");

  // 1. deploy tDRILL — admin is deployer => owner => can mint
  const deployRcpt = await tx(
    "deploy tDRILL",
    adminWallet.deployContract({ abi: MOCK_ABI, bytecode: MOCK_BYTECODE, args: ["Tessera Drill Asset", "tDRILL"] }),
  );
  const tdrill = deployRcpt.contractAddress;
  if (!tdrill) fail("deploy returned no contract address");
  console.log("   tDRILL deployed at", tdrill);

  // 2. price it $100 on the oracle the vault reads
  await tx("setPrice $100", adminWallet.writeContract({ address: mockOracle, abi: ORACLE_ABI, functionName: "setPrice", args: [tdrill, PRICE_8] }));

  // 3. list it as collateral (40/55/5, 18 dec)
  await tx("listCollateral 40/55/5", adminWallet.writeContract({ address: VAULT, abi: VAULT_ABI, functionName: "listCollateral", args: [tdrill, 4000, 5500, 500, 18] }));

  // 4. mint tDRILL to the drill wallet
  await tx("mint 1000 tDRILL → drill", adminWallet.writeContract({ address: tdrill, abi: MOCK_ABI, functionName: "mint", args: [drill.address, TDRILL_MINT] }));

  // 5. fund the drill wallet with gas
  await tx(`fund drill ${formatEther(GAS_TO_DRILL)} ETH`, adminWallet.sendTransaction({ to: drill.address, value: GAS_TO_DRILL }));

  // 6. drill wallet approves USDC to the vault (now that it has gas)
  await tx("drill approve USDC → vault (max)", drillWallet.writeContract({ address: USDC, abi: erc20Abi, functionName: "approve", args: [VAULT, maxUint256] }));

  console.log("\n✅ Done. New drill asset:");
  console.log("   tDRILL =", tdrill);
  console.log("\nNext steps:");
  console.log(`   1. Set the agent's env on Render:  DRILL_ASSET=${tdrill}`);
  console.log(`   2. Update shared/addresses/robinhood.json (add the tDRILL) and the .drill-asset file.`);
  console.log("   3. Redeploy the agent so it picks up DRILL_ASSET.");
  console.log("   4. Open /drill and run it once to confirm a green end-to-end rescue.\n");
}

main().catch((e) => fail(e.shortMessage || e.message || String(e)));
