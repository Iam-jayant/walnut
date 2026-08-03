const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("========================================");
  console.log("Deploying WalnutLendingV2 Only (ACL Fixes)");
  console.log("Network: Arbitrum Sepolia");
  console.log("========================================\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  const fherc20Address = "0x471D0Cc3127295de11A8021C3C4AcC63bA4967d6";
  const oracleAddress = "0x1E77d42C88BE6d7d036149C6e25c04F3d1a7db40";
  const treasuryAddress = deployer.address;

  console.log("Using existing cUSDC: ", fherc20Address);
  console.log("Using existing Oracle:", oracleAddress);
  console.log("Treasury:            ", treasuryAddress);

  console.log("\nDeploying WalnutLendingV2...");
  const WalnutLendingV2 = await hre.ethers.getContractFactory("WalnutLendingV2");
  const walnutV2 = await WalnutLendingV2.deploy(
    fherc20Address,
    oracleAddress,
    treasuryAddress
  );
  await walnutV2.waitForDeployment();
  const walnutV2Address = await walnutV2.getAddress();
  console.log("✅ WalnutLendingV2 deployed at:", walnutV2Address);

  console.log("\nSetting WalnutLendingV2 as minter on cUSDC...");
  const fherc20 = await hre.ethers.getContractAt("WalnutFHERC20", fherc20Address);
  try {
    const setMinterTx = await fherc20.setMinter(walnutV2Address);
    await setMinterTx.wait();
    console.log("✅ Minter updated successfully to:", walnutV2Address);
  } catch (err) {
    console.log("Minter update info:", err.message || err);
  }

  // Update .env file with new NEXT_PUBLIC_WALNUT_LENDING_ADDRESS
  const envPath = path.join(__dirname, "../.env");
  let envContent = fs.readFileSync(envPath, "utf8");
  envContent = envContent.replace(
    /NEXT_PUBLIC_WALNUT_LENDING_ADDRESS=0x[a-fA-F0-9]{40}/,
    `NEXT_PUBLIC_WALNUT_LENDING_ADDRESS=${walnutV2Address}`
  );
  fs.writeFileSync(envPath, envContent, "utf8");
  console.log("✅ Updated NEXT_PUBLIC_WALNUT_LENDING_ADDRESS in .env to:", walnutV2Address);

  console.log("\n========================================");
  console.log("WalnutLendingV2 DEPLOYMENT & ACL UPDATE COMPLETE");
  console.log("New Address:", walnutV2Address);
  console.log("========================================\n");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
