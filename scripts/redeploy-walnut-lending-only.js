const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config({ override: true });
const hre = require("hardhat");

function requireEnv(key) {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

function upsertEnvValueInFile(filePath, key, value) {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const next = pattern.test(existing)
    ? existing.replace(pattern, line)
    : `${existing.trimEnd()}\n${line}\n`;

  fs.writeFileSync(filePath, next, "utf8");
}

function upsertEnvValue(key, value) {
  upsertEnvValueInFile(path.resolve(process.cwd(), ".env"), key, value);

  const envLocalPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envLocalPath)) {
    upsertEnvValueInFile(envLocalPath, key, value);
  }
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const fherc20Address = requireEnv("NEXT_PUBLIC_FHERC20_ADDRESS");
  const oracleAddress = requireEnv("NEXT_PUBLIC_ORACLE_ADDRESS");
  const treasuryAddress = process.env.TREASURY_ADDRESS || deployerAddress;

  console.log("=================================================");
  console.log("REDEPLOYING WALNUT LENDING ONLY");
  console.log("=================================================");
  console.log("Deployer:", deployerAddress);
  console.log("cUSDC (FHERC20):", fherc20Address);
  console.log("Oracle:", oracleAddress);
  console.log("Treasury:", treasuryAddress);
  console.log("-".repeat(50));

  // Verify that deployer is WalnutFHERC20 owner so they can set the new minter
  const fherc20 = await hre.ethers.getContractAt("WalnutFHERC20", fherc20Address);
  const owner = await fherc20.owner();
  console.log("WalnutFHERC20 Owner:", owner);
  if (owner.toLowerCase() !== deployerAddress.toLowerCase()) {
    throw new Error(`Deployer is not WalnutFHERC20 owner. Owner: ${owner}`);
  }
  console.log("Deployer is owner! Ownership verified ✅");

  // Step 1: Deploy WalnutLending
  console.log("\n1. Deploying WalnutLending...");
  const WalnutLending = await hre.ethers.getContractFactory("WalnutLending");
  const lending = await WalnutLending.deploy(fherc20Address, oracleAddress, treasuryAddress);
  await lending.waitForDeployment();
  const lendingAddress = await lending.getAddress();
  console.log("✅ WalnutLending deployed to:", lendingAddress);

  // Step 2: Set minter on WalnutFHERC20
  console.log("\n2. Setting new WalnutLending as minter on cUSDC...");
  const setMinterTx = await fherc20.setMinter(lendingAddress);
  await setMinterTx.wait();
  console.log("✅ WalnutFHERC20 minter updated successfully!");

  // Step 3: Update env files
  console.log("\n3. Updating environment variables...");
  upsertEnvValue("NEXT_PUBLIC_WALNUT_LENDING_ADDRESS", lendingAddress);
  console.log("✅ NEXT_PUBLIC_WALNUT_LENDING_ADDRESS updated to:", lendingAddress);

  console.log("\n=================================================");
  console.log("✅ REDEPLOYMENT & INTEGRATION COMPLETE!");
  console.log("=================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
