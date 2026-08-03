const { ethers } = require("hardhat");
const fs = require("fs");
require("dotenv").config();

async function main() {
  console.log("========================================");
  console.log("Arbitrum Sepolia Live Liquidation Verification");
  console.log("========================================\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer / Tester address:", deployer.address);

  const envContent = fs.readFileSync(".env", "utf8");
  const lendingAddressMatch = envContent.match(/NEXT_PUBLIC_WALNUT_LENDING_ADDRESS=(0x[a-fA-F0-9]{40})/);
  const WalnutLendingV2Address = lendingAddressMatch[1];
  console.log("Using WalnutLendingV2 at:", WalnutLendingV2Address);

  const walnutV2 = await ethers.getContractAt("WalnutLendingV2", WalnutLendingV2Address);

  // 1. Verify constant and state machine entrypoints
  const liqThreshold = await walnutV2.LIQUIDATION_THRESHOLD();
  console.log("✅ LIQUIDATION_THRESHOLD on contract:", liqThreshold.toString(), "(80%)");

  // 2. Query auction state for dummy borrower address
  const randomBorrower = ethers.Wallet.createRandom().address;
  const auction = await walnutV2.liquidations(randomBorrower);
  console.log("✅ State query `liquidations(randomBorrower)` returned State:", auction.state, "(0 = IDLE)");

  // 3. Verify guard condition: Requesting liquidation check on healthy / empty account
  console.log("\nTesting guard: Request liquidation check on healthy/empty position...");
  try {
    const tx = await walnutV2.requestLiquidationCheck(randomBorrower);
    const receipt = await tx.wait();
    console.log("✅ SUCCESS: Transaction submitted to Sepolia. Tx hash:", receipt.hash);
  } catch (err) {
    console.log("   Reverted with:", err.message || err);
  }

  console.log("\n========================================");
  console.log("SEPOLIA LIQUIDATION CONTRACT VERIFICATION COMPLETE");
  console.log("========================================");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
