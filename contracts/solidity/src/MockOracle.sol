// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Minimal subset of Chainlink's AggregatorV3Interface that downstream consumers expect.
/// @dev We re-declare it locally to avoid pulling in the chainlink npm package for a testnet mock.
interface IAggregatorV3 {
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function version() external view returns (uint256);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/// @title MockOracle
/// @notice Multi-feed Chainlink-compatible mock price oracle keyed by token address.
/// @dev Design rationale (per TDD §3.5): the Rust vault calls `price_usd_8(token) -> U256` so a
///      single oracle that maps `token => price` is the cleanest mapping. We expose:
///        - `latestRoundData(token)`: the natural extension for per-token reads (used by the vault).
///        - `latestRoundData()` (no args): Chainlink-style single-feed view, set via `defaultToken()`,
///          so generic Chainlink clients work against a chosen "default" feed.
///      Prices are stored as int256 with 8 decimals (Chainlink convention). Each `setPrice` advances
///      a per-token round counter and stamps `updatedAt = block.timestamp`. Reads revert with
///      `StalePrice` when `block.timestamp - updatedAt > maxAge`.
contract MockOracle is Ownable, IAggregatorV3 {
    /// @dev Per-token feed state.
    struct Feed {
        int256 answer;
        uint64 updatedAt;
        uint80 roundId;
        bool initialized;
    }

    /// @notice Number of decimals every feed exposes. Matches Chainlink AggregatorV3.
    uint8 public constant DECIMALS = 8;

    /// @notice Maximum allowed staleness in seconds. Reads older than this revert.
    uint256 public maxAge;

    /// @notice Optional default token used by the no-argument Chainlink-style `latestRoundData()`.
    address public defaultToken;

    mapping(address token => Feed feed) private _feeds;

    /// @notice Emitted when a feed price is updated (or initialised).
    event PriceUpdated(address indexed token, int256 answer, uint80 roundId, uint64 updatedAt);

    /// @notice Emitted when the staleness window changes.
    event MaxAgeUpdated(uint256 oldMaxAge, uint256 newMaxAge);

    /// @notice Emitted when the default token (for the no-arg view) changes.
    event DefaultTokenUpdated(address indexed oldToken, address indexed newToken);

    /// @dev Read attempted on a feed that has never been set.
    error FeedNotInitialized(address token);
    /// @dev Read attempted on a feed older than `maxAge` seconds.
    error StalePrice(address token, uint256 updatedAt, uint256 nowTs, uint256 maxAge);
    /// @dev Set/update attempted with a non-positive price.
    error InvalidPrice(int256 answer);
    /// @dev No default token configured for the no-arg `latestRoundData()`.
    error DefaultTokenNotSet();

    /// @param maxAge_ Initial staleness window in seconds (e.g. 3600 for MVP, 60–300 in prod).
    constructor(uint256 maxAge_) Ownable(msg.sender) {
        maxAge = maxAge_;
        emit MaxAgeUpdated(0, maxAge_);
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    /// @notice Set the price for `token`. Owner-only.
    /// @param token  Token address whose USD price is being updated.
    /// @param answer Price with 8 decimals (e.g. $200.00 -> 200_00000000). Must be > 0.
    function setPrice(address token, int256 answer) external onlyOwner {
        if (answer <= 0) revert InvalidPrice(answer);
        Feed storage f = _feeds[token];
        unchecked {
            f.roundId = f.roundId + 1;
        }
        f.answer = answer;
        f.updatedAt = uint64(block.timestamp);
        f.initialized = true;
        emit PriceUpdated(token, answer, f.roundId, f.updatedAt);
    }

    /// @notice Update the staleness window. Owner-only.
    function setMaxAge(uint256 newMaxAge) external onlyOwner {
        emit MaxAgeUpdated(maxAge, newMaxAge);
        maxAge = newMaxAge;
    }

    /// @notice Configure the token returned by the no-argument `latestRoundData()` view.
    /// @dev Enables drop-in compatibility with single-feed Chainlink consumers.
    function setDefaultToken(address token) external onlyOwner {
        emit DefaultTokenUpdated(defaultToken, token);
        defaultToken = token;
    }

    // ---------------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------------

    /// @notice Chainlink-compatible decimals view.
    function decimals() external pure returns (uint8) {
        return DECIMALS;
    }

    /// @notice Chainlink-compatible description.
    function description() external pure returns (string memory) {
        return "Tessera MockOracle (multi-feed, 8 decimals)";
    }

    /// @notice Chainlink-compatible version.
    function version() external pure returns (uint256) {
        return 1;
    }

    /// @notice Return the latest round for `token`. Reverts on uninitialised or stale feeds.
    /// @return roundId         Per-token round counter.
    /// @return answer          USD price with 8 decimals.
    /// @return startedAt       Same as `updatedAt` for this mock.
    /// @return updatedAt       Block timestamp at the time of the last `setPrice`.
    /// @return answeredInRound Same as `roundId` for this mock.
    function latestRoundData(address token)
        public
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        Feed storage f = _feeds[token];
        if (!f.initialized) revert FeedNotInitialized(token);
        uint256 ts = block.timestamp;
        if (ts - f.updatedAt > maxAge) {
            revert StalePrice(token, f.updatedAt, ts, maxAge);
        }
        return (f.roundId, f.answer, f.updatedAt, f.updatedAt, f.roundId);
    }

    /// @notice Convenience accessor used by the Stylus vault's `IPriceOracle::price_usd_8`.
    /// @param token Token whose USD price is requested.
    /// @return price 8-decimal USD price as an unsigned integer.
    function priceUsd8(address token) external view returns (uint256 price) {
        (, int256 answer,,,) = latestRoundData(token);
        // setPrice guarantees answer > 0; cast is safe.
        return uint256(answer);
    }

    /// @inheritdoc IAggregatorV3
    /// @dev No-argument Chainlink-compatible view. Requires `defaultToken` to be configured.
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        if (defaultToken == address(0)) revert DefaultTokenNotSet();
        return latestRoundData(defaultToken);
    }

    /// @notice Returns the raw feed metadata (including expired entries). Useful for off-chain debug.
    function getFeed(address token)
        external
        view
        returns (int256 answer, uint64 updatedAt, uint80 roundId, bool initialized)
    {
        Feed storage f = _feeds[token];
        return (f.answer, f.updatedAt, f.roundId, f.initialized);
    }
}
