const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const deployer = "0x65c3768E98eE211a7589fe94c753e11cB8895069";
  const currentNonce = await ethers.provider.getTransactionCount(deployer);
  
  for (let i = currentNonce - 20; i < currentNonce; i++) {
    if (i < 0) continue;
    const address = ethers.getCreateAddress({ from: deployer, nonce: i });
    
    try {
      const p2p = await ethers.getContractAt("WalnutP2P", address);
      const count = await p2p.offerCounter();
      console.log(`✅ FOUND P2P CONTRACT! Address: ${address} (Nonce: ${i})`);
      break; 
    } catch (e) {
      if (e.message && !e.message.includes("revert")) {
          // print non-revert errors
          // console.log("Error:", e.message);
      }
    }
  }
}

main().catch(console.error);
