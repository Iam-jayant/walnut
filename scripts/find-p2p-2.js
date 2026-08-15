const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const deployer = "0x65c3768E98eE211a7589fe94c753e11cB8895069";
  const currentNonce = await ethers.provider.getTransactionCount(deployer);
  
  console.log("Current nonce:", currentNonce);
  
  for (let i = currentNonce - 20; i < currentNonce; i++) {
    if (i < 0) continue;
    const address = ethers.getCreateAddress({ from: deployer, nonce: i });
    
    // Check if it's the P2P contract by trying to read `offerCounter`
    try {
      const p2p = await ethers.getContractAt("WalnutP2P", address);
      const count = await p2p.offerCounter();
      console.log(`✅ FOUND P2P CONTRACT! Address: ${address} (Offer Counter: ${count})`);
      break; // stop when found
    } catch (e) {
      // Not the P2P contract
    }
  }
}

main().catch(console.error);
