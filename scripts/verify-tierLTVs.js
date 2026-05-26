const hre = require("hardhat");

async function main() {
  const lendingAddress = "0x1A65C6397329f228B51738F9c8122A52538A9a43";
  
  console.log("Verifying tierLTVs for WalnutLending at:", lendingAddress);
  console.log("-".repeat(60));
  
  const WalnutLending = await hre.ethers.getContractFactory("WalnutLending");
  const lending = WalnutLending.attach(lendingAddress);
  
  for (let i = 0; i < 5; i++) {
    try {
      const ltv = await lending.tierLTVs(i);
      const ltvNumber = Number(ltv);
      const ltvPercent = ltvNumber / 100;
      console.log(`Tier ${i}: ${ltvNumber} bps (${ltvPercent}%)`);
    } catch (error) {
      console.log(`Tier ${i}: ERROR - ${error.message}`);
    }
  }
  
  console.log("-".repeat(60));
  console.log("✅ Verification complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
