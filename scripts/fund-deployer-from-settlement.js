const hre = require("hardhat");
require("dotenv").config({ override: true });

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const pk = process.env.PRIVARA_SETTLEMENT_PRIVATE_KEY.startsWith("0x")
    ? process.env.PRIVARA_SETTLEMENT_PRIVATE_KEY
    : "0x" + process.env.PRIVARA_SETTLEMENT_PRIVATE_KEY;
  
  const settlementWallet = new hre.ethers.Wallet(pk, hre.ethers.provider);

  console.log("Deployer:   ", deployer.address);
  console.log("Settlement: ", settlementWallet.address);

  const balDeployer = await hre.ethers.provider.getBalance(deployer.address);
  const balSettlement = await hre.ethers.provider.getBalance(settlementWallet.address);

  console.log("Deployer balance:  ", hre.ethers.formatEther(balDeployer), "ETH");
  console.log("Settlement balance:", hre.ethers.formatEther(balSettlement), "ETH");

  if (balSettlement > hre.ethers.parseEther("0.001")) {
    const amountToTransfer = balSettlement - hre.ethers.parseEther("0.0002");
    console.log(`Transferring ${hre.ethers.formatEther(amountToTransfer)} ETH to deployer...`);
    const tx = await settlementWallet.sendTransaction({
      to: deployer.address,
      value: amountToTransfer
    });
    await tx.wait();
    console.log("✅ Transferred ETH to deployer. Tx:", tx.hash);
  } else {
    console.log("Settlement wallet balance is low.");
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
