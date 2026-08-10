const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Real Chainlink feeds on Arbitrum Sepolia (from WalnutPriceOracle.sol comments)
  const feeds = {
    "USDC/USD (from .env)": "0xc55f567ac8E27E0Cb33fcbF62F923BA4b1f827E1",
    "USDC/USD (Chainlink official)": "0x0153002d20B96532C639313c291Fbd1E7b65F3a8",
    "ETH/USD (Chainlink official)": "0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165",
  };

  const feedAbi = [
    "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)",
    "function decimals() view returns (uint8)",
    "function description() view returns (string)"
  ];

  for (const [name, address] of Object.entries(feeds)) {
    console.log(`\n--- ${name} (${address}) ---`);
    try {
      const feed = new ethers.Contract(address, feedAbi, provider);
      const [roundId, price, startedAt, updatedAt, answeredInRound] = await feed.latestRoundData();
      const decimals = await feed.decimals();
      let desc = "N/A";
      try { desc = await feed.description(); } catch {}
      const now = Math.floor(Date.now() / 1000);
      const age = now - Number(updatedAt);
      console.log("Description:", desc);
      console.log("Price:", ethers.formatUnits(price, decimals), "USD");
      console.log("Decimals:", Number(decimals));
      console.log("Updated at:", new Date(Number(updatedAt) * 1000).toISOString());
      console.log("Age:", age, "seconds (" + (age / 3600).toFixed(2) + " hours)");
      console.log("Stale (>1hr)?", age >= 3600 ? "YES ❌" : "NO ✅");
    } catch (e) {
      console.log("FAILED:", e.message.slice(0, 120));
    }
  }
}

main().catch(console.error);
