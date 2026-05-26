const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  console.log("=== CHECK ENCRYPTED COLLATERAL ===");
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_SEPOLIA_RPC_URL);
  
  const lendingAddress = process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS;
  const userAddress = "0x65c3768E98eE211a7589fe94c753e11cB8895069";
  
  console.log("Lending Address:", lendingAddress);
  console.log("User Address:", userAddress);

  const abi = [
    "function getEncryptedCollateral(address user) view returns (bytes32)",
    "function getEncryptedDebt(address user) view returns (bytes32)",
  ];

  const contract = new ethers.Contract(lendingAddress, abi, provider);

  try {
    const collateralBytes = await contract.getEncryptedCollateral(userAddress);
    console.log("Encrypted Collateral Bytes:", collateralBytes);
    
    // In mock FHE, bytes32 is often just the padded uint256 value of the underlying plaintext
    const collateralValue = ethers.toBigInt(collateralBytes);
    console.log("As Integer:", collateralValue.toString());
    console.log("As USD Plaintext:", ethers.formatUnits(collateralValue, 6));

    const debtBytes = await contract.getEncryptedDebt(userAddress);
    console.log("Encrypted Debt Bytes:", debtBytes);
    const debtValue = ethers.toBigInt(debtBytes);
    console.log("Debt As Integer:", debtValue.toString());
  } catch (err) {
    console.error("Error:", err.message);
  }
}

main().catch(console.error);
