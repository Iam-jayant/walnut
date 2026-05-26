// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice MockUSDCPriceFeed: Testnet Chainlink Price Feed Mock Contract

/**
 * @title MockUSDCPriceFeed
 * @notice Mock Chainlink price feed for USDC on testnet
 * @dev Returns a constant $1.00 price in Chainlink 8-decimal format
 * 
 * This is standard practice for testnet stablecoin price feeds.
 * USDC is a stablecoin pegged to $1.00, so a hardcoded price is appropriate.
 */
contract MockUSDCPriceFeed {
    // USDC = $1.00 in Chainlink 8-decimal format
    int256 public constant PRICE = 100000000; // 1.00 * 1e8
    uint8 public constant decimals = 8;
    
    /**
     * @notice Returns the latest price data
     * @dev Mimics Chainlink AggregatorV3Interface
     * @return roundId The round ID (always 1 for mock)
     * @return answer The price in 8 decimals ($1.00)
     * @return startedAt Timestamp when the round started
     * @return updatedAt Timestamp when the round was updated
     * @return answeredInRound The round ID in which the answer was computed
     */
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (1, PRICE, block.timestamp, block.timestamp, 1);
    }
    
    /**
     * @notice Returns the description of the price feed
     * @return The description string
     */
    function description() external pure returns (string memory) {
        return "USDC / USD";
    }
}
