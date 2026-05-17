const hre = require("hardhat");
require("dotenv").config({ override: true });

/**
 * @title Add WETH Token Support
 * @notice Registers WETH token with WalnutPriceOracle
 */

const ORACLE_ADDRESS = "0xA8621c45bfe3A4f163b17Ba509735118fbC7610e";
const WETH_TOKEN = "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73"; // WETH on Arb Sepolia
const ETH_USD_FEED = "0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165"; // ETH/USD on Arb Sepolia

async function main() {
  console.log("========================================");
  console.log("Add WETH Token Support");
  console.log("Network: Arbitrum Sepolia");
  console.log("========================================\n");

  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log("Deployer address:", deployerAddress);
  
  const balance = await hre.ethers.provider.getBalance(deployerAddress);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Get oracle contract
  const WalnutPriceOracle = await hre.ethers.getContractFactory("WalnutPriceOracle");
  const oracle = WalnutPriceOracle.attach(ORACLE_ADDRESS);

  console.log("Oracle address:", ORACLE_ADDRESS);
  console.log("WETH token:", WETH_TOKEN);
  console.log("ETH/USD feed:", ETH_USD_FEED);
  console.log();

  // Check if WETH feed is already registered
  console.log("Checking if WETH feed is already registered...");
  const currentFeed = await oracle.priceFeeds(WETH_TOKEN);
  
  if (currentFeed !== "0x0000000000000000000000000000000000000000") {
    console.log("✅ WETH feed already registered:", currentFeed);
    
    if (currentFeed.toLowerCase() === ETH_USD_FEED.toLowerCase()) {
      console.log("✅ Feed address matches - no action needed");
      return;
    } else {
      console.log("⚠️  Feed address differs - updating...");
    }
  } else {
    console.log("📝 WETH feed not registered - adding...");
  }

  // Register WETH price feed
  console.log("\nRegistering ETH/USD price feed for WETH...");
  const tx = await oracle.setPriceFeed(WETH_TOKEN, ETH_USD_FEED);
  await tx.wait();
  console.log("✅ ETH/USD feed registered for WETH");
  console.log("   Transaction hash:", tx.hash);

  // Verify registration
  const verifyFeed = await oracle.priceFeeds(WETH_TOKEN);
  console.log("   Verified feed address:", verifyFeed);

  // Test price fetch
  console.log("\nTesting WETH price fetch...");
  try {
    const testAmount = hre.ethers.parseUnits("1", 18); // 1 WETH
    const usdValue = await oracle.getUSDValue(WETH_TOKEN, testAmount);
    console.log("✅ Price fetch successful");
    console.log("   1 WETH =", hre.ethers.formatUnits(usdValue, 6), "USD");
  } catch (error) {
    console.error("❌ Price fetch failed:", error.message);
  }

  console.log("\n========================================");
  console.log("WETH TOKEN SUPPORT ADDED");
  console.log("========================================");
  console.log("Token: WETH (Wrapped Ethereum)");
  console.log("Address:", WETH_TOKEN);
  console.log("Price Feed:", ETH_USD_FEED);
  console.log("Oracle:", ORACLE_ADDRESS);
  console.log("========================================\n");

  console.log("✅ WETH token is now supported for deposits!");
  console.log("\nNext steps:");
  console.log("1. Users can now deposit WETH as collateral");
  console.log("2. WETH deposits will be priced using Chainlink ETH/USD feed");
  console.log("3. Test deposit flow: Get WETH → approve() → deposit()");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
