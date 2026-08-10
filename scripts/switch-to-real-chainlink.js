const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";
  const privateKey = process.env.PRIVATE_KEY.startsWith("0x") ? process.env.PRIVATE_KEY : "0x" + process.env.PRIVATE_KEY;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const WALNUT_LENDING = process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS;
  const MOCK_USDC = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS;
  const REAL_CHAINLINK_USDC_FEED = "0xc55f567ac8E27E0Cb33fcbF62F923BA4b1f827E1"; // Real Chainlink USDC/USD on Arb Sepolia

  // Get oracle from contract
  const walnutAbi = ["function oracle() view returns (address)"];
  const walnut = new ethers.Contract(WALNUT_LENDING, walnutAbi, provider);
  const oracleAddr = await walnut.oracle();

  console.log("WalnutLending:", WALNUT_LENDING);
  console.log("Oracle:", oracleAddr);
  console.log("MockUSDC token:", MOCK_USDC);
  console.log("Real Chainlink USDC/USD feed:", REAL_CHAINLINK_USDC_FEED);
  console.log("Wallet:", wallet.address);

  const oracleAbi = [
    "function setPriceFeed(address token, address feed) external",
    "function priceFeeds(address) view returns (address)",
    "function owner() view returns (address)"
  ];
  const oracle = new ethers.Contract(oracleAddr, oracleAbi, wallet);

  // Check current feed
  const currentFeed = await oracle.priceFeeds(MOCK_USDC);
  console.log("\nCurrent feed:", currentFeed);

  if (currentFeed.toLowerCase() === REAL_CHAINLINK_USDC_FEED.toLowerCase()) {
    console.log("✅ Already pointing to real Chainlink feed. Nothing to do.");
    return;
  }

  console.log("Switching from mutable mock to real Chainlink feed...");
  const tx = await oracle.setPriceFeed(MOCK_USDC, REAL_CHAINLINK_USDC_FEED);
  console.log("Tx:", tx.hash);
  await tx.wait();
  console.log("✅ Done! Oracle now uses real Chainlink USDC/USD feed.");

  // Verify
  const newFeed = await oracle.priceFeeds(MOCK_USDC);
  console.log("Verified feed:", newFeed);
  console.log("Match:", newFeed.toLowerCase() === REAL_CHAINLINK_USDC_FEED.toLowerCase() ? "✅" : "❌");
}

main().catch(console.error);
