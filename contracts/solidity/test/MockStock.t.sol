// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockStock} from "../src/MockStock.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

contract MockStockTest is Test {
    MockStock internal stock;
    address internal owner = address(0xA11CE);
    address internal alice = address(0xBEEF);
    address internal bob = address(0xCAFE);

    function setUp() public {
        vm.prank(owner);
        stock = new MockStock("Tokenized Apple", "tAAPL");
    }

    function test_Metadata() public view {
        assertEq(stock.name(), "Tokenized Apple");
        assertEq(stock.symbol(), "tAAPL");
        assertEq(stock.decimals(), 18, "tStock must be 18 decimals per TDD 3.2");
    }

    function test_OwnerIsDeployer() public view {
        assertEq(stock.owner(), owner);
    }

    function test_DistinctDeploymentsHaveIndependentSupply() public {
        vm.prank(owner);
        MockStock tsla = new MockStock("Tokenized Tesla", "tTSLA");
        assertEq(tsla.symbol(), "tTSLA");
        vm.prank(owner);
        stock.mint(alice, 10e18);
        assertEq(stock.totalSupply(), 10e18);
        assertEq(tsla.totalSupply(), 0);
    }

    function test_Mint_OwnerCanMint() public {
        vm.prank(owner);
        stock.mint(alice, 10e18);
        assertEq(stock.balanceOf(alice), 10e18);
    }

    function test_Mint_RevertsForNonOwner() public {
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, bob));
        stock.mint(alice, 1e18);
    }

    function test_TransferFrom_RequiresAllowance() public {
        vm.prank(owner);
        stock.mint(alice, 5e18);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, bob, 0, 1e18));
        stock.transferFrom(alice, bob, 1e18);

        vm.prank(alice);
        stock.approve(bob, 1e18);
        vm.prank(bob);
        stock.transferFrom(alice, bob, 1e18);
        assertEq(stock.balanceOf(bob), 1e18);
        assertEq(stock.balanceOf(alice), 4e18);
    }

    function testFuzz_MintMany(address to, uint96 amount) public {
        vm.assume(to != address(0));
        vm.prank(owner);
        stock.mint(to, amount);
        assertEq(stock.balanceOf(to), amount);
    }
}
