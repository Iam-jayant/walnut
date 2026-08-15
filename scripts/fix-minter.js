const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Using account:", deployer.address);

  const cUSDC_Address = "0x78136BC03b4549688C48181a26c521eb2F27F23F";
  const newLendingV2Address = "0xdF921cF29Aae0fBf524139a4cae9289478893fDf";

  const cUSDC = await hre.ethers.getContractAt("WalnutFHERC20", cUSDC_Address);
  
  const currentMinter = await cUSDC.minter();
  console.log("Current Minter:", currentMinter);

  if (currentMinter.toLowerCase() !== newLendingV2Address.toLowerCase()) {
    console.log("Setting new minter to:", newLendingV2Address);
    const tx = await cUSDC.setMinter(newLendingV2Address);
    console.log("Tx Hash:", tx.hash);
    await tx.wait();
    console.log("✅ Minter successfully updated!");
  } else {
    console.log("✅ Minter is already set correctly.");
  }
}

main().catch(console.error);
