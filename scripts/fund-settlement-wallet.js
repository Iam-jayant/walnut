const hre = require("hardhat");
require("dotenv").config({ override: true });

/**
 * @title Fund Settlement Wallet Script
 * @notice Funds the Privara settlement wallet with ETH and MockUSDC
 */

const SETTLEMENT_WALLET = "0x2F1a541F22082eF155fBAC522ED4007980d12B21";
const MOCK_USDC_ADDRESS = "0x8B7Af5BB6afc6A087fd94A97f53Bf13dFD63E1E2";
const USDC_AMOUNT = "100000000000"; // 100,000 USDC (6 decimals)
const ETH_AMOUNT = "0.01"; // 0.01 ETH for gas

async function main() {
  console.log("========================================");
  console.log("Fund Settlement Wallet");
  console.log("========================================\n");

  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log("Deployer address:", deployerAddress);
  
  const balance = await hre.ethers.provider.getBalance(deployerAddress);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "ETH\n");

  console.log("Settlement wallet:", SETTLEMENT_WALLET);
  
  // Check current settlement wallet balance
  const settlementBalance = await hre.ethers.provider.getBalance(SETTLEMENT_WALLET);
  console.log("Current settlement wallet balance:", hre.ethers.formatEther(settlementBalance), "ETH\n");

  // ============================================
  // STEP 1: Send ETH to settlement wallet
  // ============================================
  console.log("Step 1/2: Sending", ETH_AMOUNT, "ETH to settlement wallet...");
  const ethTx = await deployer.sendTransaction({
    to: SETTLEMENT_WALLET,
    value: hre.ethers.parseEther(ETH_AMOUNT)
  });
  await ethTx.wait();
  console.log("✅ ETH sent successfully");
  console.log("   Transaction hash:", ethTx.hash);
  
  const newSettlementBalance = await hre.ethers.provider.getBalance(SETTLEMENT_WALLET);
  console.log("   New settlement wallet balance:", hre.ethers.formatEther(newSettlementBalance), "ETH\n");

  // ============================================
  // STEP 2: Mint MockUSDC to settlement wallet
  // ============================================
  console.log("Step 2/2: Minting", USDC_AMOUNT, "MockUSDC (100,000 USDC) to settlement wallet...");
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const mockUSDC = MockUSDC.attach(MOCK_USDC_ADDRESS);
  
  const mintTx = await mockUSDC.mint(SETTLEMENT_WALLET, USDC_AMOUNT);
  await mintTx.wait();
  console.log("✅ MockUSDC minted successfully");
  console.log("   Transaction hash:", mintTx.hash);
  
  const usdcBalance = await mockUSDC.balanceOf(SETTLEMENT_WALLET);
  console.log("   Settlement wallet USDC balance:", hre.ethers.formatUnits(usdcBalance, 6), "USDC\n");

  // ============================================
  // SUMMARY
  // ============================================
  console.log("========================================");
  console.log("FUNDING COMPLETE");
  console.log("========================================");
  console.log("Settlement Wallet:", SETTLEMENT_WALLET);
  console.log("ETH Balance:", hre.ethers.formatEther(newSettlementBalance), "ETH");
  console.log("USDC Balance:", hre.ethers.formatUnits(usdcBalance, 6), "USDC");
  console.log("========================================\n");

  console.log("✅ Settlement wallet is now ready for Privara transactions!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
