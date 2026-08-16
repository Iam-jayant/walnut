const hre = require("hardhat");
const { ethers } = hre;
require("dotenv").config({ path: ".env.local" });

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  const MOCK_USDC_ADDRESS = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS;
  const targetWallet = "0x2F1a541F22082eF155fBAC522ED4007980d12B21";
  const amountToMint = ethers.parseUnits("100000", 6); // 100,000 USDC (6 decimals)

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = MockUSDC.attach(MOCK_USDC_ADDRESS);

  console.log(`Minting 100,000 USDC to ${targetWallet}...`);
  const tx = await mockUSDC.mint(targetWallet, amountToMint);
  console.log("Tx Hash:", tx.hash);
  
  await tx.wait();
  console.log("✅ Successfully minted MockUSDC!");
}

main().catch(console.error);
