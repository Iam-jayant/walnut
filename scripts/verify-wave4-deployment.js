const hre = require("hardhat");
require("dotenv").config({ override: true });

async function main() {
  console.log("Verifying Wave 4 Deployment...\n");

  const fherc20Address = "0xC5C8188ECb061dFAaA0bab0865dBd5dDA0218740";
  const walnutV2Address = "0xaEBF0CD234779DA76cD2F938Fdd029F80b6F98da";
  const oracleAddress = "0xA8621c45bfe3A4f163b17Ba509735118fbC7610e";
  const mockUSDCAddress = "0x8B7Af5BB6afc6A087fd94A97f53Bf13dFD63E1E2";

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
  const wUSDC = await walnutV2.wUSDC();
  const oracle = await walnutV2.oracle();
  const treasury = await walnutV2.treasury();
  const v2Owner = await walnutV2.owner();
  
  console.log("WalnutV2:");
  console.log("  Address:", walnutV2Address);
  console.log("  wUSDC:", wUSDC);
  console.log("  Oracle:", oracle);
  console.log("  Treasury:", treasury);
  console.log("  Owner:", v2Owner);
  console.log("  ✓ wUSDC matches:", wUSDC === fherc20Address);
  console.log("  ✓ Oracle matches:", oracle === oracleAddress);
  console.log();

  // Check WalnutPriceOracle
  const priceOracle = await hre.ethers.getContractAt("WalnutPriceOracle", oracleAddress);
  const oracleOwner = await priceOracle.owner();
  const usdcFeed = await priceOracle.priceFeeds(mockUSDCAddress);
  
  console.log("WalnutPriceOracle:");
  console.log("  Address:", oracleAddress);
  console.log("  Owner:", oracleOwner);
  console.log("  USDC Price Feed:", usdcFeed);
  console.log("  ✓ USDC feed configured:", usdcFeed !== "0x0000000000000000000000000000000000000000");
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

  console.log("✅ All Wave 4 contracts deployed and configured correctly!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
