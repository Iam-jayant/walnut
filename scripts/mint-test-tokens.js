const hre = require("hardhat");
require("dotenv").config({ override: true });

/**
 * @title Mint Test Tokens
 * @notice Mints MockUSDC to a user address for testing
 */

const MOCK_USDC_ADDRESS = "0x8B7Af5BB6afc6A087fd94A97f53Bf13dFD63E1E2";

async function main() {
  // Get arguments from environment or use defaults
  const userAddress = process.env.MINT_TO_ADDRESS || "0x65c3768E98eE211a7589fe94c753e11cB8895069";
  const amount = process.env.MINT_AMOUNT || "10000"; // Default 10,000 USDC

  console.log("========================================");
  console.log("Mint Test Tokens");
  console.log("========================================\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Minting from:", await deployer.getAddress());
  console.log("Minting to:", userAddress);
  console.log("Amount:", amount, "USDC\n");

  // Get MockUSDC contract
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const mockUSDC = MockUSDC.attach(MOCK_USDC_ADDRESS);

  // Mint tokens
  const amountWithDecimals = hre.ethers.parseUnits(amount, 6); // USDC has 6 decimals
  console.log("Minting", amount, "MockUSDC...");
  const tx = await mockUSDC.mint(userAddress, amountWithDecimals);
  await tx.wait();
  console.log("✅ Minted successfully");
  console.log("   Transaction hash:", tx.hash);
  console.log("   Arbiscan:", `https://sepolia.arbiscan.io/tx/${tx.hash}`);

  // Check balance
  const balance = await mockUSDC.balanceOf(userAddress);
  console.log("   New balance:", hre.ethers.formatUnits(balance, 6), "USDC");

  console.log("\n========================================");
  console.log("TOKENS MINTED");
  console.log("========================================");
  console.log("User can now:");
  console.log("1. Go to /app/deposit");
  console.log("2. Select USDC token");
  console.log("3. Enter amount (e.g., 100)");
  console.log("4. Click 'Approve USDC'");
  console.log("5. Click 'Deposit'");
  console.log("========================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
