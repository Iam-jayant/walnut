const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  console.log("=== CHECK USER PENDING SYNC STATUS ===");
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_SEPOLIA_RPC_URL);
  const privateKey = process.env.PRIVATE_KEY.startsWith("0x") ? process.env.PRIVATE_KEY : "0x" + process.env.PRIVATE_KEY;
  const wallet = new ethers.Wallet(privateKey, provider);
  
  const lendingAddress = process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS;
  console.log("Lending Address:", lendingAddress);
  console.log("User Address:", wallet.address);

  const abi = [
    "function withdraw(address token, uint256 amount) external",
    "function mockStablecoin() view returns (address)",
  ];

  const contract = new ethers.Contract(lendingAddress, abi, wallet);
  const mockUsdcAddress = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS;

  console.log("Simulating a small withdraw call...");
  try {
    // Simulate withdraw of 1 unit of Mock USDC (should revert due to insufficient balance or sync pending)
    await contract.withdraw.staticCall(mockUsdcAddress, 1);
    console.log("✅ Withdraw simulation did not revert (unexpected)!");
  } catch (err) {
    console.log("❌ Simulation reverted as expected.");
    console.log("Error Message:", err.message);
    if (err.data) {
      console.log("Revert Data:", err.data);
    }
    
    // Check if the revert message indicates sync pending
    if (err.message.includes("borrow sync pending")) {
      console.log("\n⚠️ DETECTED: USER HAS A PENDING DECRYPTION SYNC ON-CHAIN! This is why borrow is reverting.");
    } else {
      console.log("\n✅ SUCCESS: User has NO pending decryption sync on-chain.");
    }
  }
}

main().catch(console.error);
