const { ethers } = require("ethers");
require("dotenv").config();
const WALNUT_LENDING = process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS;
const rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC_URL;
const provider = new ethers.JsonRpcProvider(rpcUrl);

async function main() {
  const abi = [
    "function linkedWallets(address user, uint256 index) view returns (address)",
    "function getLinkedWallets(address user) view returns (address[])"
  ];
  const contract = new ethers.Contract(WALNUT_LENDING, abi, provider);
  const user = "0x65c3768E98eE211a7589fe94c753e11cB8895069";
  
  console.log("Checking linked wallets for", user);
  try {
    const list = await contract.getLinkedWallets(user);
    console.log("getLinkedWallets:", list);
  } catch(e) {
    console.log("getLinkedWallets failed:", e.message);
  }

  for(let i=0; i<20; i++) {
    try {
      const addr = await contract.linkedWallets(user, i);
      console.log(`Index ${i}: ${addr}`);
    } catch(e) {
      console.log(`Index ${i}: Reverted (likely out of bounds)`);
      break;
    }
  }
}
main().catch(console.error);
