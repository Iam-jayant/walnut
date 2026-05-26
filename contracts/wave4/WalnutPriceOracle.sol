// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice WalnutPriceOracle: Chainlink Price Feed Wrapper Contract

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/**
 * @title WalnutPriceOracle
 * @notice Chainlink price oracle wrapper for USD value conversion
 * @dev Fetches real-time USD prices for collateral tokens using Chainlink aggregators
 * 
 * Key Features:
 * - Configurable price feeds for multiple tokens (ETH, USDC, etc.)
 * - Staleness check (1 hour threshold)
 * - Decimal conversion (token decimals → 6 decimals USD)
 * - Price validation (price > 0)
 * - Owner-controlled feed management
 * 
 * Requirements:
 * - Owner can configure price feeds via setPriceFeed()
 * - getUSDValue() returns USD value with 6 decimals (USDC precision)
 * - Reverts on stale prices (>1 hour old)
 * - Reverts on missing price feeds
 * - Reverts on invalid prices (≤0)
 * 
 * Supported Price Feeds (Arbitrum Sepolia):
 * - ETH/USD: 0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165
 * - USDC/USD: 0x0153002d20B96532C639313c291Fbd1E7b65F3a8
 */
contract WalnutPriceOracle {
    // Access control
    address public owner;
    
    // Price feed configuration
    mapping(address => address) public priceFeeds; // token => Chainlink aggregator
    
    // Constants
    uint256 public constant STALENESS_THRESHOLD = 1 hours;
    uint256 public constant USD_DECIMALS = 6; // USDC precision
    
    // Events
    event PriceFeedSet(address indexed token, address indexed feed);
    
    /**
     * @notice Initializes the WalnutPriceOracle
     * @dev Sets deployer as owner
     */
    constructor() {
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    /**
     * @notice Sets or updates a price feed for a token
     * @dev Only owner can call. Allows adding new collateral types
     * @param token The ERC20 token address
     * @param feed The Chainlink aggregator address
     */
    function setPriceFeed(address token, address feed) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(feed != address(0), "Invalid feed");
        
        priceFeeds[token] = feed;
        emit PriceFeedSet(token, feed);
    }
    
    /**
     * @notice Converts token amount to USD value with 6 decimals
     * @dev Queries Chainlink feed, validates staleness and price, handles decimal conversion
     * @param token The ERC20 token address
     * @param amount The token amount (in token decimals)
     * @return usdValue The USD value scaled to 6 decimals
     * 
     * Formula: (amount × price × 10^6) / (10^tokenDecimals × 10^priceDecimals)
     * 
     * Example:
     * - Token: WETH (18 decimals)
     * - Amount: 1 WETH = 1e18
     * - Price: $2000 = 2000e8 (Chainlink uses 8 decimals)
     * - USD Value: (1e18 × 2000e8 × 1e6) / (1e18 × 1e8) = 2000e6 ($2000 with 6 decimals)
     */
    function getUSDValue(address token, uint256 amount) external view returns (uint256) {
        // Check price feed exists
        address feed = priceFeeds[token];
        require(feed != address(0), "No price feed");
        
        // Query Chainlink aggregator
        AggregatorV3Interface aggregator = AggregatorV3Interface(feed);
        (
            /* uint80 roundId */,
            int256 price,
            /* uint256 startedAt */,
            uint256 updatedAt,
            /* uint80 answeredInRound */
        ) = aggregator.latestRoundData();
        
        // Validate price data
        require(block.timestamp - updatedAt < STALENESS_THRESHOLD, "Stale price");
        require(price > 0, "Invalid price");
        
        // Get decimals
        uint8 priceDecimals = aggregator.decimals();
        uint8 tokenDecimals = _getTokenDecimals(token);
        
        // Convert to USD with 6 decimals
        // Formula: (amount × price × 10^USD_DECIMALS) / (10^tokenDecimals × 10^priceDecimals)
        uint256 usdValue = (amount * uint256(price) * (10 ** USD_DECIMALS)) 
                          / (10 ** tokenDecimals) 
                          / (10 ** priceDecimals);
        
        return usdValue;
    }
    
    /**
     * @notice Gets the number of decimals for a token
     * @dev Uses low-level call to handle tokens without decimals() function
     * @param token The ERC20 token address
     * @return decimals The number of decimals (defaults to 18 if call fails)
     */
    function _getTokenDecimals(address token) internal view returns (uint8) {
        // Try to call decimals() function
        (bool success, bytes memory data) = token.staticcall(
            abi.encodeWithSignature("decimals()")
        );
        
        if (success && data.length >= 32) {
            return abi.decode(data, (uint8));
        }
        
        // Default to 18 decimals (standard for most tokens)
        return 18;
    }
}
