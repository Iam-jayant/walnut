const hre = require("hardhat");
require("dotenv").config({ override: true });

async function main() {
  console.log("Starting Walnut contract verification on Arbiscan...\n");
  console.log("Network: Arbitrum Sepolia (Chain ID: 421614)\n");

  const mockUSDCAddress = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS;
  const oracleAddress = process.env.NEXT_PUBLIC_ORACLE_ADDRESS;
  const fherc20Address = process.env.NEXT_PUBLIC_FHERC20_ADDRESS;
  const walnutLendingAddress = process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS;
  const treasuryAddress = process.env.TREASURY_ADDRESS || "0x65c3768E98eE211a7589fe94c753e11cB8895069"; // fallback to deployer address

  if (!mockUSDCAddress || !oracleAddress || !fherc20Address || !walnutLendingAddress) {
    throw new Error("Missing current deployment addresses in environment. Make sure .env is populated.");
  }

  const results = {
    success: [],
    failed: [],
    alreadyVerified: []
  };

  async function verifyContract(name, address, constructorArgs = []) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Verifying ${name}...`);
    console.log(`Address: ${address}`);
    if (constructorArgs.length > 0) {
      console.log(`Constructor Args: ${JSON.stringify(constructorArgs)}`);
    }
    console.log(`${"=".repeat(60)}`);

    try {
      await hre.run("verify:verify", {
        address: address,
        constructorArguments: constructorArgs,
      });
      console.log(`✅ ${name} verified successfully!`);
      results.success.push(name);
    } catch (error) {
      if (error.message.includes("Already Verified") || error.message.includes("already verified")) {
        console.log(`ℹ️  ${name} is already verified on Arbiscan`);
        results.alreadyVerified.push(name);
      } else {
        console.error(`❌ Failed to verify ${name}:`);
        console.error(error.message);
        results.failed.push({ name, error: error.message });
      }
    }
  }

  // 1. Verify MockUSDC (no constructor arguments)
  await verifyContract("MockUSDC", mockUSDCAddress, []);

  // 2. Verify WalnutPriceOracle (no constructor arguments)
  await verifyContract("WalnutPriceOracle", oracleAddress, []);

  // 3. Verify WalnutFHERC20 (no constructor arguments)
  await verifyContract("WalnutFHERC20", fherc20Address, []);

  // 4. Verify WalnutLending (constructor arguments: cUSDC, oracle, treasury)
  await verifyContract("WalnutLending", walnutLendingAddress, [
    fherc20Address,      // cUSDC address
    oracleAddress,       // oracle address
    treasuryAddress      // treasury address
  ]);

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("VERIFICATION SUMMARY");
  console.log("=".repeat(60));
  
  if (results.success.length > 0) {
    console.log(`\n✅ Successfully Verified (${results.success.length}):`);
    results.success.forEach(name => console.log(`   - ${name}`));
  }
  
  if (results.alreadyVerified.length > 0) {
    console.log(`\nℹ️  Already Verified (${results.alreadyVerified.length}):`);
    results.alreadyVerified.forEach(name => console.log(`   - ${name}`));
  }
  
  if (results.failed.length > 0) {
    console.log(`\n❌ Failed to Verify (${results.failed.length}):`);
    results.failed.forEach(({ name, error }) => {
      console.log(`   - ${name}`);
      console.log(`     Error: ${error.substring(0, 100)}...`);
    });
  }

  console.log("\n" + "=".repeat(60));
  console.log("View verified contracts on Arbiscan:");
  console.log(`  MockUSDC: https://sepolia.arbiscan.io/address/${mockUSDCAddress}#code`);
  console.log(`  WalnutPriceOracle: https://sepolia.arbiscan.io/address/${oracleAddress}#code`);
  console.log(`  WalnutFHERC20: https://sepolia.arbiscan.io/address/${fherc20Address}#code`);
  console.log(`  WalnutLending: https://sepolia.arbiscan.io/address/${walnutLendingAddress}#code`);
  console.log("=".repeat(60) + "\n");
}

main().catch((error) => {
  console.error("\n❌ Verification script failed:");
  console.error(error);
  process.exitCode = 1;
});
