const hre = require("hardhat");
require("dotenv").config({ override: true });

/**
 * @title Fix USDC Price Feed
 * @notice Tests and potentially fixes the USDC price feed issue
 */

const ORACLE_ADDRESS = "0xA8621c45bfe3A4f163b17Ba509735118fbC7610e";
const MOCK_USDC_ADDRESS = "0x8B7Af5BB6afc6A087fd94A97f53Bf13dFD63E1E2";
const CURRENT_USDC_FEED = "0x0153002d20B96532C639313c291Fbd1e7b65f3A8";

// Alternative USDC feeds on Arbitrum Sepolia (if current one is broken)
const ALTERNATIVE_FEEDS = [
  "0x0153002d20B96532C639313c291Fbd1e7b65f3A8", // Current one
  // We can use ETH/USD as a workaround since 1 USDC ≈ $1
];

const CHAINLINK_ABI = [
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() view returns (uint8)",
];

async function main() {
  console.log("========================================");
  console.log("Fix USDC Price Feed");
  console.log("========================================\n");

  const [deployer] = await hre.ethers.getSigners();

  // Test current feed
  console.log("Testing current USDC/USD feed:", CURRENT_USDC_FEED);
  const feedContract = new hre.ethers.Contract(CURRENT_USDC_FEED, CHAINLINK_ABI, deployer);
  
  try {
    const roundData = await feedContract.latestRoundData();
    const decimals = await feedContract.decimals();
    
    console.log("✅ Feed is working!");
    console.log("   Price:", hre.ethers.formatUnits(roundData.answer, decimals), "USD");
    console.log("   Updated at:", new Date(Number(roundData.updatedAt) * 1000).toISOString());
    console.log("   Round ID:", roundData.roundId.toString());
    
    // Check if price is reasonable (should be close to $1 for USDC)
    const price = Number(hre.ethers.formatUnits(roundData.answer, decimals));
    if (price < 0.95 || price > 1.05) {
      console.log("   ⚠️  Price seems off for a stablecoin:", price);
    }
    
    // Check if data is stale (older than 24 hours)
    const ageInHours = (Date.now() / 1000 - Number(roundData.updatedAt)) / 3600;
    if (ageInHours > 24) {
      console.log("   ⚠️  Data is stale (", ageInHours.toFixed(1), "hours old)");
    }
    
  } catch (error) {
    console.log("❌ Feed is broken:", error.message);
    console.log("\nSolution: Use a mock price for USDC (always $1.00)");
    console.log("Since USDC is a stablecoin, we can safely assume 1 USDC = $1.00");
    
    // For now, let's just document this - the oracle will need to handle this
    console.log("\nWorkaround: Update WalnutPriceOracle to return $1.00 for USDC if feed fails");
  }

  console.log("\n========================================");
  console.log("RECOMMENDATION");
  console.log("========================================");
  console.log("The USDC/USD feed on Arbitrum Sepolia appears to be broken.");
  console.log("For testnet purposes, we should:");
  console.log("1. Remove the USDC price feed from oracle");
  console.log("2. Hardcode USDC = $1.00 in the oracle contract");
  console.log("3. Or use a different testnet stablecoin");
  console.log();
  console.log("For now, let's remove the broken feed:");
  console.log("========================================");

  // Remove the broken feed
  const WalnutPriceOracle = await hre.ethers.getContractFactory("WalnutPriceOracle");
  const oracle = WalnutPriceOracle.attach(ORACLE_ADDRESS);

  console.log("\nRemoving broken USDC price feed...");
  const tx = await oracle.setPriceFeed(MOCK_USDC_ADDRESS, hre.ethers.ZeroAddress);
  await tx.wait();
  console.log("✅ USDC price feed removed");
  console.log("   Transaction:", tx.hash);
  
  console.log("\n⚠️  USDC deposits will now fail with 'No price feed'");
  console.log("This is expected - use WETH or LINK for deposits instead.");
  console.log("\nAlternatively, get WETH:");
  console.log("1. Go to https://sepolia.arbiscan.io/address/0x980B62Da83eFf3D4576C647993b0c1D7faf17c73#writeContract");
  console.log("2. Connect wallet");
  console.log("3. Call 'deposit' with 0.01 ETH");
  console.log("4. Come back and deposit WETH");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
