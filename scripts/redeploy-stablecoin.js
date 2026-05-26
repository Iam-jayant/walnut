/**
 * redeploy-stablecoin.js
 *
 * Redeploys WalnutFHERC20 (with the _safeBalance fix) and wires it to the
 * existing WalnutLending contract by updating its stablecoin reference.
 *
 * IMPORTANT: WalnutLending does not expose a setStablecoin() function, so we
 * must also redeploy WalnutLending pointing at the new stablecoin address.
 * The script updates .env / .env.local with both new addresses.
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

require("dotenv").config();

function upsertEnvValue(filePath, key, value) {
  let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content = content.trimEnd() + `\n${key}=${value}\n`;
  }
  fs.writeFileSync(filePath, content);
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const ORACLE = process.env.NEXT_PUBLIC_ORACLE_ADDRESS || "0xF84DD89ca3d02017B88aC7c6048e5FA783DC81dD";
  const TREASURY = process.env.NEXT_PUBLIC_TREASURY_ADDRESS || deployer.address;
  const OLD_LENDING = process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS;

  console.log("\n=== Step 1: Deploy new WalnutFHERC20 ===");
  const FHEToken = await hre.ethers.getContractFactory("WalnutFHERC20");
  const fheToken = await FHEToken.deploy();
  await fheToken.waitForDeployment();
  const stablecoinAddress = await fheToken.getAddress();
  console.log("New WalnutFHERC20:", stablecoinAddress);

  console.log("\n=== Step 2: Deploy new WalnutLending pointing at new stablecoin ===");
  const WalnutLending = await hre.ethers.getContractFactory("WalnutLending");
  const lending = await WalnutLending.deploy(stablecoinAddress, ORACLE, TREASURY);
  await lending.waitForDeployment();
  const lendingAddress = await lending.getAddress();
  console.log("New WalnutLending:", lendingAddress);

  console.log("\n=== Step 3: Set WalnutLending as minter on new stablecoin ===");
  const setMinterTx = await fheToken.setMinter(lendingAddress);
  await setMinterTx.wait();
  console.log("Minter set to WalnutLending ✅");

  // Verify
  const minter = await fheToken.minter();
  console.log("Verified minter:", minter);
  if (minter.toLowerCase() !== lendingAddress.toLowerCase()) {
    throw new Error("Minter mismatch!");
  }

  console.log("\n=== Step 4: Update environment files ===");
  const envPath = path.join(__dirname, "../.env");
  const envLocalPath = path.join(__dirname, "../.env.local");

  upsertEnvValue(envPath, "NEXT_PUBLIC_WALNUT_LENDING_ADDRESS", lendingAddress);
  upsertEnvValue(envPath, "NEXT_PUBLIC_STABLECOIN_ADDRESS", stablecoinAddress);
  upsertEnvValue(envLocalPath, "NEXT_PUBLIC_WALNUT_LENDING_ADDRESS", lendingAddress);
  upsertEnvValue(envLocalPath, "NEXT_PUBLIC_STABLECOIN_ADDRESS", stablecoinAddress);

  console.log(".env updated ✅");
  console.log(".env.local updated ✅");

  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("WalnutFHERC20 (new):", stablecoinAddress);
  console.log("WalnutLending (new):", lendingAddress);
  console.log("Oracle (unchanged):", ORACLE);
  console.log("Treasury:", TREASURY);
  console.log("\nNOTE: Previous deposits are on the old contract:", OLD_LENDING);
  console.log("Users must re-deposit on the new contract.");
  console.log("\nRestart the dev server: npm run dev");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
