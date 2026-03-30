const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config({ override: true });
const hre = require("hardhat");

function ensureRequiredEnv() {
  const hasPk = Boolean(process.env.PRIVATE_KEY || process.env.NEXT_PUBLIC_PRIVATE_KEY);
  const hasRpc = Boolean(process.env.RPC_URL || process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL);

  if (!hasPk) {
    throw new Error("Missing PRIVATE_KEY in .env");
  }

  if (!hasRpc) {
    throw new Error("Missing RPC_URL in .env");
  }
}

function upsertEnvValue(key, value) {
  const envPath = path.resolve(process.cwd(), ".env");
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");

  let next;
  if (pattern.test(existing)) {
    next = existing.replace(pattern, line);
  } else {
    next = `${existing.trimEnd()}\n${line}\n`;
  }

  fs.writeFileSync(envPath, next, "utf8");
}

async function main() {
  ensureRequiredEnv();

  const WalnutWave1 = await hre.ethers.getContractFactory("WalnutWave1");
  const contract = await WalnutWave1.deploy();
  await contract.waitForDeployment();

  const deployedAddress = await contract.getAddress();
  const deployTx = contract.deploymentTransaction();
  const txHash = deployTx ? deployTx.hash : "unavailable";

  upsertEnvValue("NEXT_PUBLIC_WALNUT_CONTRACT_ADDRESS", deployedAddress);

  console.log("DEPLOYED_CONTRACT_ADDRESS=" + deployedAddress);
  console.log("DEPLOYMENT_TX_HASH=" + txHash);
  console.log("UPDATED_ENV_KEY=NEXT_PUBLIC_WALNUT_CONTRACT_ADDRESS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
