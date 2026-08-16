const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying new WalnutFHERC20 from account:", deployer.address);

  const WalnutFHERC20 = await hre.ethers.getContractFactory("WalnutFHERC20");
  const cUSDC = await WalnutFHERC20.deploy();
  await cUSDC.waitForDeployment();
  const address = await cUSDC.getAddress();
  
  console.log("Deployed new WalnutFHERC20 at:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
