// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/**
 * @title MockChainlinkAggregator
 * @notice Mock Chainlink aggregator for testing WalnutPriceOracle
 * @dev Implements AggregatorV3Interface with configurable price and staleness
 */
contract MockChainlinkAggregator is AggregatorV3Interface {
    uint8 private _decimals;
    int256 private _price;
    uint256 private _updatedAt;
    bool private _isStale;
    
    constructor(uint8 decimals_, int256 initialPrice) {
        _decimals = decimals_;
        _price = initialPrice;
        _updatedAt = block.timestamp;
        _isStale = false;
    }
    
    function decimals() external view override returns (uint8) {
        return _decimals;
    }
    
    function description() external pure override returns (string memory) {
        return "Mock Aggregator";
    }
    
    function version() external pure override returns (uint256) {
        return 1;
    }
    
    function getRoundData(uint80 /* _roundId */)
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (1, _price, block.timestamp, _updatedAt, 1);
    }
    
    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (1, _price, block.timestamp, _updatedAt, 1);
    }
    
    // Test helper functions
    function setPrice(int256 newPrice) external {
        _price = newPrice;
        _updatedAt = block.timestamp;
        _isStale = false;
    }
    
    function setStalePrice() external {
        _isStale = true;
        _updatedAt = block.timestamp - 2 hours; // Make it stale (>1 hour old)
    }
    
    function setUpdatedAt(uint256 timestamp) external {
        _updatedAt = timestamp;
    }
}
