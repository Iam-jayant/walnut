const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  console.log("=== VERIFY FHERC20 MINTER ===");
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_SEPOLIA_RPC_URL);
  
  const fherc20Address = process.env.NEXT_PUBLIC_FHERC20_ADDRESS;
  console.log("FHERC20 Address:", fherc20Address);

  const abi = [
    "function minter() view returns (address)",
    "function owner() view returns (address)",
  ];

  const fherc20 = new ethers.Contract(fherc20Address, abi, provider);

  try {
    const minter = await fherc20.minter();
    const owner = await fherc20.owner();
    console.log("Actual Minter on-chain:", minter);
    console.log("Actual Owner on-chain:", owner);
    console.log("WalnutLending in .env:", process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS);
    console.log("Match:", minter.toLowerCase() === process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS.toLowerCase() ? "✅" : "❌ MISMATCH!");
  } catch (err) {
    console.error("Error querying FHERC20 details:", err.message);
  }
}

main().catch(console.error);
