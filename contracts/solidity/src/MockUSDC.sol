// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockUSDC
/// @notice Testnet-only ERC-20 with 6 decimals, mirroring USDC. Owner-mintable for demos.
/// @dev Intentionally minimal. Replace with real USDC on mainnet via address swap in
///      `shared/addresses/<env>.json` — no contract code changes required.
contract MockUSDC is ERC20, Ownable {
    /// @notice Deploys the mock USDC and assigns ownership to the deployer.
    constructor() ERC20("Mock USD Coin", "USDC") Ownable(msg.sender) {}

    /// @inheritdoc ERC20
    /// @dev Overridden to return 6 decimals (USDC convention) instead of the default 18.
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint `amount` USDC to `to`. Owner-only.
    /// @param to     Recipient address.
    /// @param amount Amount of USDC base units (6 decimals).
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
