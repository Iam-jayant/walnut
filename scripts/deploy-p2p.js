const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // FHERC20 (cUSDC) Address from .env.local
  const cUSDC_Address = "0x78136BC03b4549688C48181a26c521eb2F27F23F";

  const WalnutP2P = await ethers.getContractFactory("WalnutP2P");
  console.log("Deploying WalnutP2P...");
  const walnutP2P = await WalnutP2P.deploy(cUSDC_Address);
  
  await walnutP2P.waitForDeployment();
  const address = await walnutP2P.getAddress();
  
  console.log("=========================================");
  console.log("✅ WalnutP2P deployed to:", address);
  console.log("=========================================");
}

main().catch(console.error);
