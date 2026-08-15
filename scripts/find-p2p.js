const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const deployer = "0x65c3768E98eE211a7589fe94c753e11cB8895069";
  const currentNonce = await ethers.provider.getTransactionCount(deployer);
  
  console.log("Current nonce:", currentNonce);
  
  for (let i = currentNonce - 20; i < currentNonce; i++) {
    if (i < 0) continue;
    const address = ethers.getCreateAddress({ from: deployer, nonce: i });
    const code = await ethers.provider.getCode(address);
    if (code !== "0x") {
      console.log(`Nonce ${i} deployed contract at: ${address}`);
    }
  }
}

main().catch(console.error);
