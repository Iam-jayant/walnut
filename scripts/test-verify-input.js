const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  console.log("=== TEST TASK MANAGER VERIFY INPUT ===");
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_SEPOLIA_RPC_URL);
  const privateKey = process.env.PRIVATE_KEY.startsWith("0x") ? process.env.PRIVATE_KEY : "0x" + process.env.PRIVATE_KEY;
  const wallet = new ethers.Wallet(privateKey, provider);
  
  const taskManagerAddress = "0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9";
  console.log("TaskManager Address:", taskManagerAddress);
  console.log("User/Sender Address:", wallet.address);

  const abi = [
    "function verifyInput((uint256 ctHash, uint8 securityZone, uint8 utype, bytes signature) input, address sender) external returns (uint256)",
  ];

  const contract = new ethers.Contract(taskManagerAddress, abi, wallet);

  // User latest failed transaction args
  const input = {
    ctHash: "87491427740548116334792601864396931855007198830381808613122240609019102623416",
    securityZone: 0,
    utype: 6,
    signature: "0xbadd1b99d58825bffd4cc1c053dd7a80e67d5835afaba8f70f429bed1b19dbef26d3c63184a8b5b22ca7161d63748eb781d484b7e36743f72c01c69c38235e661c"
  };

  console.log("Simulating verifyInput call...");
  try {
    const res = await contract.verifyInput.staticCall(input, wallet.address);
    console.log("✅ verifyInput static call succeeded!");
    console.log("Returned hash:", res.toString());
  } catch (err) {
    console.error("❌ verifyInput static call reverted!");
    console.error("Error Message:", err.message);
  }
}

main().catch(console.error);
