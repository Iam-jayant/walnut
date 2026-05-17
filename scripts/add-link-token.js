const hre = require("hardhat");
require("dotenv").config({ override: true });

/**
 * @title Add LINK Token Support
 * @notice Registers LINK token with WalnutPriceOracle
 */

const ORACLE_ADDRESS = "0xA8621c45bfe3A4f163b17Ba509735118fbC7610e";
const LINK_TOKEN = "0x152b0df80135c63b4cb1fbe00ddce7e9a8ffcb04"; // LINK on Arb Sepolia
const LINK_USD_FEED = "0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298"; // LINK/USD on Arb Sepolia

async function main() {
  console.log("========================================");
  console.log("Add LINK Token Support");
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
  console.log("LINK token:", LINK_TOKEN);
  console.log("LINK/USD feed:", LINK_USD_FEED);
  console.log();

  // Check if LINK feed is already registered
  console.log("Checking if LINK feed is already registered...");
  const currentFeed = await oracle.priceFeeds(LINK_TOKEN);
  
  if (currentFeed !== "0x0000000000000000000000000000000000000000") {
    console.log("✅ LINK feed already registered:", currentFeed);
    
    if (currentFeed.toLowerCase() === LINK_USD_FEED.toLowerCase()) {
      console.log("✅ Feed address matches - no action needed");
      return;
    } else {
      console.log("⚠️  Feed address differs - updating...");
    }
  } else {
    console.log("📝 LINK feed not registered - adding...");
  }

  // Register LINK price feed
  console.log("\nRegistering LINK/USD price feed...");
  const tx = await oracle.setPriceFeed(LINK_TOKEN, LINK_USD_FEED);
  await tx.wait();
  console.log("✅ LINK/USD feed registered");
  console.log("   Transaction hash:", tx.hash);

  // Verify registration
  const verifyFeed = await oracle.priceFeeds(LINK_TOKEN);
  console.log("   Verified feed address:", verifyFeed);

  // Test price fetch
  console.log("\nTesting LINK price fetch...");
  try {
    const testAmount = hre.ethers.parseUnits("1", 18); // 1 LINK
    const usdValue = await oracle.getUSDValue(LINK_TOKEN, testAmount);
    console.log("✅ Price fetch successful");
    console.log("   1 LINK =", hre.ethers.formatUnits(usdValue, 6), "USD");
  } catch (error) {
    console.error("❌ Price fetch failed:", error.message);
  }

  console.log("\n========================================");
  console.log("LINK TOKEN SUPPORT ADDED");
  console.log("========================================");
  console.log("Token: LINK (Chainlink)");
  console.log("Address:", LINK_TOKEN);
  console.log("Price Feed:", LINK_USD_FEED);
  console.log("Oracle:", ORACLE_ADDRESS);
  console.log("========================================\n");

  console.log("✅ LINK token is now supported for deposits!");
  console.log("\nNext steps:");
  console.log("1. Users can now deposit LINK as collateral");
  console.log("2. LINK deposits will be priced using Chainlink LINK/USD feed");
  console.log("3. Test deposit flow: Get LINK from faucet → approve() → deposit()");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
