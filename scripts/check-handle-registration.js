const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  console.log("=== CHECK HANDLE REGISTRATION ===");
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_SEPOLIA_RPC_URL);
  
  const taskManagerAddress = "0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9";
  const lendingAddress = process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS;
  const userAddress = "0x65c3768E98eE211a7589fe94c753e11cB8895069";
  
  // The collateral handle we fetched earlier
  const collateralHandle = "0xb548d37074fbb098a096d672f62e8a6f3570c5f1323b41c25aead462030b0600";
  const handleUint = ethers.toBigInt(collateralHandle);

  console.log("TaskManager Address:", taskManagerAddress);
  console.log("Lending Contract Address:", lendingAddress);
  console.log("Collateral Handle:", collateralHandle);

  const abi = [
    "function isAllowed(uint256 ctHash, address account) external returns (bool)",
    "function isPubliclyAllowed(uint256 ctHash) external view returns (bool)",
    "function getDecryptResultSafe(uint256 ctHash) external view returns (uint256, bool)",
  ];

  const contract = new ethers.Contract(taskManagerAddress, abi, provider);

  try {
    const isPublic = await contract.isPubliclyAllowed(handleUint);
    console.log("Is Publicly Allowed:", isPublic);

    // Call getDecryptResultSafe to see if it can be decrypted and if the mock coprocessor knows it
    const [val, decrypted] = await contract.getDecryptResultSafe(handleUint);
    console.log("Is Decrypted in Coprocessor:", decrypted);
    if (decrypted) {
      console.log("Decrypted Value:", val.toString());
      console.log("As USD Decimals:", ethers.formatUnits(val, 6));
    } else {
      console.log("❌ HANDLE NOT DECRYPTED YET (Or unregistered)!");
    }
  } catch (err) {
    console.error("Error querying TaskManager:", err.message);
  }
}

main().catch(console.error);
