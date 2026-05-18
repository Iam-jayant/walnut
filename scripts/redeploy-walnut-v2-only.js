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

  console.log("Redeploying WalnutV2 only");
  console.log("Deployer:", deployerAddress);
  console.log("wUSDC:", fherc20Address);
  console.log("Oracle:", oracleAddress);
  console.log("Treasury:", treasuryAddress);

  const fherc20 = await hre.ethers.getContractAt("WalnutFHERC20", fherc20Address);
  const owner = await fherc20.owner();
  if (owner.toLowerCase() !== deployerAddress.toLowerCase()) {
    throw new Error(`Deployer is not WalnutFHERC20 owner. Owner: ${owner}`);
  }

  const WalnutV2 = await hre.ethers.getContractFactory("WalnutV2");
  const walnutV2 = await WalnutV2.deploy(fherc20Address, oracleAddress, treasuryAddress);
  await walnutV2.waitForDeployment();
  const walnutV2Address = await walnutV2.getAddress();
  console.log("WalnutV2:", walnutV2Address);

  const setMinterTx = await fherc20.setMinter(walnutV2Address);
  await setMinterTx.wait();
  console.log("Updated WalnutFHERC20 minter:", walnutV2Address);

  upsertEnvValue("NEXT_PUBLIC_V2_CONTRACT_ADDRESS", walnutV2Address);
  console.log("Updated NEXT_PUBLIC_V2_CONTRACT_ADDRESS in .env and .env.local");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
