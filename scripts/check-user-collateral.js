const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  console.log("=== CHECK USER COLLATERAL ON-CHAIN ===");
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_SEPOLIA_RPC_URL);
  
  const lendingAddress = process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS;
  const userAddress = "0x65c3768E98eE211a7589fe94c753e11cB8895069";
  const mockUsdcAddress = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS;
  
  console.log("Lending Contract Address:", lendingAddress);
  console.log("User Address:", userAddress);
  console.log("Mock USDC Address:", mockUsdcAddress);

  const abi = [
    "function vaultBalanceOf(address user, address token) view returns (uint256)",
    "function getVaults(address user) view returns (tuple(address token, uint256 amount)[])"
  ];

  const contract = new ethers.Contract(lendingAddress, abi, provider);

  try {
    const vaults = await contract.getVaults(userAddress);
    console.log("Vaults list length:", vaults.length);
    if (vaults.length > 0) {
      for (const vault of vaults) {
        console.log(`- Token: ${vault.token}, Amount: ${ethers.formatUnits(vault.amount, 6)}`);
      }
    } else {
      console.log("❌ USER HAS 0 VAULT DEPOSITS ON-CHAIN!");
    }
  } catch (err) {
    console.error("Error checking vaults:", err.message);
  }
}

main().catch(console.error);
