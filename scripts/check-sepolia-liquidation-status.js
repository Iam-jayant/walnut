const { ethers } = require("hardhat");

async function main() {
  console.log("========================================");
  console.log("Checking Live Sepolia Liquidation Callback Status");
  console.log("========================================\n");

  const WalnutLendingV2Address = "0x66D549B13275463C0507f84b36D047515b37E0aA";
  const borrower = "0xCD2cBe40E6A1484799e5FAa2Bff6a1Cf0755782f";
  const txHash = "0xc6b32029501d57cd5a3f80ca80061f6ec782253dedbf6ca86f30c022f56472f0";

  const walnutV2 = await ethers.getContractAt("WalnutLendingV2", WalnutLendingV2Address);

  console.log("Target Borrower:", borrower);
  console.log("Check Tx Hash:   ", txHash);

  // Read current liquidation state for borrower
  const [state, endTime] = await walnutV2.liquidations(borrower);
  console.log("\nCurrent On-Chain Auction State for Borrower:");
  console.log(`- State:   ${state} (0 = IDLE, 1 = OPEN, 2 = SELECTION_PENDING)`);
  console.log(`- EndTime: ${endTime}`);

  console.log("Fetching transaction receipt for check tx...");
  const receipt = await ethers.provider.getTransactionReceipt(txHash);
  if (!receipt) {
    console.log("❌ Transaction receipt not found on RPC.");
    return;
  }
  console.log(`✅ Tx confirmed in Block: ${receipt.blockNumber}`);

  // Decode logs in tx receipt
  let reqId = null;
  for (const log of receipt.logs) {
    try {
      const parsed = walnutV2.interface.parseLog(log);
      if (parsed.name === "LiquidationCheckRequested") {
        reqId = parsed.args.requestId;
        console.log(`✅ Event LiquidationCheckRequested found in Tx! RequestId: ${reqId}, Borrower: ${parsed.args.borrower}`);
      }
    } catch {}
  }

  if (reqId) {
    const pendingBorrower = await walnutV2.pendingLiquidationChecks(reqId);
    console.log(`\nDirect Mapping Lookup: pendingLiquidationChecks[${reqId}] = "${pendingBorrower}"`);
    if (pendingBorrower.toLowerCase() === borrower.toLowerCase()) {
      console.log("\n========================================");
      console.log("ACTUAL STATE REALITY ON LIVE SEPOLIA:");
      console.log("----------------------------------------");
      console.log("1. Step 1 (requestLiquidationCheck tx) WAS SUBMITTED AND CONFIRMED in block", receipt.blockNumber);
      console.log("2. Request ID", reqId, "is STILL PRESENT in pendingLiquidationChecks.");
      console.log("3. The live CoFHE testnet coprocessor callback HAS NOT FIRED YET.");
      console.log("4. Auction State remains 0 (IDLE) awaiting live relayer execution.");
      console.log("========================================\n");
    } else {
      console.log("\n========================================");
      console.log("ACTUAL STATE REALITY ON LIVE SEPOLIA:");
      console.log("----------------------------------------");
      console.log("1. Request ID", reqId, "has been CLEARED from pendingLiquidationChecks!");
      console.log("2. The live CoFHE coprocessor callback HAS FIRED and completed on-chain.");
      console.log("========================================\n");
    }
  }

  // Scan logs from tx block onwards
  const fromBlock = receipt.blockNumber;
  const currentBlock = await ethers.provider.getBlockNumber();
  console.log(`Scanning logs from tx block ${fromBlock} to current block ${currentBlock}...`);

  const reqFilter = walnutV2.filters.LiquidationCheckRequested(borrower);
  const openFilter = walnutV2.filters.LiquidationAuctionOpened(borrower);
  const healthyFilter = walnutV2.filters.LiquidationAuctionHealthy(borrower);

  const reqEvents = await walnutV2.queryFilter(reqFilter, fromBlock, currentBlock);
  const openEvents = await walnutV2.queryFilter(openFilter, fromBlock, currentBlock);
  const healthyEvents = await walnutV2.queryFilter(healthyFilter, fromBlock, currentBlock);

  console.log("\nEvent Logs Summary:");
  console.log(`- LiquidationCheckRequested count: ${reqEvents.length}`);
  if (reqEvents.length > 0) {
    const ev = reqEvents[reqEvents.length - 1];
    console.log(`  Latest reqId: ${ev.args.requestId} (Tx: ${ev.transactionHash})`);
    
    // Check if reqId is still in pendingLiquidationChecks mapping
    const pendingBorrower = await walnutV2.pendingLiquidationChecks(ev.args.requestId);
    console.log(`  pendingLiquidationChecks[${ev.args.requestId}]: ${pendingBorrower}`);
  }

  console.log(`- LiquidationAuctionOpened count:  ${openEvents.length}`);
  console.log(`- LiquidationAuctionHealthy count: ${healthyEvents.length}`);

  if (state === 0n && reqEvents.length > 0) {
    const pendingBorrower = await walnutV2.pendingLiquidationChecks(reqEvents[reqEvents.length - 1].args.requestId);
    if (pendingBorrower.toLowerCase() === borrower.toLowerCase()) {
      console.log("\n--> RESULT: Step 1 is STILL PENDING in pendingLiquidationChecks. The live CoFHE testnet coprocessor callback has NOT landed yet.");
    } else {
      console.log("\n--> RESULT: State is IDLE and pending check cleared (Healthy position or reset).");
    }
  } else if (state === 1n) {
    console.log("\n--> RESULT: SUCCESS! The live CoFHE coprocessor callback HAS LANDED. Auction state is now OPEN (1).");
  }

  console.log("\n========================================\n");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
