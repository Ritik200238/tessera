// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockStock
/// @notice Generic tokenized-equity mock used for tAAPL / tTSLA / tSPY on testnet.
/// @dev 18 decimals — matches the assumption in TDD §3.2 / §3.5 (set in `set_asset_params`).
///      A single contract is deployed per asset, distinguished by the constructor name/symbol.
contract MockStock is ERC20, Ownable {
    /// @param name_   Token name, e.g. "Tokenized Apple".
    /// @param symbol_ Token symbol, e.g. "tAAPL".
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) Ownable(msg.sender) {}

    /// @notice Mint `amount` tStock units to `to`. Owner-only.
    /// @param to     Recipient address.
    /// @param amount Amount in 18-decimal base units.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
