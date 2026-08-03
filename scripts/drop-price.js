/**
 * ============================================================================
 * ⚠️  TESTNET-ONLY — Drop/Restore USDC Price for Liquidation Testing
 * ============================================================================
 *
 * Calls setPrice() on the mutable MockChainlinkAggregator to manipulate the
 * USDC price feed. This changes how collateral is valued for FUTURE operations
 * (deposits, LTV checks, liquidation checks) — it does NOT change any
 * already-stored encrypted collateral values.
 *
 * Usage:
 *   # Drop price to $0.50 (triggers liquidation on 70% LTV positions)
 *   PRICE_CENTS=50 npx hardhat run scripts/drop-price.js --network arbitrumSepolia
 *
 *   # Restore to $1.00
 *   PRICE_CENTS=100 npx hardhat run scripts/drop-price.js --network arbitrumSepolia
 *
 *   # Custom price (e.g., $0.85)
 *   PRICE_CENTS=85 npx hardhat run scripts/drop-price.js --network arbitrumSepolia
 *
 * Requires MUTABLE_PRICE_FEED_ADDRESS in .env (set after running
 * deploy-mutable-price-feed.js).
 * ============================================================================
 */

const hre = require("hardhat");
require("dotenv").config({ override: true });

const FEED_ADDRESS = process.env.MUTABLE_PRICE_FEED_ADDRESS;
const ORACLE_ADDRESS = process.env.NEXT_PUBLIC_ORACLE_ADDRESS;
const MOCK_USDC_ADDRESS = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS;

async function main() {
  console.log("========================================");
  console.log("⚠️  TESTNET-ONLY: Set USDC Price");
  console.log("========================================\n");

  if (!FEED_ADDRESS) {
    throw new Error(
      "Missing MUTABLE_PRICE_FEED_ADDRESS in .env.\n" +
      "Run deploy-mutable-price-feed.js first, then add the address to .env."
    );
  }

  const priceCents = parseInt(process.env.PRICE_CENTS || "50", 10);
  if (isNaN(priceCents) || priceCents <= 0 || priceCents > 10000) {
    throw new Error("PRICE_CENTS must be between 1 and 10000");
  }

  // Chainlink uses 8 decimals: $1.00 = 100_000_000, $0.50 = 50_000_000
  const chainlinkPrice = priceCents * 1_000_000; // cents → 8-decimal

  const [deployer] = await hre.ethers.getSigners();
  console.log("Caller:", await deployer.getAddress());
  console.log("Feed:", FEED_ADDRESS);
  console.log("Target price: $" + (priceCents / 100).toFixed(2), `(${chainlinkPrice} in 8-decimal)\n`);

  // Set the price
  const feed = await hre.ethers.getContractAt("MockChainlinkAggregator", FEED_ADDRESS);

  const oldRound = await feed.latestRoundData();
  console.log("Current price:", "$" + (Number(oldRound.answer) / 100_000_000).toFixed(2));

  const tx = await feed.setPrice(chainlinkPrice);
  await tx.wait();
  console.log("✅ Price set! Tx:", tx.hash);

  // Verify
  const newRound = await feed.latestRoundData();
  console.log("New price:", "$" + (Number(newRound.answer) / 100_000_000).toFixed(2));

  // Verify through oracle
  if (ORACLE_ADDRESS && MOCK_USDC_ADDRESS) {
    const oracle = await hre.ethers.getContractAt("WalnutPriceOracle", ORACLE_ADDRESS);
    const testAmount = hre.ethers.parseUnits("1000", 6); // 1000 USDC
    const usdValue = await oracle.getUSDValue(MOCK_USDC_ADDRESS, testAmount);
    console.log("\nOracle verification: 1000 USDC =", hre.ethers.formatUnits(usdValue, 6), "USD");
  }

  // Impact analysis
  console.log("\n========================================");
  console.log("IMPACT ANALYSIS");
  console.log("========================================");
  if (priceCents < 100) {
    const effectiveLTV = (70 * 100) / priceCents;
    console.log(`A position at 70% LTV now has effective LTV: ${effectiveLTV.toFixed(1)}%`);
    console.log(`Liquidation threshold: 80%`);
    console.log(`Liquidatable: ${effectiveLTV >= 80 ? "✅ YES" : "❌ NO (need lower price)"}`);
    console.log(`\n⚠️  Restore to $1.00 after testing:`);
    console.log(`   PRICE_CENTS=100 npx hardhat run scripts/drop-price.js --network arbitrumSepolia`);
  } else {
    console.log("Price at or above $1.00 — normal operation.");
  }
  console.log();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
