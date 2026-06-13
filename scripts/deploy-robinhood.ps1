<#
  Tessera — Robinhood Chain testnet deploy (chain 46630).

  Robinhood Chain is the native home of tokenized equities — and, being an
  Arbitrum Orbit L2 with a larger code-size allowance than Sepolia's 24KB, it
  accepts the FULL vault including the permissionless backstop liquidator +
  dual-oracle deviation guard (25.0 KiB) that does not fit the Sepolia setup.
  So this is also where those safety modules run live + verifiable on-chain.

  Order:
    1. Build the size-optimized wasm (same recipe as redeploy-vault.ps1).
    2. cargo stylus deploy the vault (low --max-fee-per-gas-gwei; RH base ~0.01).
    3. forge script the mocks (USDC, tAAPL/tTSLA/tSPY, MockOracle) -> robinhood.json.
    4. initialize + listCollateral + setMaxPriceAge(86400).

  Prereq: the deployer (0xF1d1...9124) must hold RH testnet ETH
  (faucet: https://faucet.testnet.chain.robinhood.com or faucets.chain.link).

  Live deployment (2026-06-11):
    Vault (full backstop) 0xf10acf61b480c24102b303ebafb97d9392d693f2
    USDC                  0x753b9aC945Feb9dD0C5DD1861B8905e8E03B41dD
    Oracle                0x65e6926BCD4EC600d4175019f20abAE07F95316D
    tAAPL/tTSLA/tSPY      0xFD0d...E8e8 / 0xd7fC...C0be / 0x2A1f...6A0e
    Permissionless backstop liquidation PROVEN (non-agent, stale heartbeat):
      tx 0x1c2f6a9024c4ec3018d074510a6bee7eea8a06823a9c975e74f0fe62c4881c76
  Explorer: https://explorer.testnet.chain.robinhood.com
#>
$ErrorActionPreference = 'Stop'
$ROOT = "C:\Users\ritik\arb"
$RH   = "https://rpc.testnet.chain.robinhood.com/rpc"
$CAST = "C:\Users\ritik\.foundry\bin\cast.exe"
$FORGE= "C:\Users\ritik\.foundry\bin\forge.exe"
$WASMOPT = "C:\Users\ritik\.binaryen\binaryen-version_129\bin\wasm-opt.exe"
$ADDRABS = "$ROOT\shared\addresses\robinhood.json"

Get-Content "$ROOT\.env.testnet" | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.+?)\s*$') { Set-Variable -Name $matches[1] -Value $matches[2] -Scope Script }
}
$PK = $DEPLOYER_PRIVATE_KEY; $OWNER = $DEPLOYER_ADDRESS; $AGENT = $AGENT_ADDRESS

Write-Host "=== 1/4 build vault wasm (full, with backstop) ==="
$env:CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_RUSTFLAGS = "-Cpanic=immediate-abort -Zunstable-options"
Push-Location "$ROOT\contracts\crates\vault"
cmd /c "cargo +nightly build --release --target wasm32-unknown-unknown -Z build-std=std,panic_abort -p tessera-vault > $ROOT\rh-build.log 2>&1"
Pop-Location
& $WASMOPT -Oz --enable-bulk-memory --enable-sign-ext --enable-mutable-globals "$ROOT\target\wasm32-unknown-unknown\release\tessera_vault.wasm" -o "$ROOT\vault-opt.wasm"

Write-Host "=== 2/4 cargo stylus deploy (RH base fee ~0.01 gwei) ==="
Push-Location "$ROOT\contracts\crates\vault"
cargo stylus deploy --wasm-file "$ROOT\vault-opt.wasm" --endpoint $RH --private-key $PK --no-verify --max-fee-per-gas-gwei 0.1 *>&1 | Tee-Object "$ROOT\rh-vault-deploy.log"
Pop-Location
$VAULT = (Select-String -Path "$ROOT\rh-vault-deploy.log" -Pattern 'deployed code at address: (0x[0-9a-fA-F]{40})').Matches[0].Groups[1].Value

Write-Host "=== 3/4 forge mocks -> robinhood.json ==="
$env:DEPLOYER_PRIVATE_KEY = $PK; $env:ADDR_FILE = "../../shared/addresses/robinhood.json"
Push-Location "$ROOT\contracts\solidity"
& $FORGE script script/Deploy.s.sol:Deploy --broadcast --rpc-url $RH --private-key $PK --skip-simulation --slow
Pop-Location
node -e "const f='$($ADDRABS -replace '\\','/')';const j=require(f);j.vault='$VAULT';require('fs').writeFileSync(f,JSON.stringify(j,null,2))"

Write-Host "=== 4/4 initialize + list + widen staleness window ==="
$j = Get-Content $ADDRABS -Raw | ConvertFrom-Json
$USDC=$j.usdc; $ORACLE=$j.oracle
$AAPL=($j.collateralTokens|?{$_.symbol -eq 'tAAPL'}).address
$TSLA=($j.collateralTokens|?{$_.symbol -eq 'tTSLA'}).address
$SPY =($j.collateralTokens|?{$_.symbol -eq 'tSPY'}).address
# PHASE 2.2 (do at the batched deploy): initialize() is now the #[constructor],
# so this separate cast call no longer exists. BUT this script currently deploys
# the vault (step 2) BEFORE the mocks (step 3), so the constructor args
# (usdc/oracle) aren't known yet. REORDER for the constructor: deploy the forge
# mocks FIRST, read their addresses, THEN `cargo stylus deploy ... --constructor-args
# $OWNER $USDC $ORACLE $AGENT`. Until reordered, this RH deploy is incompatible
# with the constructor build — see deploy-testnet.ps1 for the correct ordering.
& $CAST send $VAULT "listCollateral(address,uint16,uint16,uint16,uint8)" $AAPL 5000 6500 500 18 --rpc-url $RH --private-key $PK
& $CAST send $VAULT "listCollateral(address,uint16,uint16,uint16,uint8)" $TSLA 4000 5500 500 18 --rpc-url $RH --private-key $PK
& $CAST send $VAULT "listCollateral(address,uint16,uint16,uint16,uint8)" $SPY  6000 7500 500 18 --rpc-url $RH --private-key $PK
& $CAST send $VAULT "setMaxPriceAge(uint64)" 86400 --rpc-url $RH --private-key $PK
Write-Host "DONE. RH vault: https://explorer.testnet.chain.robinhood.com/address/$VAULT"
