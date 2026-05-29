// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockOracle} from "../src/MockOracle.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MockOracleTest is Test {
    MockOracle internal oracle;
    address internal owner = address(0xA11CE);
    address internal alice = address(0xBEEF);
    address internal tAAPL = address(0xAA01);
    address internal tTSLA = address(0xAA02);

    uint256 internal constant MAX_AGE = 3600;

    function setUp() public {
        vm.warp(1_700_000_000); // ensure block.timestamp is a sane value
        vm.prank(owner);
        oracle = new MockOracle(MAX_AGE);
    }

    function test_InitialConfig() public view {
        assertEq(oracle.maxAge(), MAX_AGE);
        assertEq(oracle.decimals(), 8);
        assertEq(oracle.version(), 1);
        assertEq(oracle.owner(), owner);
        assertEq(oracle.defaultToken(), address(0));
        assertEq(oracle.description(), "Tessera MockOracle (multi-feed, 8 decimals)");
    }

    function test_SetPrice_OwnerCanSet_AndEmits() public {
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit MockOracle.PriceUpdated(tAAPL, 200_00000000, 1, uint64(block.timestamp));
        oracle.setPrice(tAAPL, 200_00000000);

        (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound) =
            oracle.latestRoundData(tAAPL);
        assertEq(roundId, 1);
        assertEq(answer, 200_00000000);
        assertEq(startedAt, block.timestamp);
        assertEq(updatedAt, block.timestamp);
        assertEq(answeredInRound, 1);
        assertEq(oracle.priceUsd8(tAAPL), 200_00000000);
    }

    function test_SetPrice_RoundIdIncrements() public {
        vm.startPrank(owner);
        oracle.setPrice(tAAPL, 200_00000000);
        oracle.setPrice(tAAPL, 210_00000000);
        oracle.setPrice(tAAPL, 195_00000000);
        vm.stopPrank();
        (uint80 roundId, int256 answer,,,) = oracle.latestRoundData(tAAPL);
        assertEq(roundId, 3);
        assertEq(answer, 195_00000000);
    }

    function test_SetPrice_PerTokenIsolation() public {
        vm.startPrank(owner);
        oracle.setPrice(tAAPL, 200_00000000);
        oracle.setPrice(tTSLA, 250_00000000);
        vm.stopPrank();

        (, int256 a,,,) = oracle.latestRoundData(tAAPL);
        (, int256 t,,,) = oracle.latestRoundData(tTSLA);
        assertEq(a, 200_00000000);
        assertEq(t, 250_00000000);
    }

    function test_SetPrice_RevertsForNonOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        oracle.setPrice(tAAPL, 200_00000000);
    }

    function test_SetPrice_RevertsOnZeroOrNegative() public {
        vm.startPrank(owner);
        vm.expectRevert(abi.encodeWithSelector(MockOracle.InvalidPrice.selector, int256(0)));
        oracle.setPrice(tAAPL, 0);

        vm.expectRevert(abi.encodeWithSelector(MockOracle.InvalidPrice.selector, int256(-1)));
        oracle.setPrice(tAAPL, -1);
        vm.stopPrank();
    }

    function test_LatestRoundData_RevertsOnUninitializedFeed() public {
        vm.expectRevert(abi.encodeWithSelector(MockOracle.FeedNotInitialized.selector, tAAPL));
        oracle.latestRoundData(tAAPL);

        vm.expectRevert(abi.encodeWithSelector(MockOracle.FeedNotInitialized.selector, tAAPL));
        oracle.priceUsd8(tAAPL);
    }

    function test_Staleness_RevertsAfterMaxAge() public {
        vm.prank(owner);
        oracle.setPrice(tAAPL, 200_00000000);
        uint64 setAt = uint64(block.timestamp);

        // Just inside the window: still ok.
        vm.warp(setAt + MAX_AGE);
        oracle.latestRoundData(tAAPL);

        // Step past the window.
        vm.warp(setAt + MAX_AGE + 1);
        vm.expectRevert(
            abi.encodeWithSelector(MockOracle.StalePrice.selector, tAAPL, uint256(setAt), block.timestamp, MAX_AGE)
        );
        oracle.latestRoundData(tAAPL);

        vm.expectRevert(
            abi.encodeWithSelector(MockOracle.StalePrice.selector, tAAPL, uint256(setAt), block.timestamp, MAX_AGE)
        );
        oracle.priceUsd8(tAAPL);
    }

    function test_Staleness_FreshSetReSatisfiesWindow() public {
        vm.prank(owner);
        oracle.setPrice(tAAPL, 200_00000000);
        vm.warp(block.timestamp + MAX_AGE + 100);
        vm.prank(owner);
        oracle.setPrice(tAAPL, 210_00000000);
        (, int256 answer,,,) = oracle.latestRoundData(tAAPL);
        assertEq(answer, 210_00000000);
    }

    function test_SetMaxAge_UpdatesAndEmits() public {
        vm.prank(owner);
        vm.expectEmit(false, false, false, true);
        emit MockOracle.MaxAgeUpdated(MAX_AGE, 60);
        oracle.setMaxAge(60);
        assertEq(oracle.maxAge(), 60);
    }

    function test_SetMaxAge_RevertsForNonOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        oracle.setMaxAge(60);
    }

    function test_DefaultToken_NoArgLatestRoundData() public {
        // Not yet configured.
        vm.expectRevert(MockOracle.DefaultTokenNotSet.selector);
        oracle.latestRoundData();

        vm.startPrank(owner);
        oracle.setPrice(tAAPL, 200_00000000);
        vm.expectEmit(true, true, false, false);
        emit MockOracle.DefaultTokenUpdated(address(0), tAAPL);
        oracle.setDefaultToken(tAAPL);
        vm.stopPrank();

        (, int256 answer,,,) = oracle.latestRoundData();
        assertEq(answer, 200_00000000);
        assertEq(oracle.defaultToken(), tAAPL);
    }

    function test_SetDefaultToken_RevertsForNonOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        oracle.setDefaultToken(tAAPL);
    }

    function test_GetFeed_ReturnsRawState() public {
        (int256 a0, uint64 u0, uint80 r0, bool i0) = oracle.getFeed(tAAPL);
        assertEq(a0, 0);
        assertEq(u0, 0);
        assertEq(r0, 0);
        assertFalse(i0);

        vm.prank(owner);
        oracle.setPrice(tAAPL, 200_00000000);
        (int256 a1, uint64 u1, uint80 r1, bool i1) = oracle.getFeed(tAAPL);
        assertEq(a1, 200_00000000);
        assertEq(u1, uint64(block.timestamp));
        assertEq(r1, 1);
        assertTrue(i1);
    }

    function testFuzz_SetPriceAndRead(int256 raw) public {
        int256 price = raw == type(int256).min ? int256(1) : (raw < 0 ? -raw : raw);
        if (price == 0) price = 1;
        vm.prank(owner);
        oracle.setPrice(tAAPL, price);
        assertEq(oracle.priceUsd8(tAAPL), uint256(price));
    }
}
