const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  console.log("=== BORROW SIMULATION DIAGNOSTIC ===");
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_SEPOLIA_RPC_URL);
  const privateKey = process.env.PRIVATE_KEY.startsWith("0x") ? process.env.PRIVATE_KEY : "0x" + process.env.PRIVATE_KEY;
  const wallet = new ethers.Wallet(privateKey, provider);
  
  const lendingAddress = process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS;
  console.log("Target Contract Address:", lendingAddress);
  console.log("User Address:", wallet.address);

  const abi = [
    "function borrow(tuple(bytes data) encryptedAmount) external",
    "function getEncryptedCollateral(address user) view returns (tuple(bigint ctHash, uint8 utype))",
    "function getEncryptedDebt(address user) view returns (tuple(bigint ctHash, uint8 utype))",
    "function creditTier(address user) view returns (uint8)",
    "function tierLTVs(uint256 index) view returns (uint16)",
    "function borrowTimestamp(address user) view returns (uint256)",
    "function stablecoin() view returns (address)",
  ];

  const contract = new ethers.Contract(lendingAddress, abi, wallet);

  // 1. Fetch current on-chain state parameters
  try {
    const stablecoin = await contract.stablecoin();
    const creditTier = await contract.creditTier(wallet.address);
    const ltv = await contract.tierLTVs(creditTier);
    const timestamp = await contract.borrowTimestamp(wallet.address);
    console.log("Stablecoin Address:", stablecoin);
    console.log("User Credit Tier:", creditTier.toString());
    console.log("Tier LTV:", ltv.toString());
    console.log("Borrow Timestamp:", timestamp.toString());
  } catch (err) {
    console.error("State query error:", err.message);
  }

  // 2. Simulate borrow transaction
  console.log("\nSimulating borrow transaction...");
  try {
    // Generate dummy FHE input
    const dummyEncrypted = {
      data: "0x" + "00".repeat(32)
    };

    // Execute static call to see exact revert reason
    await contract.borrow.staticCall(dummyEncrypted);
    console.log("✅ Static call succeeded (no revert)!");
  } catch (err) {
    console.log("\n❌ Static Call Reverted!");
    console.log("Error Message:", err.message);
    if (err.data) {
      console.log("Error Data:", err.data);
    }
  }
}

main().catch(console.error);
