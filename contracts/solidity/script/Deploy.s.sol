// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {MockStock} from "../src/MockStock.sol";
import {MockOracle} from "../src/MockOracle.sol";

/// @notice Deploys Phase 1 mocks (USDC, tAAPL/tTSLA/tSPY, MockOracle) and seeds initial prices.
/// @dev Writes the resulting addresses to `shared/addresses/local.json` so the agent and UI can
///      pick them up. The path is resolved relative to the foundry sub-project (so the FS
///      permission in `foundry.toml` covers it).
///
/// Usage:
///   forge script script/Deploy.s.sol:Deploy --broadcast --rpc-url <url> --private-key <pk>
contract Deploy is Script {
    /// @dev MaxAge of 1 hour for MVP per TDD §3.5.
    uint256 internal constant ORACLE_MAX_AGE = 3600;

    function run() external {
        uint256 pk = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        if (pk == 0) {
            vm.startBroadcast();
        } else {
            vm.startBroadcast(pk);
        }

        MockUSDC usdc = new MockUSDC();
        MockStock tAAPL = new MockStock("Tokenized Apple", "tAAPL");
        MockStock tTSLA = new MockStock("Tokenized Tesla", "tTSLA");
        MockStock tSPY = new MockStock("Tokenized S&P 500", "tSPY");

        MockOracle oracle = new MockOracle(ORACLE_MAX_AGE);
        oracle.setPrice(address(tAAPL), 200_00000000); // $200.00
        oracle.setPrice(address(tTSLA), 250_00000000); // $250.00
        oracle.setPrice(address(tSPY), 500_00000000); // $500.00
        oracle.setDefaultToken(address(tAAPL));

        vm.stopBroadcast();

        // Persist addresses to shared/addresses/local.json using the shared schema agreed
        // across agents A/B/C/D: { vault, usdc, oracle, collateralTokens: [{symbol,address,priceUsd8}] }.
        // `vault` stays null in Phase 1 — populated by the Phase 2 Stylus deploy.

        string memory aapl = "aapl";
        vm.serializeString(aapl, "symbol", "tAAPL");
        vm.serializeAddress(aapl, "address", address(tAAPL));
        vm.serializeUint(aapl, "decimals", uint256(18));
        string memory aaplJson = vm.serializeUint(aapl, "priceUsd8", uint256(200_00000000));

        string memory tsla = "tsla";
        vm.serializeString(tsla, "symbol", "tTSLA");
        vm.serializeAddress(tsla, "address", address(tTSLA));
        vm.serializeUint(tsla, "decimals", uint256(18));
        string memory tslaJson = vm.serializeUint(tsla, "priceUsd8", uint256(250_00000000));

        string memory spy = "spy";
        vm.serializeString(spy, "symbol", "tSPY");
        vm.serializeAddress(spy, "address", address(tSPY));
        vm.serializeUint(spy, "decimals", uint256(18));
        string memory spyJson = vm.serializeUint(spy, "priceUsd8", uint256(500_00000000));

        string[] memory tokenArr = new string[](3);
        tokenArr[0] = aaplJson;
        tokenArr[1] = tslaJson;
        tokenArr[2] = spyJson;

        string memory root = "root";
        vm.serializeAddress(root, "vault", address(0)); // Phase 2
        vm.serializeAddress(root, "usdc", address(usdc));
        vm.serializeAddress(root, "oracle", address(oracle));
        string memory finalJson = vm.serializeString(root, "collateralTokens", tokenArr);

        // Output path is env-configurable so the same script seeds local.json (anvil)
        // or testnet.json (Arbitrum Sepolia). The Phase 2 Stylus deploy patches in `vault`.
        string memory path = vm.envOr("ADDR_FILE", string("../../shared/addresses/local.json"));
        vm.writeJson(finalJson, path);

        console2.log("=========== Tessera Phase 1 Deploy ===========");
        console2.log("Chain ID:    ", block.chainid);
        console2.log("MockUSDC:    ", address(usdc));
        console2.log("tAAPL:       ", address(tAAPL));
        console2.log("tTSLA:       ", address(tTSLA));
        console2.log("tSPY:        ", address(tSPY));
        console2.log("MockOracle:  ", address(oracle));
        console2.log("Addresses written to:", path);
    }
}
