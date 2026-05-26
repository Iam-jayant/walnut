const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  console.log("=== CHECKING BOTH HANDLES IN COPROCESSOR ===");
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_SEPOLIA_RPC_URL);
  
  const taskManagerAddress = "0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9";
  const collateralHandle = "0xb548d37074fbb098a096d672f62e8a6f3570c5f1323b41c25aead462030b0600";
  const borrowHandle = "0xc16e64ab139f6fc6661a75928fb7f672f05510e0390e666b278d57dd94250600"; // decimal 87491427740548116334792601864396931855007198830381808613122240609019102623416

  const abi = [
    "function getDecryptResultSafe(uint256 ctHash) external view returns (uint256, bool)",
  ];

  const contract = new ethers.Contract(taskManagerAddress, abi, provider);

  async function check(handle, name) {
    const handleUint = ethers.toBigInt(handle);
    const [val, decrypted] = await contract.getDecryptResultSafe(handleUint);
    console.log(`\nHandle: ${name} (${handle}):`);
    console.log(`- Decrypted in Coprocessor: ${decrypted}`);
    if (decrypted) {
      console.log(`- Plaintext Value: ${val.toString()}`);
      console.log(`- Formatted: ${ethers.formatUnits(val, 6)}`);
    } else {
      console.log(`- ❌ NOT DECRYPTED/MAPPED IN COPROCESSOR`);
    }
  }

  await check(collateralHandle, "User Collateral Handle");
  await check(borrowHandle, "User Borrow Amount Handle");
}

main().catch(console.error);
