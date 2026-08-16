const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  const targetWallet = "0x2F1a541F22082eF155fBAC522ED4007980d12B21";
  const amountToFund = ethers.parseEther("0.01");

  console.log(`Sending 0.05 ETH to ${targetWallet}...`);
  const tx = await deployer.sendTransaction({
    to: targetWallet,
    value: amountToFund
  });
  console.log("Tx Hash:", tx.hash);
  
  await tx.wait();
  console.log("✅ Successfully funded wallet with ETH!");
}

main().catch(console.error);
