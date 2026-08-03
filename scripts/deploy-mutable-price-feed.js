/**
 * ============================================================================
 * ⚠️  TESTNET-ONLY — Liquidation Testing Tool
 * ============================================================================
 *
 * Deploys a MockChainlinkAggregator (with mutable setPrice()) and registers
 * it as the USDC price feed in WalnutPriceOracle, replacing the previous
 * hardcoded MockUSDCPriceFeed.
 *
 * This is a DEBUG SCRIPT for Arbitrum Sepolia ONLY. It enables liquidation
 * testing by allowing manual price manipulation to push positions past the
 * 80% LTV liquidation threshold.
 *
 * DOES NOT touch WalnutLendingV2 or any other contract address.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-mutable-price-feed.js --network arbitrumSepolia
 *
 * After running, use scripts/drop-price.js to manipulate the price.
 * ============================================================================
 */

const hre = require("hardhat");
require("dotenv").config({ override: true });

const ORACLE_ADDRESS = process.env.NEXT_PUBLIC_ORACLE_ADDRESS;
const MOCK_USDC_ADDRESS = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS;

async function main() {
  console.log("========================================");
  console.log("⚠️  TESTNET-ONLY: Deploy Mutable Price Feed");
  console.log("Network: Arbitrum Sepolia");
  console.log("========================================\n");

  if (!ORACLE_ADDRESS || !MOCK_USDC_ADDRESS) {
    throw new Error("Missing NEXT_PUBLIC_ORACLE_ADDRESS or NEXT_PUBLIC_MOCK_USDC_ADDRESS in .env");
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", await deployer.getAddress());

  // Step 1: Deploy MockChainlinkAggregator with $1.00 initial price
  console.log("\nStep 1/2: Deploying MockChainlinkAggregator...");
  const MockAgg = await hre.ethers.getContractFactory("MockChainlinkAggregator");
  const initialPrice = 100000000; // $1.00 in 8-decimal Chainlink format
  const feed = await MockAgg.deploy(8, initialPrice);
  await feed.waitForDeployment();
  const feedAddress = await feed.getAddress();
  console.log("✅ MockChainlinkAggregator deployed at:", feedAddress);
  console.log("   Initial price: $1.00 (100000000)");
  console.log("   Has setPrice(): YES");

  // Verify it works
  const roundData = await feed.latestRoundData();
  console.log("   Verification — latestRoundData().answer:", roundData.answer.toString());

  // Step 2: Register with WalnutPriceOracle
  console.log("\nStep 2/2: Registering with WalnutPriceOracle...");
  const oracle = await hre.ethers.getContractAt("WalnutPriceOracle", ORACLE_ADDRESS);
  const tx = await oracle.setPriceFeed(MOCK_USDC_ADDRESS, feedAddress);
  await tx.wait();
  console.log("✅ Registered as USDC price feed");
  console.log("   Tx:", tx.hash);

  // Verify registration
  const registeredFeed = await oracle.priceFeeds(MOCK_USDC_ADDRESS);
  console.log("   Oracle now points to:", registeredFeed);
  console.log("   Match:", registeredFeed.toLowerCase() === feedAddress.toLowerCase() ? "✅" : "❌");

  // Test through oracle
  const testAmount = hre.ethers.parseUnits("100", 6);
  const usdValue = await oracle.getUSDValue(MOCK_USDC_ADDRESS, testAmount);
  console.log("   100 USDC =", hre.ethers.formatUnits(usdValue, 6), "USD (should be 100.00)");

  console.log("\n========================================");
  console.log("DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("Mutable Price Feed:", feedAddress);
  console.log("Oracle:", ORACLE_ADDRESS);
  console.log("MockUSDC:", MOCK_USDC_ADDRESS);
  console.log("\n⚠️  IMPORTANT: Save this address!");
  console.log("   Update .env with:");
  console.log(`   MUTABLE_PRICE_FEED_ADDRESS=${feedAddress}`);
  console.log("\nNext: Run 'npx hardhat run scripts/drop-price.js --network arbitrumSepolia'");
  console.log("      to lower the price and trigger liquidation.\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
