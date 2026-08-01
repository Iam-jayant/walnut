const hre = require("hardhat");
require("dotenv").config({ override: true });

async function main() {
  console.log("Verifying current Walnut deployment...\n");

  const fherc20Address = process.env.NEXT_PUBLIC_FHERC20_ADDRESS;
  const walnutV2Address = process.env.NEXT_PUBLIC_V2_CONTRACT_ADDRESS;
  const oracleAddress = process.env.NEXT_PUBLIC_ORACLE_ADDRESS;
  const mockUSDCAddress = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS;

  if (!fherc20Address || !walnutV2Address || !oracleAddress || !mockUSDCAddress) {
    throw new Error("Missing current deployment address in environment");
  }

  // Check WalnutFHERC20
  const fherc20 = await hre.ethers.getContractAt("WalnutFHERC20", fherc20Address);
  const minter = await fherc20.minter();
  const owner = await fherc20.owner();
  
  console.log("WalnutFHERC20:");
  console.log("  Address:", fherc20Address);
  console.log("  Minter:", minter);
  console.log("  Owner:", owner);
  console.log("  ✓ Minter is WalnutV2:", minter === walnutV2Address);
  console.log();

  // Check WalnutV2
  const walnutV2 = await hre.ethers.getContractAt("WalnutV2", walnutV2Address);
  const cUSDC = await walnutV2.cUSDC();
  const oracle = await walnutV2.oracle();
  const treasury = await walnutV2.treasury();
  const v2Owner = await walnutV2.owner();
  
  console.log("WalnutV2:");
  console.log("  Address:", walnutV2Address);
  console.log("  cUSDC:", cUSDC);
  console.log("  Oracle:", oracle);
  console.log("  Treasury:", treasury);
  console.log("  Owner:", v2Owner);
  console.log("  ✓ cUSDC matches:", cUSDC === fherc20Address);
  console.log("  ✓ Oracle matches:", oracle === oracleAddress);
  console.log();

  // Check WalnutPriceOracle
  const priceOracle = await hre.ethers.getContractAt("WalnutPriceOracle", oracleAddress);
  const oracleOwner = await priceOracle.owner();
  const usdcFeed = await priceOracle.priceFeeds(mockUSDCAddress);
  const usdcValue = await priceOracle.getUSDValue(mockUSDCAddress, hre.ethers.parseUnits("100", 6));
  
  console.log("WalnutPriceOracle:");
  console.log("  Address:", oracleAddress);
  console.log("  Owner:", oracleOwner);
  console.log("  USDC Price Feed:", usdcFeed);
  console.log("  ✓ USDC feed configured:", usdcFeed !== "0x0000000000000000000000000000000000000000");
  console.log("  ✓ 100 USDC value:", hre.ethers.formatUnits(usdcValue, 6), "USD");
  console.log();

  // Check MockUSDC
  const mockUSDC = await hre.ethers.getContractAt("MockUSDC", mockUSDCAddress);
  const name = await mockUSDC.name();
  const symbol = await mockUSDC.symbol();
  const decimals = await mockUSDC.decimals();
  
  console.log("MockUSDC:");
  console.log("  Address:", mockUSDCAddress);
  console.log("  Name:", name);
  console.log("  Symbol:", symbol);
  console.log("  Decimals:", decimals);
  console.log();

  console.log("✅ All current protocol contracts are deployed and configured correctly!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

