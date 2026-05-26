const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  console.log("=== TEST TASK MANAGER DECRYPT TASK ===");
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_SEPOLIA_RPC_URL);
  const privateKey = process.env.PRIVATE_KEY.startsWith("0x") ? process.env.PRIVATE_KEY : "0x" + process.env.PRIVATE_KEY;
  const wallet = new ethers.Wallet(privateKey, provider);
  
  const taskManagerAddress = "0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9";
  console.log("TaskManager Address:", taskManagerAddress);

  const abi = [
    "function createDecryptTask(uint256 ctHash, address requestor) external",
  ];

  const contract = new ethers.Contract(taskManagerAddress, abi, wallet);

  console.log("Simulating createDecryptTask with requestId = 99999...");
  try {
    const tx = await contract.createDecryptTask.populateTransaction(99999, wallet.address);
    // Try staticCall
    await contract.createDecryptTask.staticCall(99999, wallet.address);
    console.log("✅ Static call succeeded! Arbitrary requestIds can be registered without revert.");
  } catch (err) {
    console.error("❌ Static call reverted!");
    console.error("Error Message:", err.message);
  }
}

main().catch(console.error);
