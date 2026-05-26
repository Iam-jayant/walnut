const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  console.log("=== REAL BORROW SIMULATION ===");
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_SEPOLIA_RPC_URL);
  const privateKey = process.env.PRIVATE_KEY.startsWith("0x") ? process.env.PRIVATE_KEY : "0x" + process.env.PRIVATE_KEY;
  const wallet = new ethers.Wallet(privateKey, provider);
  
  const lendingAddress = process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS;
  console.log("Lending Address:", lendingAddress);
  console.log("User Address:", wallet.address);

  const abi = [
    "function borrow(tuple(uint256 ctHash, uint8 securityZone, uint8 utype, bytes signature) encryptedAmount) external",
    "function _collateral(address) view returns (uint256)",
    "function creditTier(address) view returns (uint8)",
    "function tierLTVs(uint256) view returns (uint16)",
  ];

  const contract = new ethers.Contract(lendingAddress, abi, wallet);

  // User parameters from console log
  const encryptedAmount = {
    ctHash: "87491427740548116334792601864396931855007198830381808613122240609019102623416",
    securityZone: 0,
    utype: 6,
    signature: "0xbadd1b99d58825bffd4cc1c053dd7a80e67d5835afaba8f70f429bed1b19dbef26d3c63184a8b5b22ca7161d63748eb781d484b7e36743f72c01c69c38235e661c"
  };

  console.log("Simulating with exact parameters from console error...");
  try {
    const gasEstimate = await contract.borrow.estimateGas(encryptedAmount);
    console.log("✅ Simulation succeeded! Gas estimate:", gasEstimate.toString());
  } catch (err) {
    console.error("❌ Simulation failed:");
    console.error("Message:", err.message);
    if (err.data) {
      console.error("Revert Data:", err.data);
    }
  }
}

main().catch(console.error);
