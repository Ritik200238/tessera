// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Minimal surface of the owner-mintable mocks (MockUSDC / MockStock).
interface IMintableOwnable {
    function mint(address to, uint256 amount) external;
    function transferOwnership(address newOwner) external;
}

/// @title Faucet
/// @notice Testnet faucet that hands every visitor a fixed bundle of test assets
///         (USDC + each tokenized stock) so they can drive the full lend/borrow flow
///         without owning anything. One `drip()` mints the whole bundle, rate-limited
///         per address by a cooldown.
/// @dev The mocks' `mint` is owner-only, so after deploy the mocks' ownership is
///      transferred to this contract. The deployer keeps control through `adminMint`
///      (mint anything, e.g. lender liquidity) and `reclaimToken` (hand a mock's
///      ownership back). Testnet-only — there is no faucet on mainnet (real USDC /
///      issuer tokens replace the mocks via an address swap).
contract Faucet is Ownable {
    /// @notice One entry in the bundle handed out per `drip()`.
    struct Asset {
        address token; // owner-mintable mock
        uint256 amount; // base units (USDC 6dec, stocks 18dec)
    }

    /// @notice Seconds a wallet must wait between drips.
    uint256 public cooldown;
    /// @notice Last drip timestamp per address (0 = never).
    mapping(address => uint256) public lastDrip;

    Asset[] private _bundle;

    event Dripped(address indexed to, uint256 timestamp);
    event BundleUpdated(uint256 size);
    event CooldownUpdated(uint256 cooldown);

    /// @dev Caller must wait until `retryAt` before dripping again.
    error CooldownActive(uint256 retryAt);
    /// @dev Constructor arrays must be equal length and non-empty.
    error BadBundle();

    /// @param cooldown_ Seconds between drips per address.
    /// @param tokens    Owner-mintable mock token addresses.
    /// @param amounts   Amount of each token handed out per drip (index-aligned with `tokens`).
    constructor(uint256 cooldown_, address[] memory tokens, uint256[] memory amounts) Ownable(msg.sender) {
        cooldown = cooldown_;
        _setBundle(tokens, amounts);
    }

    /// @notice Mint the full configured bundle to the caller. Rate-limited by `cooldown`.
    function drip() external {
        uint256 last = lastDrip[msg.sender];
        if (last != 0 && block.timestamp < last + cooldown) {
            revert CooldownActive(last + cooldown);
        }
        lastDrip[msg.sender] = block.timestamp;

        uint256 n = _bundle.length;
        for (uint256 i = 0; i < n; ++i) {
            IMintableOwnable(_bundle[i].token).mint(msg.sender, _bundle[i].amount);
        }
        emit Dripped(msg.sender, block.timestamp);
    }

    // --- views ---

    /// @notice Earliest timestamp `user` may drip again (0 if never dripped / ready now).
    function nextDripAt(address user) external view returns (uint256) {
        uint256 last = lastDrip[user];
        return last == 0 ? 0 : last + cooldown;
    }

    /// @notice The full bundle handed out per drip.
    function bundle() external view returns (Asset[] memory) {
        return _bundle;
    }

    // --- admin ---

    /// @notice Replace the bundle handed out per drip.
    function setBundle(address[] calldata tokens, uint256[] calldata amounts) external onlyOwner {
        _setBundle(tokens, amounts);
    }

    /// @notice Update the per-address cooldown.
    function setCooldown(uint256 cooldown_) external onlyOwner {
        cooldown = cooldown_;
        emit CooldownUpdated(cooldown_);
    }

    /// @notice Mint an arbitrary amount of any owned token (e.g. seed lender liquidity).
    function adminMint(address token, address to, uint256 amount) external onlyOwner {
        IMintableOwnable(token).mint(to, amount);
    }

    /// @notice Hand a mock's ownership back (or to a new owner).
    function reclaimToken(address token, address newOwner) external onlyOwner {
        IMintableOwnable(token).transferOwnership(newOwner);
    }

    function _setBundle(address[] memory tokens, uint256[] memory amounts) private {
        if (tokens.length == 0 || tokens.length != amounts.length) revert BadBundle();
        delete _bundle;
        for (uint256 i = 0; i < tokens.length; ++i) {
            _bundle.push(Asset({token: tokens[i], amount: amounts[i]}));
        }
        emit BundleUpdated(tokens.length);
    }
}
