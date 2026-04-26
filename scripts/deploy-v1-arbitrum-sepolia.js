const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config({ override: true });
const hre = require("hardhat");

function ensureRequiredEnv() {
  const hasPk = Boolean(process.env.PRIVATE_KEY || process.env.NEXT_PUBLIC_PRIVATE_KEY);
  const hasRpc = Boolean(process.env.RPC_URL || process.env.ARBITRUM_SEPOLIA_RPC_URL);

  if (!hasPk) {
    throw new Error("Missing PRIVATE_KEY in .env");
  }

  if (!hasRpc) {
    throw new Error("Missing ARBITRUM_SEPOLIA_RPC_URL (or RPC_URL) in .env");
  }
}

function upsertEnvValueInFile(filePath, key, value) {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");

  let next;
  if (pattern.test(existing)) {
    next = existing.replace(pattern, line);
  } else {
    next = `${existing.trimEnd()}\n${line}\n`;
  }

  fs.writeFileSync(filePath, next, "utf8");
}

function upsertEnvValue(key, value) {
  const envPath = path.resolve(process.cwd(), ".env");
  upsertEnvValueInFile(envPath, key, value);

  const envLocalPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envLocalPath)) {
    upsertEnvValueInFile(envLocalPath, key, value);
  }
}

async function main() {
  ensureRequiredEnv();

  console.log("Deploying WalnutV1 to Arbitrum Sepolia...");

  const WalnutV1 = await hre.ethers.getContractFactory("WalnutV1");
  const walnut = await WalnutV1.deploy();
  await walnut.waitForDeployment();

  const deployedAddress = await walnut.getAddress();
  const deployTx = walnut.deploymentTransaction();
  const txHash = deployTx ? deployTx.hash : "unavailable";

  upsertEnvValue("NEXT_PUBLIC_CONTRACT_ADDRESS", deployedAddress);

  console.log("✅ WalnutV1 deployed successfully!");
  console.log("DEPLOYED_CONTRACT_ADDRESS=" + deployedAddress);
  console.log("DEPLOYMENT_TX_HASH=" + txHash);
  console.log("UPDATED_ENV_KEY=NEXT_PUBLIC_CONTRACT_ADDRESS");
  console.log("VERIFY_COMMAND=npx hardhat verify --network arbitrumSepolia " + deployedAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
