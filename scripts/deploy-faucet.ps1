<#
  Deploy the Tessera testnet Faucet and wire it up.

  Steps:
    1. forge create Faucet(cooldown, tokens[], amounts[])
    2. transferOwnership of USDC + each tStock to the faucet (so it can mint)
    3. write `faucet` into shared/addresses/testnet.json
    4. prove drip() works (mints the bundle to the deployer)

  Needs .env.testnet (DEPLOYER_PRIVATE_KEY = current owner of the mocks) and a
  deployed mock set in shared/addresses/testnet.json.
#>
$ErrorActionPreference = 'Stop'
$ROOT    = "C:\Users\ritik\arb"
$FORGE   = "C:\Users\ritik\.foundry\bin\forge.exe"
$CAST    = "C:\Users\ritik\.foundry\bin\cast.exe"
$RPC     = "https://sepolia-rollup.arbitrum.io/rpc"
$SOLDIR  = "$ROOT\contracts\solidity"
$ADDRABS = "$ROOT\shared\addresses\testnet.json"

Get-Content "$ROOT\.env.testnet" | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.+?)\s*$') { Set-Variable -Name $matches[1] -Value $matches[2] -Scope Script }
}
$PK = $DEPLOYER_PRIVATE_KEY
if (-not $PK) { throw "DEPLOYER_PRIVATE_KEY missing in .env.testnet" }

$j      = Get-Content $ADDRABS -Raw | ConvertFrom-Json
$USDC   = $j.usdc
$AAPL   = ($j.collateralTokens | Where-Object { $_.symbol -eq "tAAPL" }).address
$TSLA   = ($j.collateralTokens | Where-Object { $_.symbol -eq "tTSLA" }).address
$SPY    = ($j.collateralTokens | Where-Object { $_.symbol -eq "tSPY"  }).address

# Bundle handed out per drip: 10,000 USDC (6dec) + 100 of each stock (18dec).
$COOLDOWN = "3600"  # 1 hour between drips per address
$USDC_AMT  = "10000000000"
$STOCK_AMT = "100000000000000000000"
$TOKENS  = "[$USDC,$AAPL,$TSLA,$SPY]"
$AMOUNTS = "[$USDC_AMT,$STOCK_AMT,$STOCK_AMT,$STOCK_AMT]"

function Send($desc, [string[]]$a) {
  $r = (& $CAST send @a --rpc-url $RPC --private-key $PK --json) | ConvertFrom-Json
  $ok = if ($r.status -eq "0x1") { "OK " } else { "REVERT" }
  Write-Host ("  -> {0,-34} [{1}] {2}" -f $desc, $ok, $r.transactionHash)
  if ($r.status -ne "0x1") { throw "tx reverted: $desc" }
}

Write-Host "=== 1/4  forge create Faucet ==="
Push-Location $SOLDIR
$out = & $FORGE create "src/Faucet.sol:Faucet" --rpc-url $RPC --private-key $PK --broadcast `
  --constructor-args $COOLDOWN $TOKENS $AMOUNTS 2>&1
Pop-Location
$out | Write-Host
$FAUCET = ($out | Select-String -Pattern 'Deployed to:\s*(0x[0-9a-fA-F]{40})' |
           ForEach-Object { $_.Matches[0].Groups[1].Value } | Select-Object -First 1)
if (-not $FAUCET) { throw "could not parse faucet address from forge output" }
Write-Host "FAUCET = $FAUCET"

Write-Host "=== 2/4  transfer mock ownership to faucet ==="
Send "USDC.transferOwnership"  @($USDC,"transferOwnership(address)",$FAUCET)
Send "tAAPL.transferOwnership" @($AAPL,"transferOwnership(address)",$FAUCET)
Send "tTSLA.transferOwnership" @($TSLA,"transferOwnership(address)",$FAUCET)
Send "tSPY.transferOwnership"  @($SPY,"transferOwnership(address)",$FAUCET)

Write-Host "=== 3/4  write faucet into testnet.json ==="
$j | Add-Member -NotePropertyName faucet -NotePropertyValue $FAUCET -Force
# WriteAllText emits UTF-8 WITHOUT a BOM; PS 5.1's `Set-Content -Encoding utf8`
# adds a BOM that Turbopack refuses to parse.
[System.IO.File]::WriteAllText($ADDRABS, ($j | ConvertTo-Json -Depth 8))
Write-Host "  wrote faucet = $FAUCET"

Write-Host "=== 4/4  prove drip() mints the bundle ==="
Send "faucet.drip()" @($FAUCET,"drip()")
$bal = (& $CAST call $USDC "balanceOf(address)(uint256)" $DEPLOYER_ADDRESS --rpc-url $RPC).Trim()
Write-Host "  deployer USDC balance after drip: $bal"
Write-Host "DONE. Faucet: https://sepolia.arbiscan.io/address/$FAUCET"
