const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_SEPOLIA_RPC_URL);
  
  const addr1 = "0x013a19c3401b19c21390bf3f0bcdf9c01eaafe71";
  const addr2 = "0x778c67b9a9b2bc2befd75fef9d2cf9b4d440a947";
  const lendingAddr = process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS;
  const taskManagerAddr = "0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9";

  console.log("=== INSPECTING ON-CHAIN ADDRESSES ===");
  
  async function checkAddress(addr, name) {
    const code = await provider.getCode(addr);
    console.log(`\nAddress ${name} (${addr}):`);
    if (code === "0x") {
      console.log("- Type: EOA (Externally Owned Account)");
      const balance = await provider.getBalance(addr);
      console.log(`- Balance: ${ethers.formatEther(balance)} ETH`);
    } else {
      console.log("- Type: Contract");
      console.log(`- Code length: ${code.length} chars`);
    }
  }

  await checkAddress(addr1, "Address 1 (from revert)");
  await checkAddress(addr2, "Address 2 (from revert)");
  await checkAddress(lendingAddr, "WalnutLending");
  await checkAddress(taskManagerAddr, "TaskManager");
}

main().catch(console.error);
