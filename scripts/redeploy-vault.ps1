<#
  Redeploy ONLY the Stylus vault (mocks + faucet + oracle stay).

  Builds the size-optimized wasm, deploys via cargo stylus, re-initializes,
  re-lists collateral, and writes the new vault address into testnet.json.
  Run after the contract source passes CI.
#>
$ErrorActionPreference = 'Stop'
$ROOT     = "C:\Users\ritik\arb"
$CAST     = "C:\Users\ritik\.foundry\bin\cast.exe"
$RPC      = "https://sepolia-rollup.arbitrum.io/rpc"
$VAULTDIR = "$ROOT\contracts\crates\vault"
$WASMOPT  = "C:\Users\ritik\.binaryen\binaryen-version_129\bin\wasm-opt.exe"
$ADDRABS  = "$ROOT\shared\addresses\testnet.json"

Get-Content "$ROOT\.env.testnet" | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.+?)\s*$') { Set-Variable -Name $matches[1] -Value $matches[2] -Scope Script }
}
$PK = $DEPLOYER_PRIVATE_KEY; $OWNER = $DEPLOYER_ADDRESS; $AGENT = $AGENT_ADDRESS
if (-not $PK) { throw "DEPLOYER_PRIVATE_KEY missing" }

$j = Get-Content $ADDRABS -Raw | ConvertFrom-Json
$USDC = $j.usdc; $ORACLE = $j.oracle
$AAPL = ($j.collateralTokens | Where-Object { $_.symbol -eq "tAAPL" }).address
$TSLA = ($j.collateralTokens | Where-Object { $_.symbol -eq "tTSLA" }).address
$SPY  = ($j.collateralTokens | Where-Object { $_.symbol -eq "tSPY"  }).address

# wasm build: panic=immediate-abort strips the fmt/panic machinery so the
# contract fits the 24KB EVM code limit. Host CRT/linker come from .cargo/config.toml.
$env:CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_RUSTFLAGS = "-Cpanic=immediate-abort -Zunstable-options"

Write-Host "=== 1/5  build size-optimized wasm ==="
# build-std compiles std from rust-src, so no precompiled wasm32 target is needed.
Push-Location $VAULTDIR
cmd /c "cargo +nightly build --release --target wasm32-unknown-unknown -Z build-std=std,panic_abort -p tessera-vault > `"$ROOT\vault-build.log`" 2>&1"
$buildExit = $LASTEXITCODE
Pop-Location
if ($buildExit -ne 0) { Get-Content "$ROOT\vault-build.log" -Tail 30; throw "wasm build failed (see vault-build.log)" }
$RAWWASM = "$ROOT\target\wasm32-unknown-unknown\release\tessera_vault.wasm"
if (-not (Test-Path $RAWWASM)) { throw "wasm not found at $RAWWASM" }

Write-Host "=== 2/5  wasm-opt -Oz ==="
$OPTWASM = "$ROOT\vault-opt.wasm"
& $WASMOPT -Oz --enable-bulk-memory --enable-sign-ext --enable-mutable-globals $RAWWASM -o $OPTWASM
Write-Host ("opt wasm: {0:N0} bytes" -f (Get-Item $OPTWASM).Length)

Write-Host "=== 3/5  cargo stylus deploy ==="
$deployLog = "$ROOT\vault-deploy.log"
Push-Location $VAULTDIR
cargo stylus deploy --wasm-file $OPTWASM --endpoint $RPC --private-key $PK --no-verify --max-fee-per-gas-gwei 1 *>&1 | Tee-Object -FilePath $deployLog
Pop-Location
$VAULT = (Select-String -Path $deployLog -Pattern 'address[:\s]+(0x[0-9a-fA-F]{40})\b' |
          ForEach-Object { $_.Matches[0].Groups[1].Value } | Select-Object -First 1)
if (-not $VAULT) {
  $VAULT = (Select-String -Path $deployLog -Pattern '0x[0-9a-fA-F]{40}(?![0-9a-fA-F])' -AllMatches |
            ForEach-Object { $_.Matches } | Select-Object -Last 1).Value
}
if (-not $VAULT) { throw "could not parse vault address from $deployLog" }
Write-Host "NEW VAULT = $VAULT"

Write-Host "=== 4/5  initialize + list collateral ==="
function Send($desc, [string[]]$a) {
  $r = (& $CAST send @a --rpc-url $RPC --private-key $PK --json) | ConvertFrom-Json
  $ok = if ($r.status -eq "0x1") { "OK " } else { "REVERT" }
  Write-Host ("  -> {0,-22} [{1}] {2}" -f $desc, $ok, $r.transactionHash)
  if ($r.status -ne "0x1") { throw "tx reverted: $desc" }
}
Send "initialize" @($VAULT,"initialize(address,address,address,address)",$OWNER,$USDC,$ORACLE,$AGENT)
Send "list tAAPL" @($VAULT,"listCollateral(address,uint16,uint16,uint16,uint8)",$AAPL,5000,6500,500,18)
Send "list tTSLA" @($VAULT,"listCollateral(address,uint16,uint16,uint16,uint8)",$TSLA,4000,5500,500,18)
Send "list tSPY"  @($VAULT,"listCollateral(address,uint16,uint16,uint16,uint8)",$SPY,6000,7500,500,18)

Write-Host "=== 5/5  write testnet.json (no BOM, targeted vault swap) ==="
# Targeted replace preserves the file's hand-formatting (vs ConvertTo-Json,
# which reflows the whole document into an ugly diff).
$raw = Get-Content $ADDRABS -Raw
$raw = $raw -replace '("vault":\s*")0x[0-9a-fA-F]{40}(")', ('${1}' + $VAULT + '${2}')
[System.IO.File]::WriteAllText($ADDRABS, $raw)
Write-Host "DONE. New vault: https://sepolia.arbiscan.io/address/$VAULT"
