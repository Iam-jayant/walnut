const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  console.log("=== CONTRACT EVENTS AUDIT ===");
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_SEPOLIA_RPC_URL);
  
  const lendingAddress = process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS;
  console.log("Lending Address:", lendingAddress);

  const abi = [
    "event Deposited(address indexed user, address indexed token, uint256 amount, uint256 usdValue)",
    "event Borrowed(address indexed user, uint256 timestamp)",
    "event BorrowPrincipalSyncRequested(address indexed user, uint256 indexed requestId, uint256 openedAt)",
    "event BorrowPrincipalSynced(address indexed user, uint256 principal, uint256 openedAt)",
  ];

  const contract = new ethers.Contract(lendingAddress, abi, provider);

  // Query events from block 270000000 to latest (since it was recently deployed)
  const latestBlock = await provider.getBlockNumber();
  const startBlock = latestBlock - 50000; // Look back last 50,000 blocks (~1-2 days)
  console.log(`Querying events from block ${startBlock} to ${latestBlock}...`);

  try {
    const deposits = await contract.queryFilter("Deposited", startBlock, latestBlock);
    console.log(`\nDeposited Events (${deposits.length}):`);
    for (const event of deposits) {
      console.log(`- Block: ${event.blockNumber}, User: ${event.args.user}, Token: ${event.args.token}, Amount: ${ethers.formatUnits(event.args.amount, 6)}`);
    }

    const borrows = await contract.queryFilter("Borrowed", startBlock, latestBlock);
    console.log(`\nBorrowed Events (${borrows.length}):`);
    for (const event of borrows) {
      console.log(`- Block: ${event.blockNumber}, User: ${event.args.user}, Timestamp: ${event.args.timestamp}`);
    }

    const syncRequests = await contract.queryFilter("BorrowPrincipalSyncRequested", startBlock, latestBlock);
    console.log(`\nBorrowPrincipalSyncRequested Events (${syncRequests.length}):`);
    for (const event of syncRequests) {
      console.log(`- Block: ${event.blockNumber}, User: ${event.args.user}, RequestId: ${event.args.requestId}`);
    }

    const syncs = await contract.queryFilter("BorrowPrincipalSynced", startBlock, latestBlock);
    console.log(`\nBorrowPrincipalSynced Events (${syncs.length}):`);
    for (const event of syncs) {
      console.log(`- Block: ${event.blockNumber}, User: ${event.args.user}, Principal: ${ethers.formatUnits(event.args.principal, 6)}`);
    }

  } catch (err) {
    console.error("Error querying events:", err.message);
  }
}

main().catch(console.error);
