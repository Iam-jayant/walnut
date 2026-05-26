const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  console.log("=== CHECK TASK MANAGER CONTRACT ===");
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_SEPOLIA_RPC_URL);
  
  const taskManagerAddress = "0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9";
  console.log("Task Manager Address:", taskManagerAddress);

  try {
    const code = await provider.getCode(taskManagerAddress);
    console.log("Contract Code Length:", code.length);
    if (code === "0x" || code === "0x0") {
      console.log("❌ NO CONTRACT DEPLOYED AT THIS ADDRESS!");
    } else {
      console.log("✅ CONTRACT DEPLOYED SUCCESSFULLY!");
    }
  } catch (err) {
    console.error("Error checking code:", err.message);
  }
}

main().catch(console.error);
