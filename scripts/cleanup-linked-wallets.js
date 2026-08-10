const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC_URL;
  const privateKey = process.env.PRIVATE_KEY.startsWith("0x") ? process.env.PRIVATE_KEY : "0x" + process.env.PRIVATE_KEY;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const WALNUT_LENDING = process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS;

  const abi = [
    "function getLinkedWallets(address user) view returns (address[])",
    "function linkedWallets(address user, uint256 index) view returns (address)",
    "function unlinkWallet(address secondary) external"
  ];
  const contract = new ethers.Contract(WALNUT_LENDING, abi, wallet);
  
  console.log(`Checking linked wallets for ${wallet.address}...`);
  
  const linked = [];
  for(let i=0; i<20; i++) {
    try {
      const addr = await contract.linkedWallets(wallet.address, i);
      linked.push(addr);
    } catch(e) {
      break;
    }
  }
  
  console.log(`Found ${linked.length} linked wallets.`);
  
  for(const addr of linked) {
    console.log(`Unlinking ${addr}...`);
    try {
      const tx = await contract.unlinkWallet(addr);
      await tx.wait();
      console.log(`✅ Unlinked ${addr}`);
    } catch(e) {
      console.log(`❌ Failed to unlink ${addr}: ${e.message}`);
    }
  }
  console.log("Done unlinking.");
}

main().catch(console.error);
