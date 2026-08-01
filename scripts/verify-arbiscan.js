const hre = require("hardhat");
require("dotenv").config({ override: true });
require("dotenv").config({ path: ".env.local", override: true });

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

  // Contract addresses from process.env / .env.local
  const mockUSDCAddress = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS || "0x7560A57019cd38689710aFC7cf1adc4955f3e490";
  const oracleAddress = process.env.NEXT_PUBLIC_ORACLE_ADDRESS || "0x928A6d6Ccc99Bc81f36C4e4626C6809f1Ab727Ae";
  const fherc20Address = process.env.NEXT_PUBLIC_FHERC20_ADDRESS || "0x20de52e35269200728124f38548979c4A7dFa97d";
  const walnutV2Address = process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS || "0xc6E963Da6Bb2d1e7B57e24e2C83Db302Eba1479e";
  const treasuryAddress = process.env.TREASURY_ADDRESS || "0x65c3768E98eE211a7589fe94c753e11cB8895069";

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

