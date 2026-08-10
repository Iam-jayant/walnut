const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const WALNUT_LENDING = "0x7Bf93fdf3bb94B93eCB035A033E941642BDE8962";
  const MOCK_USDC = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS;
  const MUTABLE_FEED = process.env.MUTABLE_PRICE_FEED_ADDRESS;

  console.log("WalnutLending:", WALNUT_LENDING);
  console.log("MockUSDC:", MOCK_USDC);
  console.log("Mutable Feed (env):", MUTABLE_FEED);

  // Get oracle address from the contract
  const walnutAbi = ["function oracle() view returns (address)"];
  const walnut = new ethers.Contract(WALNUT_LENDING, walnutAbi, provider);
  const oracleAddr = await walnut.oracle();
  console.log("\nOracle address (from contract):", oracleAddr);

  // Check what price feed the oracle points to for USDC
  const oracleAbi = [
    "function priceFeeds(address) view returns (address)",
    "function owner() view returns (address)"
  ];
  const oracle = new ethers.Contract(oracleAddr, oracleAbi, provider);
  const currentFeed = await oracle.priceFeeds(MOCK_USDC);
  console.log("Current USDC price feed:", currentFeed);
  const owner = await oracle.owner();
  console.log("Oracle owner:", owner);

  // Check the feed's latestRoundData
  const feedAbi = [
    "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)",
    "function decimals() view returns (uint8)"
  ];

  if (currentFeed !== ethers.ZeroAddress) {
    const feed = new ethers.Contract(currentFeed, feedAbi, provider);
    try {
      const [roundId, price, startedAt, updatedAt, answeredInRound] = await feed.latestRoundData();
      const decimals = await feed.decimals();
      const now = Math.floor(Date.now() / 1000);
      const age = now - Number(updatedAt);
      console.log("\n--- Current Feed Data ---");
      console.log("Price:", ethers.formatUnits(price, decimals), "USD");
      console.log("Decimals:", decimals);
      console.log("Updated at:", new Date(Number(updatedAt) * 1000).toISOString());
      console.log("Age:", age, "seconds (" + (age / 3600).toFixed(2) + " hours)");
      console.log("Stale?", age >= 3600 ? "YES ❌" : "NO ✅");
    } catch (e) {
      console.log("Failed to read feed:", e.message);
    }
  }

  // Check the mutable feed too if available
  if (MUTABLE_FEED && MUTABLE_FEED !== currentFeed) {
    console.log("\n--- Mutable Feed Data ---");
    const mutableFeed = new ethers.Contract(MUTABLE_FEED, feedAbi, provider);
    try {
      const [roundId, price, startedAt, updatedAt, answeredInRound] = await mutableFeed.latestRoundData();
      const decimals = await mutableFeed.decimals();
      const now = Math.floor(Date.now() / 1000);
      const age = now - Number(updatedAt);
      console.log("Price:", ethers.formatUnits(price, decimals), "USD");
      console.log("Updated at:", new Date(Number(updatedAt) * 1000).toISOString());
      console.log("Age:", age, "seconds (" + (age / 3600).toFixed(2) + " hours)");
      console.log("Stale?", age >= 3600 ? "YES ❌" : "NO ✅");
    } catch (e) {
      console.log("Failed to read mutable feed:", e.message);
    }
  }
}

main().catch(console.error);
