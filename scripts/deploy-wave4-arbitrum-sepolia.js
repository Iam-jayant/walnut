const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config({ override: true });
const hre = require("hardhat");

/**
 * @title Wave 4 Deployment Script
 * @notice Deploys all Wave 4 contracts to Arbitrum Sepolia
 * @dev Deployment order:
 *   1. MockUSDC (testnet token)
 *   2. WalnutPriceOracle (Chainlink wrapper)
 *   3. WalnutFHERC20 (encrypted stablecoin)
 *   4. WalnutV2 (main protocol)
 *   5. Call fherc20.setMinter(walnutV2Address)
 * 
 * Requirements: 15.1-15.8, 16.8
 */

// ============================================
// SUPPORTED TOKENS CONFIGURATION
// ============================================

/**
 * Top 5 Most Popular Trading Tokens
 * These are the tokens that Walnut Protocol supports as collateral
 */

// Chainlink Price Feed Addresses on Arbitrum Sepolia
const PRICE_FEEDS = {
  ETH_USD: "0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165",   // ETH/USD
  USDC_USD: "0x0153002d20B96532C639313c291Fbd1e7b65f3A8",  // USDC/USD
  USDT_USD: "0x80EDee6f667eCc9f63a0a6f55578F870651f06A4",  // USDT/USD
  BTC_USD: "0x56a43EB56Da12C0dc1D972ACb089c06a5dEF8e69",   // BTC/USD (for WBTC)
  LINK_USD: "0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298",  // LINK/USD
};

// Token Addresses on Arbitrum Sepolia
// Note: These are testnet addresses - update with real addresses when available
const TOKEN_ADDRESSES = {
  // WETH: Wrapped Ethereum (most liquid base pair)
  WETH: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73",
  
  // USDC: USD Coin (most popular stablecoin)
  // Using MockUSDC for now - replace with real testnet USDC if available
  USDC: null, // Will be set to MockUSDC address after deployment
  
  // USDT: Tether (second most popular stablecoin)
  USDT: "0xf7b2f7B8B4E3c6E5e3c3E5e3c3E5e3c3E5e3c3E5", // Placeholder - update with real address
  
  // WBTC: Wrapped Bitcoin (Bitcoin exposure on Ethereum)
  WBTC: "0xf7b2f7B8B4E3c6E5e3c3E5e3c3E5e3c3E5e3c3E6", // Placeholder - update with real address
  
  // LINK: Chainlink Token (popular DeFi token)
  LINK: "0xf7b2f7B8B4E3c6E5e3c3E5e3c3E5e3c3E5e3c3E7", // Placeholder - update with real address
};

// Legacy constants for backward compatibility
const CHAINLINK_ETH_USD = PRICE_FEEDS.ETH_USD;
const CHAINLINK_USDC_USD = PRICE_FEEDS.USDC_USD;

// Treasury address (protocol fee recipient)
// Using deployer address as treasury for testnet
// In production, this should be a multisig or DAO treasury
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || null; // Will use deployer if not set

function ensureRequiredEnv() {
  const hasPk = Boolean(process.env.PRIVATE_KEY || process.env.NEXT_PUBLIC_PRIVATE_KEY);
  const hasRpc = Boolean(process.env.RPC_URL || process.env.ARBITRUM_SEPOLIA_RPC_URL);

  if (!hasPk) {
    throw new Error("Missing PRIVATE_KEY in .env");
  }

  if (!hasRpc) {
    throw new Error("Missing ARBITRUM_SEPOLIA_RPC_URL (or RPC_URL) in .env");
  }
}

function upsertEnvValueInFile(filePath, key, value) {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");

  let next;
  if (pattern.test(existing)) {
    next = existing.replace(pattern, line);
  } else {
    next = `${existing.trimEnd()}\n${line}\n`;
  }

  fs.writeFileSync(filePath, next, "utf8");
}

function upsertEnvValue(key, value) {
  const envPath = path.resolve(process.cwd(), ".env");
  upsertEnvValueInFile(envPath, key, value);

  const envLocalPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envLocalPath)) {
    upsertEnvValueInFile(envLocalPath, key, value);
  }
}

async function main() {
  ensureRequiredEnv();

  console.log("========================================");
  console.log("Wave 4 Deployment: Token Economics");
  console.log("Network: Arbitrum Sepolia");
  console.log("========================================\n");

  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log("Deployer address:", deployerAddress);
  
  const balance = await hre.ethers.provider.getBalance(deployerAddress);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Determine treasury address
  const treasuryAddress = TREASURY_ADDRESS || deployerAddress;
  console.log("Treasury address:", treasuryAddress);
  console.log("(Protocol fees will be sent here)\n");

  // ============================================
  // STEP 1: Deploy MockUSDC
  // ============================================
  console.log("Step 1/5: Deploying MockUSDC...");
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  const mockUSDCAddress = await mockUSDC.getAddress();
  console.log("✅ MockUSDC deployed at:", mockUSDCAddress);
  console.log("   Name: Mock USDC");
  console.log("   Symbol: USDC");
  console.log("   Decimals: 6\n");

  // ============================================
  // STEP 2: Deploy WalnutPriceOracle
  // ============================================
  console.log("Step 2/5: Deploying WalnutPriceOracle...");
  const WalnutPriceOracle = await hre.ethers.getContractFactory("WalnutPriceOracle");
  const oracle = await WalnutPriceOracle.deploy();
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log("✅ WalnutPriceOracle deployed at:", oracleAddress);

  console.log("\n   Deploying MockUSDCPriceFeed for testnet USDC...");
  const MockUSDCPriceFeed = await hre.ethers.getContractFactory("MockUSDCPriceFeed");
  const mockUSDCFeed = await MockUSDCPriceFeed.deploy();
  await mockUSDCFeed.waitForDeployment();
  const mockUSDCFeedAddress = await mockUSDCFeed.getAddress();
  console.log("   ✅ MockUSDCPriceFeed deployed at:", mockUSDCFeedAddress);

  // Configure price feeds for all supported tokens
  console.log("\n   Configuring price feeds for 5 supported tokens...");
  
  // 1. USDC/USD (MockUSDC for now)
  const setUSDCFeedTx = await oracle.setPriceFeed(mockUSDCAddress, mockUSDCFeedAddress);
  await setUSDCFeedTx.wait();
  console.log("   ✅ 1/5 USDC/USD feed configured");
  console.log("       Token: MockUSDC (testnet)");
  console.log("       Feed:", mockUSDCFeedAddress);
  
  // 2. ETH/USD (WETH)
  if (TOKEN_ADDRESSES.WETH) {
    const setWETHFeedTx = await oracle.setPriceFeed(TOKEN_ADDRESSES.WETH, PRICE_FEEDS.ETH_USD);
    await setWETHFeedTx.wait();
    console.log("   ✅ 2/5 ETH/USD feed configured");
    console.log("       Token: WETH");
    console.log("       Address:", TOKEN_ADDRESSES.WETH);
    console.log("       Feed:", PRICE_FEEDS.ETH_USD);
  } else {
    console.log("   ⚠️  2/5 WETH address not configured - skipping");
    console.log("       Feed available:", PRICE_FEEDS.ETH_USD);
  }
  
  // 3. USDT/USD
  if (TOKEN_ADDRESSES.USDT && TOKEN_ADDRESSES.USDT !== "0xf7b2f7B8B4E3c6E5e3c3E5e3c3E5e3c3E5e3c3E5") {
    const setUSDTFeedTx = await oracle.setPriceFeed(TOKEN_ADDRESSES.USDT, PRICE_FEEDS.USDT_USD);
    await setUSDTFeedTx.wait();
    console.log("   ✅ 3/5 USDT/USD feed configured");
    console.log("       Token: USDT");
    console.log("       Address:", TOKEN_ADDRESSES.USDT);
    console.log("       Feed:", PRICE_FEEDS.USDT_USD);
  } else {
    console.log("   ⚠️  3/5 USDT address not configured - skipping");
    console.log("       Feed available:", PRICE_FEEDS.USDT_USD);
  }
  
  // 4. BTC/USD (WBTC)
  if (TOKEN_ADDRESSES.WBTC && TOKEN_ADDRESSES.WBTC !== "0xf7b2f7B8B4E3c6E5e3c3E5e3c3E5e3c3E5e3c3E6") {
    const setWBTCFeedTx = await oracle.setPriceFeed(TOKEN_ADDRESSES.WBTC, PRICE_FEEDS.BTC_USD);
    await setWBTCFeedTx.wait();
    console.log("   ✅ 4/5 BTC/USD feed configured");
    console.log("       Token: WBTC");
    console.log("       Address:", TOKEN_ADDRESSES.WBTC);
    console.log("       Feed:", PRICE_FEEDS.BTC_USD);
  } else {
    console.log("   ⚠️  4/5 WBTC address not configured - skipping");
    console.log("       Feed available:", PRICE_FEEDS.BTC_USD);
  }
  
  // 5. LINK/USD
  if (TOKEN_ADDRESSES.LINK && TOKEN_ADDRESSES.LINK !== "0xf7b2f7B8B4E3c6E5e3c3E5e3c3E5e3c3E5e3c3E7") {
    const setLINKFeedTx = await oracle.setPriceFeed(TOKEN_ADDRESSES.LINK, PRICE_FEEDS.LINK_USD);
    await setLINKFeedTx.wait();
    console.log("   ✅ 5/5 LINK/USD feed configured");
    console.log("       Token: LINK");
    console.log("       Address:", TOKEN_ADDRESSES.LINK);
    console.log("       Feed:", PRICE_FEEDS.LINK_USD);
  } else {
    console.log("   ⚠️  5/5 LINK address not configured - skipping");
    console.log("       Feed available:", PRICE_FEEDS.LINK_USD);
  }
  
  console.log("\n   📊 Supported Tokens Summary:");
  console.log("   1. USDC - USD Coin (Stablecoin)");
  console.log("   2. WETH - Wrapped Ethereum (Base Pair)");
  console.log("   3. USDT - Tether (Stablecoin)");
  console.log("   4. WBTC - Wrapped Bitcoin (BTC Exposure)");
  console.log("   5. LINK - Chainlink Token (DeFi)");
  console.log();

  // ============================================
  // STEP 3: Deploy WalnutFHERC20
  // ============================================
  console.log("Step 3/5: Deploying WalnutFHERC20 (wUSDC)...");
  const WalnutFHERC20 = await hre.ethers.getContractFactory("WalnutFHERC20");
  const fherc20 = await WalnutFHERC20.deploy();
  await fherc20.waitForDeployment();
  const fherc20Address = await fherc20.getAddress();
  console.log("✅ WalnutFHERC20 deployed at:", fherc20Address);
  console.log("   Name: Walnut USD Coin");
  console.log("   Symbol: wUSDC");
  console.log("   Decimals: 6");
  console.log("   Initial minter:", deployerAddress);
  console.log("   (Minter will be updated to WalnutV2 in Step 5)\n");

  // ============================================
  // STEP 4: Deploy WalnutV2
  // ============================================
  console.log("Step 4/5: Deploying WalnutV2...");
  const WalnutV2 = await hre.ethers.getContractFactory("WalnutV2");
  const walnutV2 = await WalnutV2.deploy(
    fherc20Address,
    oracleAddress,
    treasuryAddress
  );
  await walnutV2.waitForDeployment();
  const walnutV2Address = await walnutV2.getAddress();
  console.log("✅ WalnutV2 deployed at:", walnutV2Address);
  console.log("   wUSDC:", fherc20Address);
  console.log("   Oracle:", oracleAddress);
  console.log("   Treasury:", treasuryAddress);
  console.log("   Owner:", deployerAddress);
  console.log("   Credit Tier LTVs: [70%, 75%, 80%, 85%, 90%]\n");

  // ============================================
  // STEP 5: Set WalnutV2 as Minter
  // ============================================
  console.log("Step 5/5: Setting WalnutV2 as minter on WalnutFHERC20...");
  const setMinterTx = await fherc20.setMinter(walnutV2Address);
  await setMinterTx.wait();
  console.log("✅ Minter updated successfully");
  console.log("   Old minter:", deployerAddress);
  console.log("   New minter:", walnutV2Address);
  console.log("   (Only WalnutV2 can now mint/burn wUSDC)\n");

  // ============================================
  // SAVE ADDRESSES TO .env.local
  // ============================================
  console.log("Saving addresses to .env.local...");
  upsertEnvValue("NEXT_PUBLIC_V2_CONTRACT_ADDRESS", walnutV2Address);
  upsertEnvValue("NEXT_PUBLIC_FHERC20_ADDRESS", fherc20Address);
  upsertEnvValue("NEXT_PUBLIC_ORACLE_ADDRESS", oracleAddress);
  upsertEnvValue("NEXT_PUBLIC_MOCK_USDC_ADDRESS", mockUSDCAddress);
  console.log("✅ Environment variables updated\n");

  // ============================================
  // DEPLOYMENT SUMMARY
  // ============================================
  console.log("========================================");
  console.log("DEPLOYMENT SUMMARY");
  console.log("========================================");
  console.log("MockUSDC:          ", mockUSDCAddress);
  console.log("WalnutPriceOracle: ", oracleAddress);
  console.log("WalnutFHERC20:     ", fherc20Address);
  console.log("WalnutV2:          ", walnutV2Address);
  console.log("Treasury:          ", treasuryAddress);
  console.log("========================================\n");

  // ============================================
  // VERIFICATION COMMANDS
  // ============================================
  console.log("VERIFICATION COMMANDS:");
  console.log("========================================");
  console.log("npx hardhat verify --network arbitrumSepolia", mockUSDCAddress);
  console.log("npx hardhat verify --network arbitrumSepolia", oracleAddress);
  console.log("npx hardhat verify --network arbitrumSepolia", fherc20Address);
  console.log("npx hardhat verify --network arbitrumSepolia", walnutV2Address, fherc20Address, oracleAddress, treasuryAddress);
  console.log("========================================\n");

  // ============================================
  // NEXT STEPS
  // ============================================
  console.log("NEXT STEPS:");
  console.log("========================================");
  console.log("1. Verify all contracts on Arbiscan using commands above");
  console.log("");
  console.log("2. Configure real token addresses (update TOKEN_ADDRESSES in script):");
  console.log("   - Find real WETH address on Arbitrum Sepolia");
  console.log("   - Find real USDT address on Arbitrum Sepolia");
  console.log("   - Find real WBTC address on Arbitrum Sepolia");
  console.log("   - Find real LINK address on Arbitrum Sepolia");
  console.log("   Then re-run: oracle.setPriceFeed(TOKEN_ADDRESS, PRICE_FEED)");
  console.log("");
  console.log("3. Test deposit flow with each supported token:");
  console.log("   USDC: mockUSDC.mint() → approve() → deposit()");
  console.log("   WETH: weth.deposit() → approve() → deposit()");
  console.log("   USDT: Get from faucet → approve() → deposit()");
  console.log("   WBTC: Get from faucet → approve() → deposit()");
  console.log("   LINK: Get from faucet → approve() → deposit()");
  console.log("");
  console.log("4. Update frontend to display all 5 supported tokens");
  console.log("");
  console.log("5. Test complete multi-token flow:");
  console.log("   - Deposit USDC + WETH as collateral");
  console.log("   - Borrow wUSDC against combined collateral");
  console.log("   - Repay loan");
  console.log("   - Withdraw both tokens");
  console.log("========================================\n");

  console.log("✅ Wave 4 deployment completed successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
