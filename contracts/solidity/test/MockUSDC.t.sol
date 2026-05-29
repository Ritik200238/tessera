// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

contract MockUSDCTest is Test {
    MockUSDC internal usdc;
    address internal owner = address(0xA11CE);
    address internal alice = address(0xBEEF);
    address internal bob = address(0xCAFE);

    function setUp() public {
        vm.prank(owner);
        usdc = new MockUSDC();
    }

    function test_Metadata() public view {
        assertEq(usdc.name(), "Mock USD Coin");
        assertEq(usdc.symbol(), "USDC");
        assertEq(usdc.decimals(), 6);
        assertEq(usdc.totalSupply(), 0);
    }

    function test_OwnerIsDeployer() public view {
        assertEq(usdc.owner(), owner);
    }

    function test_Mint_OwnerCanMint() public {
        vm.prank(owner);
        usdc.mint(alice, 1_000_000e6);
        assertEq(usdc.balanceOf(alice), 1_000_000e6);
        assertEq(usdc.totalSupply(), 1_000_000e6);
    }

    function test_Mint_RevertsForNonOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        usdc.mint(alice, 1e6);
    }

    function test_Transfer_WorksAfterMint() public {
        vm.prank(owner);
        usdc.mint(alice, 100e6);
        vm.prank(alice);
        usdc.transfer(bob, 40e6);
        assertEq(usdc.balanceOf(alice), 60e6);
        assertEq(usdc.balanceOf(bob), 40e6);
    }

    function test_Transfer_RevertsOnInsufficientBalance() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, alice, 0, 1));
        usdc.transfer(bob, 1);
    }

    function test_OwnershipTransfer() public {
        vm.prank(owner);
        usdc.transferOwnership(alice);
        assertEq(usdc.owner(), alice);
        vm.prank(alice);
        usdc.mint(bob, 5e6);
        assertEq(usdc.balanceOf(bob), 5e6);
    }

    function testFuzz_Mint(address to, uint128 amount) public {
        vm.assume(to != address(0));
        vm.prank(owner);
        usdc.mint(to, amount);
        assertEq(usdc.balanceOf(to), amount);
    }
}
