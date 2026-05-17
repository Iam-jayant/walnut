const hre = require("hardhat");
require("dotenv").config({ override: true });

/**
 * @title Token Configuration Script
 * @notice Configures price feeds for additional tokens after initial deployment
 * @dev Run this script to add support for new collateral tokens
 * 
 * Usage:
 *   npx hardhat run scripts/configure-tokens.js --network arbitrumSepolia
 */

// ============================================
// CONFIGURATION
// ============================================

// Oracle contract address (from deployment)
const ORACLE_ADDRESS = process.env.NEXT_PUBLIC_ORACLE_ADDRESS;

// Chainlink Price Feeds on Arbitrum Sepolia
const PRICE_FEEDS = {
  ETH_USD: "0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165",
  USDC_USD: "0x0153002d20B96532C639313c291Fbd1e7b65f3A8",
  USDT_USD: "0x80EDee6f667eCc9f63a0a6f55578F870651f06A4",
  BTC_USD: "0x56a43EB56Da12C0dc1D972ACb089c06a5dEF8e69",
  LINK_USD: "0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298",
};

// ============================================
// TOKEN ADDRESSES TO CONFIGURE
// ============================================
// Update these with real Arbitrum Sepolia addresses

const TOKENS_TO_CONFIGURE = [
  {
    name: "WETH",
    symbol: "WETH",
    address: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73", // Arbitrum Sepolia WETH
    priceFeed: PRICE_FEEDS.ETH_USD,
    decimals: 18,
  },
  // Uncomment and update addresses as you find them:
  /*
  {
    name: "Tether USD",
    symbol: "USDT",
    address: "0xYourUSDTAddress", // Update with real address
    priceFeed: PRICE_FEEDS.USDT_USD,
    decimals: 6,
  },
  {
    name: "Wrapped Bitcoin",
    symbol: "WBTC",
    address: "0xYourWBTCAddress", // Update with real address
    priceFeed: PRICE_FEEDS.BTC_USD,
    decimals: 8,
  },
  {
    name: "Chainlink Token",
    symbol: "LINK",
    address: "0xYourLINKAddress", // Update with real address
    priceFeed: PRICE_FEEDS.LINK_USD,
    decimals: 18,
  },
  */
];

// ============================================
// MAIN FUNCTION
// ============================================

async function main() {
  console.log("========================================");
  console.log("Token Configuration Script");
  console.log("Network: Arbitrum Sepolia");
  console.log("========================================\n");

  // Validate oracle address
  if (!ORACLE_ADDRESS) {
    throw new Error("ORACLE_ADDRESS not found in environment variables");
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer address:", await deployer.getAddress());
  console.log("Oracle address:", ORACLE_ADDRESS);
  console.log();

  // Get oracle contract
  const oracle = await hre.ethers.getContractAt("WalnutPriceOracle", ORACLE_ADDRESS);

  // Configure each token
  console.log(`Configuring ${TOKENS_TO_CONFIGURE.length} token(s)...\n`);

  for (let i = 0; i < TOKENS_TO_CONFIGURE.length; i++) {
    const token = TOKENS_TO_CONFIGURE[i];
    
    console.log(`[${i + 1}/${TOKENS_TO_CONFIGURE.length}] Configuring ${token.symbol}...`);
    console.log(`   Name: ${token.name}`);
    console.log(`   Address: ${token.address}`);
    console.log(`   Price Feed: ${token.priceFeed}`);
    console.log(`   Decimals: ${token.decimals}`);

    try {
      // Set price feed
      const tx = await oracle.setPriceFeed(token.address, token.priceFeed);
      await tx.wait();
      
      console.log(`   ✅ Price feed configured successfully`);
      console.log(`   Transaction: ${tx.hash}\n`);
    } catch (error) {
      console.log(`   ❌ Failed to configure: ${error.message}\n`);
    }
  }

  // ============================================
  // VERIFICATION
  // ============================================
  console.log("========================================");
  console.log("VERIFICATION");
  console.log("========================================");

  for (const token of TOKENS_TO_CONFIGURE) {
    try {
      // This will revert if no price feed is configured
      const testAmount = hre.ethers.parseUnits("1", token.decimals);
      const usdValue = await oracle.getUSDValue(token.address, testAmount);
      
      console.log(`✅ ${token.symbol}: 1 ${token.symbol} = $${hre.ethers.formatUnits(usdValue, 6)} USD`);
    } catch (error) {
      console.log(`❌ ${token.symbol}: Price feed not working - ${error.message}`);
    }
  }

  console.log("\n========================================");
  console.log("✅ Token configuration completed!");
  console.log("========================================\n");

  // ============================================
  // NEXT STEPS
  // ============================================
  console.log("NEXT STEPS:");
  console.log("1. Update frontend to display all configured tokens");
  console.log("2. Test deposit flow with each token");
  console.log("3. Verify multi-token collateral works correctly");
  console.log();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
