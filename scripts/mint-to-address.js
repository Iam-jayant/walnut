const hre = require("hardhat");
require("dotenv").config({ override: true });

/**
 * @title Mint MockUSDC to Specific Address
 * @notice Mints test tokens to a specific address
 * Usage: TARGET_ADDRESS=0x... MINT_AMOUNT=1000 npx hardhat run scripts/mint-to-address.js --network arbitrumSepolia
 */

const MOCK_USDC_ADDRESS = "0x8B7Af5BB6afc6A087fd94A97f53Bf13dFD63E1E2";

async function main() {
  // Get target address and amount from environment variables
  const targetAddress = process.env.TARGET_ADDRESS || "0xd499EF431dBDD87bB0a3a7820254d76a9D198056";
  const amount = process.env.MINT_AMOUNT || "1000";

  console.log("========================================");
  console.log("Mint MockUSDC to Address");
  console.log("========================================\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Minting from:", await deployer.getAddress());
  console.log("Minting to:", targetAddress);
  console.log("Amount:", amount, "USDC\n");

  // Get MockUSDC contract
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const mockUSDC = MockUSDC.attach(MOCK_USDC_ADDRESS);

  // Parse amount (6 decimals for USDC)
  const amountWei = hre.ethers.parseUnits(amount, 6);

  // Check current balance
  const balanceBefore = await mockUSDC.balanceOf(targetAddress);
  console.log("Current balance:", hre.ethers.formatUnits(balanceBefore, 6), "USDC");

  // Mint tokens
  console.log(`\nMinting ${amount} MockUSDC...`);
  const tx = await mockUSDC.mint(targetAddress, amountWei);
  await tx.wait();

  console.log("✅ Minted successfully");
  console.log("   Transaction hash:", tx.hash);
  console.log("   Arbiscan:", `https://sepolia.arbiscan.io/tx/${tx.hash}`);

  // Check new balance
  const balanceAfter = await mockUSDC.balanceOf(targetAddress);
  console.log("\nNew balance:", hre.ethers.formatUnits(balanceAfter, 6), "USDC");

  console.log("\n========================================");
  console.log("TOKENS MINTED");
  console.log("========================================");
  console.log("User can now:");
  console.log("1. Go to /app/deposit");
  console.log("2. Select USDC token");
  console.log("3. Enter amount (e.g., 100)");
  console.log("4. Click 'Approve & Deposit'");
  console.log("========================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
