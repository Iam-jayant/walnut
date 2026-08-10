const hre = require("hardhat");
const ethers = hre.ethers;

async function main() {
  const address = "0x05951ec62b4cb45032Fbb7F4194689AF4bdC77C8";
  const mockUSDC = await ethers.getContractAt("MockUSDC", "0xbaF9465042BeFA0714E56bcDAddcaF6311FF5F59");
  console.log("Minting to", address);
  const tx = await mockUSDC.mint(address, ethers.parseUnits("1000", 6));
  await tx.wait();
  console.log("Minted 1000 MockUSDC!");
}

main().catch(console.error);
