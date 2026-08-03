const { ethers } = require("hardhat");

async function main() {
  const txHash = "0xc6b32029501d57cd5a3f80ca80061f6ec782253dedbf6ca86f30c022f56472f0";
  const receipt = await ethers.provider.getTransactionReceipt(txHash);
  
  if (!receipt) {
    console.log("Tx receipt not found.");
    return;
  }

  const txBlock = await ethers.provider.getBlock(receipt.blockNumber);
  const latestBlock = await ethers.provider.getBlock("latest");

  const elapsedSeconds = latestBlock.timestamp - txBlock.timestamp;
  const elapsedMinutes = (elapsedSeconds / 60).toFixed(2);
  const elapsedHours = (elapsedSeconds / 3600).toFixed(2);

  console.log("========================================");
  console.log("CoFHE Pending Decryption Time Analysis");
  console.log("========================================\n");
  console.log(`Tx Block:       ${receipt.blockNumber} (Timestamp: ${txBlock.timestamp} - ${new Date(txBlock.timestamp * 1000).toUTCString()})`);
  console.log(`Current Block:  ${latestBlock.number} (Timestamp: ${latestBlock.timestamp} - ${new Date(latestBlock.timestamp * 1000).toUTCString()})`);
  console.log(`Elapsed Time:   ${elapsedSeconds} seconds (~${elapsedMinutes} minutes / ${elapsedHours} hours)`);

  const reqId = "89720895795975198079738168171190655291180473712266842426434811767831974839808";
  const WalnutLendingV2Address = "0x66D549B13275463C0507f84b36D047515b37E0aA";
  const walnutV2 = await ethers.getContractAt("WalnutLendingV2", WalnutLendingV2Address);
  const pendingBorrower = await walnutV2.pendingLiquidationChecks(reqId);
  const [state] = await walnutV2.liquidations("0xCD2cBe40E6A1484799e5FAa2Bff6a1Cf0755782f");

  console.log(`\nCurrent Status:`);
  console.log(`- pendingLiquidationChecks: ${pendingBorrower}`);
  console.log(`- Auction State:            ${state}`);

  console.log("\n========================================\n");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
