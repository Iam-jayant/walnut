const hre = require("hardhat");
require("dotenv").config({ override: true });

/**
 * @title Verify USDC Deposit Readiness
 * @notice Checks all prerequisites for USDC deposits to work
 */

const WALNUT_V2_ADDRESS = "0xaEBF0CD234779DA76cD2F938Fdd029F80b6F98da";
const ORACLE_ADDRESS = "0xA8621c45bfe3A4f163b17Ba509735118fbC7610e";
const MOCK_USDC_ADDRESS = "0x8B7Af5BB6afc6A087fd94A97f53Bf13dFD63E1E2";
const MOCK_USDC_FEED_ADDRESS = "0xb98171039b3A3Bae39B61AD7865e85EC613CeFf5";
const USER_ADDRESS = "0x65c3768E98eE211a7589fe94c753e11cB8895069";

async function main() {
  console.log("========================================");
  console.log("USDC Deposit Readiness Check");
  console.log("Network: Arbitrum Sepolia");
  console.log("========================================\n");

  const [deployer] = await hre.ethers.getSigners();
  
  // ============================================
  // CHECK 1: Contract Not Paused
  // ============================================
  console.log("Check 1/6: WalnutV2 not paused...");
  const WalnutV2 = await hre.ethers.getContractFactory("WalnutV2");
  const walnutV2 = WalnutV2.attach(WALNUT_V2_ADDRESS);
  const isPaused = await walnutV2.paused();
  console.log(isPaused ? "❌ FAIL: Contract is paused" : "✅ PASS: Contract is not paused");
  console.log();

  // ============================================
  // CHECK 2: Oracle Contract Accessible
  // ============================================
  console.log("Check 2/6: Oracle contract accessible...");
  const WalnutPriceOracle = await hre.ethers.getContractFactory("WalnutPriceOracle");
  const oracle = WalnutPriceOracle.attach(ORACLE_ADDRESS);
  const oracleAddress = await walnutV2.oracle();
  const oracleMatch = oracleAddress.toLowerCase() === ORACLE_ADDRESS.toLowerCase();
  console.log(oracleMatch ? "✅ PASS: Oracle configured correctly" : "❌ FAIL: Oracle mismatch");
  console.log("   Expected:", ORACLE_ADDRESS);
  console.log("   Actual:", oracleAddress);
  console.log();

  // ============================================
  // CHECK 3: Price Feed Registered
  // ============================================
  console.log("Check 3/6: USDC price feed registered...");
  const registeredFeed = await oracle.priceFeeds(MOCK_USDC_ADDRESS);
  const feedRegistered = registeredFeed.toLowerCase() === MOCK_USDC_FEED_ADDRESS.toLowerCase();
  console.log(feedRegistered ? "✅ PASS: Price feed registered" : "❌ FAIL: Price feed not registered");
  console.log("   Registered feed:", registeredFeed);
  console.log("   Expected feed:", MOCK_USDC_FEED_ADDRESS);
  console.log();

  // ============================================
  // CHECK 4: Price Feed Working
  // ============================================
  console.log("Check 4/6: Price feed returns valid data...");
  try {
    const testAmount = hre.ethers.parseUnits("100", 6); // 100 USDC
    const usdValue = await oracle.getUSDValue(MOCK_USDC_ADDRESS, testAmount);
    const usdValueFormatted = hre.ethers.formatUnits(usdValue, 6);
    console.log("✅ PASS: Price feed working");
    console.log("   100 USDC =", usdValueFormatted, "USD");
  } catch (error) {
    console.log("❌ FAIL: Price feed error:", error.message);
  }
  console.log();

  // ============================================
  // CHECK 5: User Has USDC Balance
  // ============================================
  console.log("Check 5/6: User has USDC balance...");
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const mockUSDC = MockUSDC.attach(MOCK_USDC_ADDRESS);
  const userBalance = await mockUSDC.balanceOf(USER_ADDRESS);
  const userBalanceFormatted = hre.ethers.formatUnits(userBalance, 6);
  console.log(userBalance > 0 ? "✅ PASS: User has USDC" : "❌ FAIL: User has no USDC");
  console.log("   User address:", USER_ADDRESS);
  console.log("   USDC balance:", userBalanceFormatted, "USDC");
  console.log();

  // ============================================
  // CHECK 6: User Has ETH for Gas
  // ============================================
  console.log("Check 6/6: User has ETH for gas...");
  const ethBalance = await hre.ethers.provider.getBalance(USER_ADDRESS);
  const ethBalanceFormatted = hre.ethers.formatEther(ethBalance);
  console.log(ethBalance > 0 ? "✅ PASS: User has ETH" : "❌ FAIL: User has no ETH");
  console.log("   ETH balance:", ethBalanceFormatted, "ETH");
  console.log();

  // ============================================
  // SUMMARY
  // ============================================
  console.log("========================================");
  console.log("SUMMARY");
  console.log("========================================");
  
  const allChecks = [
    !isPaused,
    oracleMatch,
    feedRegistered,
    userBalance > 0n,
    ethBalance > 0n
  ];
  
  const passedChecks = allChecks.filter(Boolean).length;
  const totalChecks = allChecks.length;
  
  console.log(`Checks passed: ${passedChecks}/${totalChecks}`);
  
  if (passedChecks === totalChecks) {
    console.log("\n✅ ALL CHECKS PASSED - USDC DEPOSITS ARE READY!");
    console.log("\nNext steps:");
    console.log("1. Go to http://localhost:3000/app/deposit");
    console.log("2. Connect wallet:", USER_ADDRESS);
    console.log("3. Select 'USDC - USD Coin'");
    console.log("4. Enter amount (e.g., 100)");
    console.log("5. Click 'Approve USDC'");
    console.log("6. Click 'Deposit'");
    console.log("\n🚀 The deposit should work now!");
  } else {
    console.log("\n❌ SOME CHECKS FAILED - FIX ISSUES BEFORE TESTING");
  }
  console.log("========================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
