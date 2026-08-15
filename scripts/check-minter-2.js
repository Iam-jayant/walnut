const hre = require("hardhat");
async function main() {
  const cUSDC_Address = "0x78136BC03b4549688C48181a26c521eb2F27F23F";
  const v2Address = "0xdF921cF29Aae0fBf524139a4cae9289478893fDf";
  
  const token = await hre.ethers.getContractAt("WalnutFHERC20", cUSDC_Address);
  console.log("MINTER IS:", await token.minter());
  console.log("IS v2 ADDRESS A MINTER?:", await token.isMinter(v2Address));
}
main().catch(console.error);
