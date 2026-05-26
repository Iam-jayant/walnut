const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const mockUSDCAddress = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS;
  
  console.log("Minting MockUSDC for:", deployer.address);
  console.log("Token Address:", mockUSDCAddress);

  const mockUSDC = await hre.ethers.getContractAt("MockUSDC", mockUSDCAddress);
  
  // Mint 10,000 USDC (6 decimals)
  const amount = hre.ethers.parseUnits("10000", 6);
  
  const tx = await mockUSDC.mint(deployer.address, amount);
  await tx.wait();
  
  console.log("✅ Successfully minted 10,000 MockUSDC!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
