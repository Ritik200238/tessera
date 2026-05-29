<#
  Tessera — Arbitrum Sepolia deploy + initialization runbook.

  Deploys, in order:
    1. Mocks (MockUSDC, tAAPL/tTSLA/tSPY, MockOracle) via forge script
    2. The Stylus vault via `cargo stylus deploy`
    3. initialize(owner, usdc, oracle, agent)
    4. listCollateral(...) for each tokenized stock (conservative LTVs)
  Then writes every address into shared/addresses/testnet.json.

  Prereqs (all set up earlier this session):
    - cargo-stylus installed (pure-Rust patched build)
    - Foundry (forge/cast) in C:\Users\ritik\.foundry\bin
    - .env.testnet present with DEPLOYER_PRIVATE_KEY (funded) + AGENT_ADDRESS
    - xwin toolchain env for the Stylus wasm build

  Usage:  pwsh -File scripts\deploy-testnet.ps1
#>
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
$ROOT     = "C:\Users\ritik\arb"
$FORGE    = "C:\Users\ritik\.foundry\bin\forge.exe"
$CAST     = "C:\Users\ritik\.foundry\bin\cast.exe"
$RPC      = "https://sepolia-rollup.arbitrum.io/rpc"
$SOLDIR   = "$ROOT\contracts\solidity"
$VAULTDIR = "$ROOT\contracts\crates\vault"
$ADDRREL  = "../../shared/addresses/testnet.json"   # relative to the foundry project
$ADDRABS  = "$ROOT\shared\addresses\testnet.json"

# Stylus wasm build toolchain (xwin / rust-lld / static CRT) — required for cargo stylus.
$env:CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER   = "rust-lld.exe"
$env:CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_RUSTFLAGS = "-C target-feature=+crt-static -L C:\Users\ritik\.xwin\crt\lib\x86_64 -L C:\Users\ritik\.xwin\sdk\lib\ucrt\x86_64 -L C:\Users\ritik\.xwin\sdk\lib\um\x86_64"
$env:LIB = "C:\Users\ritik\.xwin\crt\lib\x86_64;C:\Users\ritik\.xwin\sdk\lib\ucrt\x86_64;C:\Users\ritik\.xwin\sdk\lib\um\x86_64"

# ---------------------------------------------------------------------------
# Load .env.testnet
# ---------------------------------------------------------------------------
$envFile = "$ROOT\.env.testnet"
if (-not (Test-Path $envFile)) { throw ".env.testnet not found at $envFile" }
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.+?)\s*$') { Set-Variable -Name $matches[1] -Value $matches[2] -Scope Script }
}
$PK    = $DEPLOYER_PRIVATE_KEY
$OWNER = $DEPLOYER_ADDRESS
$AGENT = $AGENT_ADDRESS
if (-not $PK)    { throw "DEPLOYER_PRIVATE_KEY missing" }
if (-not $AGENT) { throw "AGENT_ADDRESS missing" }

function Log($m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }

# ---------------------------------------------------------------------------
# 0. Preflight — funded?
# ---------------------------------------------------------------------------
Log "Preflight: deployer balance"
$wei = (& $CAST balance $OWNER --rpc-url $RPC).Trim()
Write-Host "deployer $OWNER : $(& $CAST from-wei $wei) ETH"
if ($wei -eq "0") { throw "Deployer is unfunded. Send ~0.05 Arbitrum Sepolia ETH to $OWNER and re-run." }

# ---------------------------------------------------------------------------
# 1. Deploy mocks (writes usdc/oracle/collateral to testnet.json, vault=null)
# ---------------------------------------------------------------------------
Log "1/5  Deploy mocks via forge script"
$env:ADDR_FILE = $ADDRREL
Push-Location $SOLDIR
& $FORGE script script/Deploy.s.sol:Deploy --broadcast --rpc-url $RPC --private-key $PK --skip-simulation
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "forge script failed" }
Pop-Location

# ---------------------------------------------------------------------------
# 2. Read mock addresses
# ---------------------------------------------------------------------------
Log "2/5  Read mock addresses from testnet.json"
$j = Get-Content $ADDRABS -Raw | ConvertFrom-Json
$USDC   = $j.usdc
$ORACLE = $j.oracle
$AAPL   = ($j.collateralTokens | Where-Object { $_.symbol -eq "tAAPL" }).address
$TSLA   = ($j.collateralTokens | Where-Object { $_.symbol -eq "tTSLA" }).address
$SPY    = ($j.collateralTokens | Where-Object { $_.symbol -eq "tSPY"  }).address
Write-Host "USDC=$USDC  ORACLE=$ORACLE  tAAPL=$AAPL  tTSLA=$TSLA  tSPY=$SPY"

# ---------------------------------------------------------------------------
# 3. Deploy the Stylus vault
# ---------------------------------------------------------------------------
Log "3/5  Deploy Stylus vault (cargo stylus deploy --no-verify)"
Push-Location $VAULTDIR
$deployLog = "$ROOT\vault-deploy.log"
cargo stylus deploy --endpoint $RPC --private-key $PK --no-verify *>&1 | Tee-Object -FilePath $deployLog
Pop-Location
# Parse the deployed address. cargo stylus prints "deployed code at address: 0x<40hex>"
# AND a 64-hex tx hash, so anchor on the "address" keyword first, then fall back to a
# 40-hex run that is NOT part of a longer (64-hex) hash.
$VAULT = (Select-String -Path $deployLog -Pattern 'address[:\s]+(0x[0-9a-fA-F]{40})\b' |
          ForEach-Object { $_.Matches[0].Groups[1].Value } | Select-Object -First 1)
if (-not $VAULT) {
  $VAULT = (Select-String -Path $deployLog -Pattern '0x[0-9a-fA-F]{40}(?![0-9a-fA-F])' -AllMatches |
            ForEach-Object { $_.Matches } | Select-Object -Last 1).Value
}
if (-not $VAULT) { throw "Could not parse vault address from $deployLog (inspect it manually)" }
Write-Host "VAULT=$VAULT"

# ---------------------------------------------------------------------------
# 4. Initialize + list collateral
# ---------------------------------------------------------------------------
Log "4/5  initialize + listCollateral"
& $CAST send $VAULT "initialize(address,address,address,address)" $OWNER $USDC $ORACLE $AGENT --rpc-url $RPC --private-key $PK
# Conservative LTVs per blueprint: TSLA 40%, AAPL 50%, SPY 60%. liqBonus 5% (500 bps). 18 decimals.
& $CAST send $VAULT "listCollateral(address,uint16,uint16,uint16,uint8)" $AAPL 5000 6500 500 18 --rpc-url $RPC --private-key $PK
& $CAST send $VAULT "listCollateral(address,uint16,uint16,uint16,uint8)" $TSLA 4000 5500 500 18 --rpc-url $RPC --private-key $PK
& $CAST send $VAULT "listCollateral(address,uint16,uint16,uint16,uint8)" $SPY  6000 7500 500 18 --rpc-url $RPC --private-key $PK

# ---------------------------------------------------------------------------
# 5. Patch vault address into testnet.json
# ---------------------------------------------------------------------------
Log "5/5  Write vault address into testnet.json"
$j.vault = $VAULT
$j | ConvertTo-Json -Depth 8 | Set-Content $ADDRABS -Encoding utf8

Log "DONE"
Write-Host "VAULT  : $VAULT"
Write-Host "USDC   : $USDC"
Write-Host "ORACLE : $ORACLE"
Write-Host "tAAPL  : $AAPL"
Write-Host "tTSLA  : $TSLA"
Write-Host "tSPY   : $SPY"
Write-Host "Explorer: https://sepolia.arbiscan.io/address/$VAULT"
