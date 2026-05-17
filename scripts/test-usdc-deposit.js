const hre = require("hardhat");
require("dotenv").config({ override: true });

/**
 * @title Test USDC Deposit
 * @notice Simulates the exact deposit call from the frontend
 */

const WALNUT_V2_ADDRESS = "0xaEBF0CD234779DA76cD2F938Fdd029F80b6F98da";
const MOCK_USDC_ADDRESS = "0x8B7Af5BB6afc6A087fd94A97f53Bf13dFD63E1E2";
const USER_ADDRESS = "0x65c3768E98eE211a7589fe94c753e11cB8895069";

async function main() {
  console.log("========================================");
  console.log("Test USDC Deposit");
  console.log("Network: Arbitrum Sepolia");
  console.log("========================================\n");

  const [deployer] = await hre.ethers.getSigners();
  
  // Get contracts
  const WalnutV2 = await hre.ethers.getContractFactory("WalnutV2");
  const walnutV2 = WalnutV2.attach(WALNUT_V2_ADDRESS);
  
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const mockUSDC = MockUSDC.attach(MOCK_USDC_ADDRESS);

  // ============================================
  // STEP 1: Check Current State
  // ============================================
  console.log("Step 1/4: Checking current state...");
  const userBalance = await mockUSDC.balanceOf(USER_ADDRESS);
  const allowance = await mockUSDC.allowance(USER_ADDRESS, WALNUT_V2_ADDRESS);
  const isPaused = await walnutV2.paused();
  
  console.log("User USDC balance:", hre.ethers.formatUnits(userBalance, 6), "USDC");
  console.log("Current allowance:", hre.ethers.formatUnits(allowance, 6), "USDC");
  console.log("Contract paused:", isPaused);
  console.log();

  // ============================================
  // STEP 2: Simulate Deposit Call
  // ============================================
  console.log("Step 2/4: Simulating deposit call...");
  const depositAmount = hre.ethers.parseUnits("1", 6); // 1 USDC
  
  try {
    // Use callStatic to simulate the call without sending a transaction
    await walnutV2.deposit.staticCall(MOCK_USDC_ADDRESS, depositAmount, {
      from: USER_ADDRESS
    });
    console.log("✅ Deposit simulation successful!");
    console.log("   Amount:", hre.ethers.formatUnits(depositAmount, 6), "USDC");
  } catch (error) {
    console.log("❌ Deposit simulation failed!");
    console.log("   Error:", error.message);
    
    // Try to decode the error
    if (error.data) {
      console.log("   Error data:", error.data);
    }
    
    // Check specific failure reasons
    console.log("\nDiagnosing failure reason...");
    
    // Check if paused
    if (isPaused) {
      console.log("❌ Contract is paused");
    }
    
    // Check if user has balance
    if (userBalance < depositAmount) {
      console.log("❌ Insufficient USDC balance");
    }
    
    // Check if allowance is sufficient
    if (allowance < depositAmount) {
      console.log("❌ Insufficient allowance (need to approve first)");
    }
    
    // Check oracle
    try {
      const oracle = await walnutV2.oracle();
      const WalnutPriceOracle = await hre.ethers.getContractFactory("WalnutPriceOracle");
      const oracleContract = WalnutPriceOracle.attach(oracle);
      const usdValue = await oracleContract.getUSDValue(MOCK_USDC_ADDRESS, depositAmount);
      console.log("✅ Oracle working (1 USDC =", hre.ethers.formatUnits(usdValue, 6), "USD)");
    } catch (oracleError) {
      console.log("❌ Oracle error:", oracleError.message);
    }
  }
  console.log();

  // ============================================
  // STEP 3: Estimate Gas
  // ============================================
  console.log("Step 3/4: Estimating gas...");
  try {
    const gasEstimate = await walnutV2.deposit.estimateGas(
      MOCK_USDC_ADDRESS,
      depositAmount,
      { from: USER_ADDRESS }
    );
    console.log("✅ Gas estimation successful!");
    console.log("   Estimated gas:", gasEstimate.toString());
  } catch (error) {
    console.log("❌ Gas estimation failed!");
    console.log("   Error:", error.message);
    
    // This is the error the frontend sees
    console.log("\n⚠️  This is why the frontend shows 'Network fee Unavailable'");
  }
  console.log();

  // ============================================
  // STEP 4: Check Price Feed Directly
  // ============================================
  console.log("Step 4/4: Checking price feed directly...");
  try {
    const oracle = await walnutV2.oracle();
    const WalnutPriceOracle = await hre.ethers.getContractFactory("WalnutPriceOracle");
    const oracleContract = WalnutPriceOracle.attach(oracle);
    
    const priceFeed = await oracleContract.priceFeeds(MOCK_USDC_ADDRESS);
    console.log("Registered price feed:", priceFeed);
    
    if (priceFeed === hre.ethers.ZeroAddress) {
      console.log("❌ No price feed registered for USDC!");
    } else {
      console.log("✅ Price feed registered");
      
      // Test the feed
      const MockUSDCPriceFeed = await hre.ethers.getContractFactory("MockUSDCPriceFeed");
      const feed = MockUSDCPriceFeed.attach(priceFeed);
      const roundData = await feed.latestRoundData();
      console.log("   Price:", hre.ethers.formatUnits(roundData.answer, 8), "USD");
    }
  } catch (error) {
    console.log("❌ Price feed check failed:", error.message);
  }
  console.log();

  // ============================================
  // SUMMARY
  // ============================================
  console.log("========================================");
  console.log("DIAGNOSIS COMPLETE");
  console.log("========================================");
  console.log("\nIf gas estimation failed, the issue is:");
  console.log("1. Insufficient allowance (need to approve first)");
  console.log("2. Oracle/price feed issue");
  console.log("3. Contract paused");
  console.log("4. Insufficient balance");
  console.log("\nCheck the errors above to identify the root cause.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
