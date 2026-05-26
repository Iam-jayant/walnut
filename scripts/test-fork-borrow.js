const { ethers, network } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("=== DIAGNOSING BORROW REVERT VIA LOCAL FORK ===");
  
  const userAddress = "0x65c3768E98eE211a7589fe94c753e11cB8895069";
  const lendingAddress = process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS || "0x357cA2Ab0EB0460f88b7dc7e166B4cd294151DbE";
  const stablecoinAddress = process.env.NEXT_PUBLIC_FHERC20_ADDRESS || "0x950155eb114F32F3b0a086C5eB9512fBE9073975";

  console.log("WalnutLending address:", lendingAddress);
  console.log("Stablecoin address:", stablecoinAddress);
  console.log("Impersonating user address:", userAddress);

  // Impersonate the user's wallet
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [userAddress],
  });

  // Give the impersonated user some ETH for gas
  await network.provider.send("hardhat_setBalance", [
    userAddress,
    "0x56BC75E2D63100000", // 100 ETH
  ]);

  // Mine a block to bypass historical block hardfork error in Hardhat EDR provider
  await network.provider.send("hardhat_mine", ["0x1"]);

  const userSigner = await ethers.getSigner(userAddress);

  const abi = [
    "function borrow(tuple(uint256 ctHash, uint8 securityZone, uint8 utype, bytes signature) encryptedAmount) external",
    "function getVaults(address user) view returns (tuple(address token, uint256 amount)[])",
    "function creditTier(address user) view returns (uint8)",
    "function tierLTVs(uint256 index) view returns (uint16)",
    "function stablecoin() view returns (address)",
  ];

  const contract = new ethers.Contract(lendingAddress, abi, userSigner);

  // The latest parameters that failed for the user
  const encryptedAmount = {
    ctHash: "87491427740548116334792601864396931855007198830381808613122240609019102623416",
    securityZone: 0,
    utype: 6,
    signature: "0xbadd1b99d58825bffd4cc1c053dd7a80e67d5835afaba8f70f429bed1b19dbef26d3c63184a8b5b22ca7161d63748eb781d484b7e36743f72c01c69c38235e661c"
  };

  try {
    const stable = await contract.stablecoin();
    console.log("Stablecoin on-chain address:", stable);
    
    const vaults = await contract.getVaults(userAddress);
    console.log(`Vaults length: ${vaults.length}`);
    for (const vault of vaults) {
      console.log(`- Token: ${vault.token}, Amount: ${ethers.formatUnits(vault.amount, 6)}`);
    }

    const tier = await contract.creditTier(userAddress);
    const ltv = await contract.tierLTVs(tier);
    console.log(`Credit Tier: ${tier.toString()}, LTV: ${ltv.toString()}`);

    console.log("\nSending borrow transaction on the fork...");
    // We send an actual transaction on our local fork to get a detailed Hardhat stack trace if it reverts
    const tx = await contract.borrow(encryptedAmount);
    const receipt = await tx.wait();
    console.log("✅ SUCCESS! Transaction succeeded on local fork.");
    console.log("Gas used:", receipt.gasUsed.toString());
  } catch (err) {
    console.error("\n❌ Transaction Reverted on Local Fork!");
    console.error("Message:", err.message);
    if (err.stack) {
      console.error("\nDetailed Stack Trace:\n", err.stack);
    }
  }
}

main().catch(console.error);
