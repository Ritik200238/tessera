<#  Read-only snapshot of the live position state (no keys printed). #>
$ErrorActionPreference = 'Stop'
$ROOT = "C:\Users\ritik\arb"
$CAST = "C:\Users\ritik\.foundry\bin\cast.exe"
$RPC  = "https://sepolia-rollup.arbitrum.io/rpc"
Get-Content "$ROOT\.env.testnet" | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.+?)\s*$') { Set-Variable -Name $matches[1] -Value $matches[2] -Scope Script }
}
$j = Get-Content "$ROOT\shared\addresses\testnet.json" -Raw | ConvertFrom-Json
$VAULT = $j.vault; $USDC = $j.usdc
$OWNER = $DEPLOYER_ADDRESS; $AGENT = $AGENT_ADDRESS
function Call($a) { (& $CAST call @a --rpc-url $RPC) }
Write-Host "head           : $(& $CAST block-number --rpc-url $RPC)"
Write-Host "DEPLOYER (owner/borrower): $OWNER"
Write-Host "AGENT          : $AGENT"
Write-Host "vault          : $VAULT"
Write-Host "--- deployer position ---"
Write-Host "getAccountData(collatUsd8, debtUsd6, hf1e18): $(Call @($VAULT,'getAccountData(address)(uint256,uint256,uint256)',$OWNER))"
Write-Host "getHealthFactor: $(Call @($VAULT,'getHealthFactor(address)(uint256)',$OWNER))"
Write-Host "deployer USDC bal   : $(Call @($USDC,'balanceOf(address)(uint256)',$OWNER))"
Write-Host "deployer->vault allowance (USDC): $(Call @($USDC,'allowance(address,address)(uint256)',$OWNER,$VAULT))"
Write-Host "agent USDC bal      : $(Call @($USDC,'balanceOf(address)(uint256)',$AGENT))"
Write-Host "agent ETH (gas)     : $(& $CAST balance $AGENT --rpc-url $RPC)"
Write-Host "vault agent()       : $(Call @($VAULT,'agent()(address)'))"
