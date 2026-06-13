<#
  Deploy the full Tessera 3-contract stack to Arbitrum Sepolia:
    PriceGuard (oracle router) -> Vault (#[constructor]) -> Lens (data provider)
  then wire them, list collateral, and write a STAGING addresses file
  (testnet.staging.json). The live app keeps pointing at the old vault until
  scripts/promote-stack.ps1 swaps the staging file into testnet.json — so this
  deploy is additive and non-destructive.

  Prereq: source compiles + CI green; .env.testnet holds the deployer key.
  Run from anywhere; paths are absolute.
#>
$ErrorActionPreference = 'Stop'
$ROOT     = "C:\Users\ritik\arb"
$CAST     = "C:\Users\ritik\.foundry\bin\cast.exe"
$RPC      = "https://sepolia-rollup.arbitrum.io/rpc"
$WASMOPT  = "C:\Users\ritik\.binaryen\binaryen-version_129\bin\wasm-opt.exe"
$ADDRABS  = "$ROOT\shared\addresses\testnet.json"
$STAGING  = "$ROOT\shared\addresses\testnet.staging.json"
$VAULTDIR = "$ROOT\contracts\crates\vault"

Get-Content "$ROOT\.env.testnet" | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.+?)\s*$') { Set-Variable -Name $matches[1] -Value $matches[2] -Scope Script }
}
$PK = $DEPLOYER_PRIVATE_KEY; $OWNER = $DEPLOYER_ADDRESS; $AGENT = $AGENT_ADDRESS
if (-not $PK) { throw "DEPLOYER_PRIVATE_KEY missing" }

# Existing mocks/feeds stay: the new vault prices through PriceGuard, and
# PriceGuard reads the SAME MockOracle (Chainlink-style latestRoundData(token)).
$j = Get-Content $ADDRABS -Raw | ConvertFrom-Json
$USDC = $j.usdc; $MOCKORACLE = $j.oracle
$AAPL = ($j.collateralTokens | Where-Object { $_.symbol -eq "tAAPL" }).address
$TSLA = ($j.collateralTokens | Where-Object { $_.symbol -eq "tTSLA" }).address
$SPY  = ($j.collateralTokens | Where-Object { $_.symbol -eq "tSPY"  }).address

$env:CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_RUSTFLAGS = "-Cpanic=immediate-abort -Zunstable-options"

function Build-Opt($crate, $wasmName, $optName) {
  Write-Host "--- build $crate ---"
  Push-Location $VAULTDIR
  cmd /c "cargo +nightly build --release --target wasm32-unknown-unknown -Z build-std=std,panic_abort -p $crate > `"$ROOT\$crate-build.log`" 2>&1"
  $ex = $LASTEXITCODE
  Pop-Location
  if ($ex -ne 0) { Get-Content "$ROOT\$crate-build.log" -Tail 30; throw "$crate wasm build failed" }
  $raw = "$ROOT\target\wasm32-unknown-unknown\release\$wasmName"
  $opt = "$ROOT\$optName"
  & $WASMOPT -Oz --enable-bulk-memory --enable-sign-ext --enable-mutable-globals $raw -o $opt
  Write-Host ("    {0}: {1:N0} bytes (pre-brotli)" -f $optName, (Get-Item $opt).Length)
  return $opt
}

function Deploy-Wasm($opt) {
  $log = "$ROOT\deploy-tmp.log"
  Push-Location $VAULTDIR
  cargo stylus deploy --wasm-file $opt --endpoint $RPC --private-key $PK --no-verify --max-fee-per-gas-gwei 1 *>&1 | Tee-Object -FilePath $log | Out-Null
  Pop-Location
  $addr = (Select-String -Path $log -Pattern 'deployed code at address[:\s]+(0x[0-9a-fA-F]{40})' |
           ForEach-Object { $_.Matches[0].Groups[1].Value } | Select-Object -First 1)
  if (-not $addr) {
    $addr = (Select-String -Path $log -Pattern '0x[0-9a-fA-F]{40}(?![0-9a-fA-F])' -AllMatches |
             ForEach-Object { $_.Matches } | Select-Object -Last 1).Value
  }
  if (-not $addr) { Get-Content $log -Tail 30; throw "could not parse deployed address" }
  return $addr
}

function Deploy-WasmCtor($opt, [string[]]$ctorArgs, $ctorSig) {
  $log = "$ROOT\deploy-tmp.log"
  Push-Location $VAULTDIR
  cargo stylus deploy --wasm-file $opt --endpoint $RPC --private-key $PK --no-verify --max-fee-per-gas-gwei 1 `
    --constructor-signature $ctorSig --constructor-args @ctorArgs *>&1 | Tee-Object -FilePath $log | Out-Null
  Pop-Location
  $addr = (Select-String -Path $log -Pattern 'deployed code at address[:\s]+(0x[0-9a-fA-F]{40})' |
           ForEach-Object { $_.Matches[0].Groups[1].Value } | Select-Object -First 1)
  if (-not $addr) {
    $addr = (Select-String -Path $log -Pattern '0x[0-9a-fA-F]{40}(?![0-9a-fA-F])' -AllMatches |
             ForEach-Object { $_.Matches } | Select-Object -Last 1).Value
  }
  if (-not $addr) { Get-Content $log -Tail 30; throw "could not parse deployed vault address" }
  return $addr
}

function Send($desc, [string[]]$a) {
  $r = (& $CAST send @a --rpc-url $RPC --private-key $PK --json) | ConvertFrom-Json
  $ok = if ($r.status -eq "0x1") { "OK " } else { "REVERT" }
  Write-Host ("  -> {0,-26} [{1}] {2}" -f $desc, $ok, $r.transactionHash)
  if ($r.status -ne "0x1") { throw "tx reverted: $desc" }
}

Write-Host "=== 1/6  build + opt all three wasms ==="
$pgOpt   = Build-Opt "tessera-priceguard" "tessera_priceguard.wasm" "priceguard-opt.wasm"
$vaultOpt= Build-Opt "tessera-vault"      "tessera_vault.wasm"      "vault-opt.wasm"
$lensOpt = Build-Opt "tessera-lens"       "tessera_lens.wasm"       "lens-opt.wasm"

Write-Host "=== 2/6  deploy PriceGuard + initialize ==="
$PRICEGUARD = Deploy-Wasm $pgOpt
Write-Host "PRICEGUARD = $PRICEGUARD"
Send "PG.initialize"  @($PRICEGUARD,"initialize(address,address,uint64)",$OWNER,$MOCKORACLE,3600)
Send "PG.setGuardian" @($PRICEGUARD,"setGuardian(address)",$AGENT)   # agent may halt / flag market-closed

Write-Host "=== 3/6  deploy Vault (constructor: owner, usdc, PriceGuard, agent) ==="
$VAULT = Deploy-WasmCtor $vaultOpt @($OWNER,$USDC,$PRICEGUARD,$AGENT) "constructor(address,address,address,address)"
Write-Host "VAULT = $VAULT"

Write-Host "=== 4/6  deploy Lens + initialize(owner, vault) ==="
$LENS = Deploy-Wasm $lensOpt
Write-Host "LENS = $LENS"
Send "LENS.initialize" @($LENS,"initialize(address,address)",$OWNER,$VAULT)

Write-Host "=== 5/6  list collateral on the new vault ==="
Send "list tAAPL" @($VAULT,"listCollateral(address,uint16,uint16,uint16,uint8)",$AAPL,5000,6500,500,18)
Send "list tTSLA" @($VAULT,"listCollateral(address,uint16,uint16,uint16,uint8)",$TSLA,4000,5500,500,18)
Send "list tSPY"  @($VAULT,"listCollateral(address,uint16,uint16,uint16,uint8)",$SPY,6000,7500,500,18)

Write-Host "=== 6/6  write STAGING addresses (live app unchanged) ==="
$stage = [ordered]@{
  vault      = $VAULT
  lens       = $LENS
  priceguard = $PRICEGUARD
  usdc       = $USDC
  oracle     = $MOCKORACLE
  collateralTokens = $j.collateralTokens
}
[System.IO.File]::WriteAllText($STAGING, ($stage | ConvertTo-Json -Depth 8))
Write-Host ""
Write-Host "STACK DEPLOYED (staging; live app still on old vault):"
Write-Host "  PriceGuard : https://sepolia.arbiscan.io/address/$PRICEGUARD"
Write-Host "  Vault      : https://sepolia.arbiscan.io/address/$VAULT"
Write-Host "  Lens       : https://sepolia.arbiscan.io/address/$LENS"
Write-Host ""
Write-Host "Next: seed liquidity -> integration test -> scripts/promote-stack.ps1 to repoint the app."
