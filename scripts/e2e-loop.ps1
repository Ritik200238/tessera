<#
  Tessera - end-to-end live proof on Arbitrum Sepolia.

  Proves the whole protocol loop against the deployed vault:
    lender supplies USDC -> borrower posts tTSLA collateral -> borrows USDC
    -> oracle price drops -> health factor breaches 1.0 -> agent liquidates.

  Actors (from .env.testnet):
    DEPLOYER = lender + borrower (the position that gets protected/liquidated)
    AGENT    = liquidator (holds USDC to repay, receives seized collateral)

  Reads live addresses from shared/addresses/testnet.json (run deploy-testnet.ps1 first).
#>
$ErrorActionPreference = 'Stop'
$ROOT    = "C:\Users\ritik\arb"
$CAST    = "C:\Users\ritik\.foundry\bin\cast.exe"
$RPC     = "https://sepolia-rollup.arbitrum.io/rpc"
$ADDRABS = "$ROOT\shared\addresses\testnet.json"

# Load env
Get-Content "$ROOT\.env.testnet" | ForEach-Object {
  if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.+?)\s*$') { Set-Variable -Name $matches[1] -Value $matches[2] -Scope Script }
}
$PK    = $DEPLOYER_PRIVATE_KEY
$OWNER = $DEPLOYER_ADDRESS
$APK   = $AGENT_PRIVATE_KEY
$AGENT = $AGENT_ADDRESS

# Load addresses
$j      = Get-Content $ADDRABS -Raw | ConvertFrom-Json
$VAULT  = $j.vault
$USDC   = $j.usdc
$ORACLE = $j.oracle
$TSLA   = ($j.collateralTokens | Where-Object { $_.symbol -eq "tTSLA" }).address
if (-not $VAULT -or $VAULT -eq "0x0000000000000000000000000000000000000000") { throw "vault not deployed in testnet.json" }

function Log($m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Send($desc, [string[]]$a) {
  $r = (& $CAST send @a --rpc-url $RPC --json) | ConvertFrom-Json
  $ok = if ($r.status -eq "0x1") { "OK " } else { "REVERT" }
  Write-Host ("-> {0,-34} [{1}] {2}" -f $desc, $ok, $r.transactionHash)
  if ($r.status -ne "0x1") { throw "tx reverted: $desc" }
}
function HF($who) { (& $CAST call $VAULT "getHealthFactor(address)(uint256)" $who --rpc-url $RPC).Trim() }
function Acct($who) { (& $CAST call $VAULT "getAccountData(address)(uint256,uint256,uint256)" $who --rpc-url $RPC) -join "  " }

# Amounts (USDC = 6 dec, tTSLA = 18 dec, oracle price = 8 dec)
$USDC_MINT_OWNER = "1000000000000"          # 1,000,000 USDC
$USDC_LEND       = "100000000000"           #   100,000 USDC supplied as lender liquidity
$TSLA_MINT       = "100000000000000000000"  #       100 tTSLA
$BORROW          = "9000000000"             #     9,000 USDC borrowed
$USDC_MINT_AGENT = "10000000000"            #    10,000 USDC to the liquidator
$TSLA_PRICE_DROP = "15000000000"            # tTSLA -> 150.00 USD (from 250): pushes HF < 1
$LIQ_REPAY       = "4500000000"             #     4,500 USDC (50% close factor of debt)

Log "0  Fund agent for gas + mint mocks (deployer owns them)"
# The liquidator (agent) wallet needs ETH to pay gas for approve + liquidate.
Send "fund agent 0.02 ETH" @($AGENT,"--value","20000000000000000","--private-key",$PK)
Send "mint 1,000,000 USDC -> deployer" @($USDC,"mint(address,uint256)",$OWNER,$USDC_MINT_OWNER,"--private-key",$PK)
Send "mint 100 tTSLA -> deployer"      @($TSLA,"mint(address,uint256)",$OWNER,$TSLA_MINT,"--private-key",$PK)
Send "mint 10,000 USDC -> agent"       @($USDC,"mint(address,uint256)",$AGENT,$USDC_MINT_AGENT,"--private-key",$PK)

Log "1  Lender supplies USDC"
Send "approve vault for USDC"   @($USDC,"approve(address,uint256)",$VAULT,$USDC_MINT_OWNER,"--private-key",$PK)
Send "deposit 100,000 USDC"     @($VAULT,"deposit(uint256,address)",$USDC_LEND,$OWNER,"--private-key",$PK)

Log "2  Borrower posts collateral + borrows"
Send "approve vault for tTSLA"  @($TSLA,"approve(address,uint256)",$VAULT,$TSLA_MINT,"--private-key",$PK)
Send "depositCollateral 100 tTSLA" @($VAULT,"depositCollateral(address,uint256)",$TSLA,$TSLA_MINT,"--private-key",$PK)
Send "borrow 9,000 USDC"        @($VAULT,"borrow(uint256)",$BORROW,"--private-key",$PK)
Write-Host "HF after borrow: $(HF $OWNER)  (expect > 1e18, healthy)"
Write-Host "account [collatUsd debtUsd hf]: $(Acct $OWNER)"

Log "3  Oracle price drop (tTSLA 250 -> 150)"
Send "setPrice tTSLA = 150 USD" @($ORACLE,"setPrice(address,int256)",$TSLA,$TSLA_PRICE_DROP,"--private-key",$PK)
Write-Host "HF after drop: $(HF $OWNER)  (expect < 1e18, liquidatable)"

Log "4  Agent liquidates (50% close factor)"
Send "agent approve vault for USDC" @($USDC,"approve(address,uint256)",$VAULT,$USDC_MINT_AGENT,"--private-key",$APK)
Send "agent liquidate(borrower,4500 USDC,tTSLA)" @($VAULT,"liquidate(address,uint256,address)",$OWNER,$LIQ_REPAY,$TSLA,"--private-key",$APK)

Log "5  Post-liquidation state"
Write-Host "HF after liquidation: $(HF $OWNER)  (expect recovered, higher than pre-liq)"
Write-Host "account [collatUsd debtUsd hf]: $(Acct $OWNER)"
$agentTsla = (& $CAST call $TSLA "balanceOf(address)(uint256)" $AGENT --rpc-url $RPC).Trim()
Write-Host "agent seized tTSLA balance: $agentTsla  (expect > 0: liquidation bonus collateral)"

Log "END-TO-END LOOP PROVEN ON ARBITRUM SEPOLIA"
Write-Host "Vault: https://sepolia.arbiscan.io/address/$VAULT"
