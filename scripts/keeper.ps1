<#
  Tessera - oracle price keeper (Arbitrum Sepolia testnet).

  The production design uses Chainlink feeds, which update themselves. On testnet
  we run against MockOracle, so this keeper plays Chainlink's role: it re-stamps
  each listed feed on an interval so reads stay fresh (vault reverts on stale
  prices, by design). Prices are the last-close values in shared/addresses/testnet.json
  -- equities only move once per session, so re-stamping the same value is correct.

  Usage:
    powershell -File scripts\keeper.ps1 -Once                 # single refresh, then exit
    powershell -File scripts\keeper.ps1                        # loop every 30 min
    powershell -File scripts\keeper.ps1 -IntervalSec 600       # loop every 10 min
    powershell -File scripts\keeper.ps1 -MaxAge 86400          # also re-set staleness window

  Needs .env.testnet (DEPLOYER_PRIVATE_KEY, owner of the oracle) and a deployed
  oracle in shared/addresses/testnet.json (run deploy-testnet.ps1 first).
#>
param(
  [switch]$Once,
  [int]$IntervalSec = 1800,
  [int]$MaxAge = 0          # when > 0, calls setMaxAge once before the first refresh
)
$ErrorActionPreference = 'Stop'
$ROOT    = "C:\Users\ritik\arb"
$CAST    = "C:\Users\ritik\.foundry\bin\cast.exe"
$RPC     = "https://sepolia-rollup.arbitrum.io/rpc"
$ADDRABS = "$ROOT\shared\addresses\testnet.json"

Get-Content "$ROOT\.env.testnet" | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.+?)\s*$') { Set-Variable -Name $matches[1] -Value $matches[2] -Scope Script }
}
$PK = $DEPLOYER_PRIVATE_KEY
if (-not $PK) { throw "DEPLOYER_PRIVATE_KEY missing in .env.testnet" }

$j      = Get-Content $ADDRABS -Raw | ConvertFrom-Json
$ORACLE = $j.oracle
if (-not $ORACLE -or $ORACLE -eq "0x0000000000000000000000000000000000000000") { throw "oracle not deployed in testnet.json" }
$TOKENS = $j.collateralTokens

function Send($desc, [string[]]$a) {
  $r = (& $CAST send @a --rpc-url $RPC --json) | ConvertFrom-Json
  $ok = if ($r.status -eq "0x1") { "OK " } else { "REVERT" }
  Write-Host ("  -> {0,-30} [{1}] {2}" -f $desc, $ok, $r.transactionHash)
  if ($r.status -ne "0x1") { throw "tx reverted: $desc" }
}

if ($MaxAge -gt 0) {
  Write-Host "Setting oracle maxAge = $MaxAge s"
  Send "setMaxAge $MaxAge" @($ORACLE,"setMaxAge(uint256)",$MaxAge,"--private-key",$PK)
}

function Refresh {
  $stamp = (Get-Date).ToString("u")
  Write-Host "[$stamp] refreshing $($TOKENS.Count) feeds on $ORACLE"
  foreach ($t in $TOKENS) {
    Send "setPrice $($t.symbol) = $([math]::Round($t.priceUsd8/1e8,2)) USD" `
      @($ORACLE,"setPrice(address,int256)",$t.address,[string]$t.priceUsd8,"--private-key",$PK)
  }
}

Refresh
if ($Once) { Write-Host "Done (one-shot)."; return }

Write-Host "Keeper loop started; refreshing every $IntervalSec s. Ctrl+C to stop."
while ($true) {
  Start-Sleep -Seconds $IntervalSec
  try { Refresh } catch { Write-Host "refresh failed: $($_.Exception.Message)" -ForegroundColor Yellow }
}
