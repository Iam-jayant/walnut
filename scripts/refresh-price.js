const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";
  const privateKey = process.env.PRIVATE_KEY.startsWith("0x") ? process.env.PRIVATE_KEY : "0x" + process.env.PRIVATE_KEY;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const MUTABLE_FEED = process.env.MUTABLE_PRICE_FEED_ADDRESS;
  console.log("Mutable Feed:", MUTABLE_FEED);
  console.log("Wallet:", wallet.address);

  const feedAbi = [
    "function setPrice(int256 newPrice) external",
    "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)",
    "function decimals() view returns (uint8)"
  ];

  const feed = new ethers.Contract(MUTABLE_FEED, feedAbi, wallet);

  // Set price to $1.00 (100000000 in 8-decimal Chainlink format)
  const newPrice = 100000000; // $1.00
  console.log("\nSetting price to $1.00 (100000000)...");
  const tx = await feed.setPrice(newPrice);
  console.log("Tx hash:", tx.hash);
  await tx.wait();
  console.log("✅ Price updated!");

  // Verify
  const [roundId, price, startedAt, updatedAt, answeredInRound] = await feed.latestRoundData();
  const now = Math.floor(Date.now() / 1000);
  const age = now - Number(updatedAt);
  console.log("\n--- Verification ---");
  console.log("Price:", ethers.formatUnits(price, 8), "USD");
  console.log("Updated at:", new Date(Number(updatedAt) * 1000).toISOString());
  console.log("Age:", age, "seconds");
  console.log("Stale?", age >= 3600 ? "YES ❌" : "NO ✅");
}

main().catch(console.error);
