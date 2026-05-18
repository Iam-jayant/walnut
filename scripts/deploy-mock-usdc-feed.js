const hre = require("hardhat");
require("dotenv").config({ override: true });

const ORACLE_ADDRESS = process.env.NEXT_PUBLIC_ORACLE_ADDRESS;
const MOCK_USDC_ADDRESS = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS;

async function main() {
  console.log("========================================");
  console.log("Deploy Mock USDC Price Feed");
  console.log("Network: Arbitrum Sepolia");
  console.log("========================================\n");

  if (!ORACLE_ADDRESS || !MOCK_USDC_ADDRESS) {
    throw new Error("Missing NEXT_PUBLIC_ORACLE_ADDRESS or NEXT_PUBLIC_MOCK_USDC_ADDRESS");
  }

  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log("Deployer address:", deployerAddress);
  
  const balance = await hre.ethers.provider.getBalance(deployerAddress);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "ETH\n");

  // ============================================
  // STEP 1: Deploy MockUSDCPriceFeed
  // ============================================
  console.log("Step 1/2: Deploying MockUSDCPriceFeed...");
  const MockUSDCPriceFeed = await hre.ethers.getContractFactory("MockUSDCPriceFeed");
  const mockFeed = await MockUSDCPriceFeed.deploy();
  await mockFeed.waitForDeployment();
  const mockFeedAddress = await mockFeed.getAddress();
  console.log("✅ MockUSDCPriceFeed deployed at:", mockFeedAddress);
  console.log("   Price: $1.00 (constant)");
  console.log("   Decimals: 8");
  console.log();

  // Test the feed
  console.log("Testing mock feed...");
  const roundData = await mockFeed.latestRoundData();
  const decimals = await mockFeed.decimals();
  const description = await mockFeed.description();
  console.log("✅ Feed test successful");
  console.log("   Description:", description);
  console.log("   Price:", hre.ethers.formatUnits(roundData.answer, decimals), "USD");
  console.log("   Round ID:", roundData.roundId.toString());
  console.log();

  // ============================================
  // STEP 2: Register with Oracle
  // ============================================
  console.log("Step 2/2: Registering mock feed with WalnutPriceOracle...");
  const WalnutPriceOracle = await hre.ethers.getContractFactory("WalnutPriceOracle");
  const oracle = WalnutPriceOracle.attach(ORACLE_ADDRESS);

  const tx = await oracle.setPriceFeed(MOCK_USDC_ADDRESS, mockFeedAddress);
  await tx.wait();
  console.log("✅ Mock feed registered");
  console.log("   Transaction hash:", tx.hash);
  console.log("   Arbiscan:", `https://sepolia.arbiscan.io/tx/${tx.hash}`);
  console.log();

  // Verify registration
  const registeredFeed = await oracle.priceFeeds(MOCK_USDC_ADDRESS);
  console.log("Verifying registration...");
  console.log("   Registered feed:", registeredFeed);
  console.log("   Expected feed:", mockFeedAddress);
  console.log("   Match:", registeredFeed.toLowerCase() === mockFeedAddress.toLowerCase() ? "✅ YES" : "❌ NO");
  console.log();

  // Test price fetch through oracle
  console.log("Testing price fetch through oracle...");
  try {
    const testAmount = hre.ethers.parseUnits("100", 6); // 100 USDC
    const usdValue = await oracle.getUSDValue(MOCK_USDC_ADDRESS, testAmount);
    console.log("✅ Oracle price fetch successful");
    console.log("   100 USDC =", hre.ethers.formatUnits(usdValue, 6), "USD");
  } catch (error) {
    console.log("❌ Oracle price fetch failed:", error.message);
  }
  console.log();

  // ============================================
  // DEPLOYMENT SUMMARY
  // ============================================
  console.log("========================================");
  console.log("DEPLOYMENT SUMMARY");
  console.log("========================================");
  console.log("MockUSDCPriceFeed:", mockFeedAddress);
  console.log("MockUSDC:", MOCK_USDC_ADDRESS);
  console.log("Oracle:", ORACLE_ADDRESS);
  console.log("Price: $1.00 (constant)");
  console.log("========================================\n");

  console.log("✅ USDC deposits are now ready!");
  console.log("\nNext steps:");
  console.log("1. Go to /app/deposit");
  console.log("2. Select 'USDC - USD Coin'");
  console.log("3. Enter amount (e.g., 100)");
  console.log("4. Click 'Approve USDC'");
  console.log("5. Click 'Deposit'");
  console.log("\nThe deposit should work now! 🚀");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
