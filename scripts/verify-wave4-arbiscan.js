const hre = require("hardhat");
require("dotenv").config({ override: true });

/**
 * Verification script for current Walnut contracts on Arbiscan
 * 
 * This script verifies the current Walnut contracts on Arbiscan:
 * 1. MockUSDC - Testnet ERC20 token
 * 2. WalnutPriceOracle - Chainlink price feed wrapper
 * 3. WalnutFHERC20 - Encrypted stablecoin (cUSDC)
 * 4. WalnutV2 - Main protocol contract
 * 
 * Requirements: 15.8 - Verify all contracts on Arbiscan
 */

async function main() {
  console.log("Starting Walnut contract verification on Arbiscan...\n");
  console.log("Network: Arbitrum Sepolia (Chain ID: 421614)\n");

  // Contract addresses from WAVE4_DEPLOYMENT.md
  const mockUSDCAddress = "0x8B7Af5BB6afc6A087fd94A97f53Bf13dFD63E1E2";
  const oracleAddress = "0xA8621c45bfe3A4f163b17Ba509735118fbC7610e";
  const fherc20Address = "0xC5C8188ECb061dFAaA0bab0865dBd5dDA0218740";
  const walnutV2Address = "0xaEBF0CD234779DA76cD2F938Fdd029F80b6F98da";
  const treasuryAddress = "0x65c3768E98eE211a7589fe94c753e11cB8895069";

  // Track verification results
  const results = {
    success: [],
    failed: [],
    alreadyVerified: []
  };

  // Helper function to verify a contract
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
      if (error.message.includes("Already Verified")) {
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

  // 4. Verify WalnutV2 (constructor arguments: cUSDC, oracle, treasury)
  await verifyContract("WalnutV2", walnutV2Address, [
    fherc20Address,  // cUSDC address
    oracleAddress,   // oracle address
    treasuryAddress  // treasury address
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
  console.log(`  WalnutV2: https://sepolia.arbiscan.io/address/${walnutV2Address}#code`);
  console.log("=".repeat(60) + "\n");

  // Exit with error code if any verifications failed
  if (results.failed.length > 0) {
    console.error("⚠️  Some contracts failed to verify. Please check the errors above.");
    process.exitCode = 1;
  } else {
    console.log("🎉 All current Walnut contracts are verified on Arbiscan.");
  }
}

main().catch((error) => {
  console.error("\n❌ Verification script failed:");
  console.error(error);
  process.exitCode = 1;
});

