const hre = require("hardhat");
const { ethers } = hre;
const { FHE } = require("@fhenixprotocol/cofhe-contracts"); // Not this

async function main() {
  const [deployer] = await ethers.getSigners();
  const DummyCast = await ethers.getContractFactory("DummyDecrypt");
  const dummy = await DummyCast.deploy();
  await dummy.waitForDeployment();
  console.log("Deployed dummy at", dummy.target);
  
  try {
    const tx = await dummy.testRequestDecrypt();
    await tx.wait();
    console.log("requestDecrypt succeeded!");
  } catch (e) {
    console.error("requestDecrypt reverted!", e);
  }
}
main();
