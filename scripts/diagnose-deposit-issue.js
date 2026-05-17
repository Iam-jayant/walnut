const hre = require("hardhat");
require("dotenv").config({ override: true });

/**
 * @title Diagnose Deposit Issue
 * @notice Checks all conditions that could cause deposit to revert
 */

const WALNUT_V2_ADDRESS = "0xaEBF0CD234779DA76cD2F938Fdd029F80b6F98da";
const ORACLE_ADDRESS = "0xA8621c45bfe3A4f163b17Ba509735118fbC7610e";
const MOCK_USDC_ADDRESS = "0x8B7Af5BB6afc6A087fd94A97f53Bf13dFD63E1E2";
const WETH_ADDRESS = "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73";
const LINK_ADDRESS = "0x152b0df80135c63b4cb1fbe00ddce7e9a8ffcb04";

// User wallet address (replace with actual user address)
const USER_ADDRESS = process.env.USER_WALLET_ADDRESS || "0x65c3768E98eE211a7589fe94c753e11cB8895069";

async function main() {
  console.log("========================================");
  console.log("Deposit Issue Diagnostic");
  console.log("========================================\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Checking from address:", USER_ADDRESS);
  console.log();

  // Get contracts
  const WalnutV2 = await hre.ethers.getContractFactory("WalnutV2");
  const walnutV2 = WalnutV2.attach(WALNUT_V2_ADDRESS);

  const WalnutPriceOracle = await hre.ethers.getContractFactory("WalnutPriceOracle");
  const oracle = WalnutPriceOracle.attach(ORACLE_ADDRESS);

  const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
  ];

  // ============================================
  // CHECK 1: Contract Paused Status
  // ============================================
  console.log("CHECK 1: Contract Paused Status");
  console.log("-----------------------------------");
  try {
    const isPaused = await walnutV2.paused();
    console.log("WalnutV2 paused:", isPaused);
    if (isPaused) {
      console.log("❌ ISSUE: Contract is paused!");
    } else {
      console.log("✅ Contract is not paused");
    }
  } catch (error) {
    console.log("❌ Error checking paused status:", error.message);
  }
  console.log();

  // ============================================
  // CHECK 2: Oracle Price Feeds
  // ============================================
  console.log("CHECK 2: Oracle Price Feeds");
  console.log("-----------------------------------");
  
  const tokens = [
    { name: "USDC", address: MOCK_USDC_ADDRESS },
    { name: "WETH", address: WETH_ADDRESS },
    { name: "LINK", address: LINK_ADDRESS },
  ];

  for (const token of tokens) {
    try {
      const feed = await oracle.priceFeeds(token.address);
      if (feed === "0x0000000000000000000000000000000000000000") {
        console.log(`❌ ${token.name}: No price feed registered`);
      } else {
        console.log(`✅ ${token.name}: Price feed registered at ${feed}`);
        
        // Try to get price
        try {
          const testAmount = hre.ethers.parseUnits("1", 18);
          const usdValue = await oracle.getUSDValue(token.address, testAmount);
          console.log(`   Price: $${hre.ethers.formatUnits(usdValue, 6)}`);
        } catch (error) {
          console.log(`   ❌ Error fetching price: ${error.message}`);
        }
      }
    } catch (error) {
      console.log(`❌ ${token.name}: Error checking feed - ${error.message}`);
    }
  }
  console.log();

  // ============================================
  // CHECK 3: User Token Balances
  // ============================================
  console.log("CHECK 3: User Token Balances");
  console.log("-----------------------------------");
  
  for (const token of tokens) {
    try {
      const tokenContract = new hre.ethers.Contract(token.address, ERC20_ABI, deployer);
      const balance = await tokenContract.balanceOf(USER_ADDRESS);
      const decimals = await tokenContract.decimals();
      const symbol = await tokenContract.symbol();
      
      console.log(`${symbol}: ${hre.ethers.formatUnits(balance, decimals)}`);
      
      if (balance === 0n) {
        console.log(`   ⚠️  Zero balance - user needs to get ${symbol} tokens`);
      }
    } catch (error) {
      console.log(`❌ ${token.name}: Error checking balance - ${error.message}`);
    }
  }
  console.log();

  // ============================================
  // CHECK 4: User Token Allowances
  // ============================================
  console.log("CHECK 4: User Token Allowances");
  console.log("-----------------------------------");
  
  for (const token of tokens) {
    try {
      const tokenContract = new hre.ethers.Contract(token.address, ERC20_ABI, deployer);
      const allowance = await tokenContract.allowance(USER_ADDRESS, WALNUT_V2_ADDRESS);
      const decimals = await tokenContract.decimals();
      const symbol = await tokenContract.symbol();
      
      console.log(`${symbol}: ${hre.ethers.formatUnits(allowance, decimals)}`);
      
      if (allowance === 0n) {
        console.log(`   ⚠️  Zero allowance - user needs to approve ${symbol} first`);
      }
    } catch (error) {
      console.log(`❌ ${token.name}: Error checking allowance - ${error.message}`);
    }
  }
  console.log();

  // ============================================
  // CHECK 5: Contract Configuration
  // ============================================
  console.log("CHECK 5: Contract Configuration");
  console.log("-----------------------------------");
  try {
    const wUSDC = await walnutV2.wUSDC();
    const oracleAddr = await walnutV2.oracle();
    const treasury = await walnutV2.treasury();
    
    console.log("wUSDC address:", wUSDC);
    console.log("Oracle address:", oracleAddr);
    console.log("Treasury address:", treasury);
    
    if (oracleAddr.toLowerCase() !== ORACLE_ADDRESS.toLowerCase()) {
      console.log("❌ ISSUE: Oracle address mismatch!");
    } else {
      console.log("✅ Oracle address correct");
    }
  } catch (error) {
    console.log("❌ Error checking configuration:", error.message);
  }
  console.log();

  // ============================================
  // SUMMARY
  // ============================================
  console.log("========================================");
  console.log("DIAGNOSTIC SUMMARY");
  console.log("========================================");
  console.log("Common issues that cause deposit to revert:");
  console.log("1. Contract is paused");
  console.log("2. Token price feed not registered in oracle");
  console.log("3. User has zero token balance");
  console.log("4. User hasn't approved tokens to WalnutV2");
  console.log("5. Stale price data from Chainlink feed");
  console.log();
  console.log("Check the output above to identify the issue.");
  console.log("========================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
