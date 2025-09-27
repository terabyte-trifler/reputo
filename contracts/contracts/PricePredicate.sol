// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal Chainlink AggregatorV3Interface
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (uint80, int256, uint256, uint256, uint80);
}

/// @title PricePredicate (Chainlink-based)
/// @notice Used as a 1inch LOP predicate via staticcall. TRUE when price condition holds.
contract PricePredicate {
    AggregatorV3Interface public immutable feed; // e.g., ETH/USD
    address public immutable owner;

    constructor(address feed_) {
        require(feed_ != address(0), "feed=0");
        feed = AggregatorV3Interface(feed_);
        owner = msg.sender;
    }

    /// @dev Return true if price >= threshold (both in 1e8 unless you re-scale)
    function isPriceGte(int256 threshold) external view returns (bool) {
        (, int256 price,,,) = feed.latestRoundData();
        require(price > 0, "no price");
        return price >= threshold;
    }

    /// @dev Return true if price <= threshold
    function isPriceLte(int256 threshold) external view returns (bool) {
        (, int256 price,,,) = feed.latestRoundData();
        require(price > 0, "no price");
        return price <= threshold;
    }
}
