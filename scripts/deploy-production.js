const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting production deployment to Arbitrum Sepolia...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString(), "\n");

  // Contract addresses
  let mockUsdcAddress;
  let mockUsdcPriceFeedAddress;
  let oracleAddress;
  let fherc20Address;
  let lendingAddress;

  // Step 1: Deploy MockUSDC
  console.log("1. Deploying MockUSDC...");
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const mockUsdc = await MockUSDC.deploy();
  await mockUsdc.waitForDeployment();
  mockUsdcAddress = await mockUsdc.getAddress();
  console.log("   MockUSDC deployed to:", mockUsdcAddress);

  // Step 2: Deploy MockUSDCPriceFeed
  console.log("\n2. Deploying MockUSDCPriceFeed...");
  const MockPriceFeed = await hre.ethers.getContractFactory("MockUSDCPriceFeed");
  const mockPriceFeed = await MockPriceFeed.deploy();
  await mockPriceFeed.waitForDeployment();
  mockUsdcPriceFeedAddress = await mockPriceFeed.getAddress();
  console.log("   MockUSDCPriceFeed deployed to:", mockUsdcPriceFeedAddress);

  // Step 3: Deploy WalnutPriceOracle
  console.log("\n3. Deploying WalnutPriceOracle...");
  const WalnutPriceOracle = await hre.ethers.getContractFactory("WalnutPriceOracle");
  const oracle = await WalnutPriceOracle.deploy();
  await oracle.waitForDeployment();
  oracleAddress = await oracle.getAddress();
  console.log("   WalnutPriceOracle deployed to:", oracleAddress);

  // Step 4: Deploy WalnutFHERC20 (cUSDC)
  console.log("\n4. Deploying WalnutFHERC20 (cUSDC)...");
  const WalnutFHERC20 = await hre.ethers.getContractFactory("WalnutFHERC20");
  const fherc20 = await WalnutFHERC20.deploy();
  await fherc20.waitForDeployment();
  fherc20Address = await fherc20.getAddress();
  console.log("   WalnutFHERC20 deployed to:", fherc20Address);
  console.log("   Symbol:", await fherc20.symbol());
  console.log("   Name:", await fherc20.name());

  // Step 5: Deploy WalnutLending
  console.log("\n5. Deploying WalnutLending...");
  const treasuryAddress = deployer.address; // Using deployer as treasury for testnet
  const WalnutLendingV2 = await hre.ethers.getContractFactory("WalnutLendingV2");
  const lending = await WalnutLendingV2.deploy(
    fherc20Address,
    oracleAddress,
    treasuryAddress
  );
  await lending.waitForDeployment();
  lendingAddress = await lending.getAddress();
  console.log("   WalnutLending deployed to:", lendingAddress);
  console.log("   Treasury:", treasuryAddress);

  // Step 6: Configure WalnutFHERC20 minter
  console.log("\n6. Setting WalnutLending as minter for cUSDC...");
  const setMinterTx = await fherc20.setMinter(lendingAddress);
  await setMinterTx.wait();
  console.log("   Minter set successfully");

  // Step 7: Configure Oracle price feed
  console.log("\n7. Registering MockUSDC price feed in oracle...");
  const setPriceFeedTx = await oracle.setPriceFeed(mockUsdcAddress, mockUsdcPriceFeedAddress);
  await setPriceFeedTx.wait();
  console.log("   Price feed registered successfully");

  // Step 8: Verify tier LTVs
  console.log("\n8. Verifying credit tier LTVs...");
  for (let i = 0; i < 5; i++) {
    const ltv = await lending.tierLTVs(i);
    console.log(`   Tier ${i}: ${ltv} bps (${ltv / 100}%)`);
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(80));
  console.log("\nContract Addresses (copy these to .env):");
  console.log("-".repeat(80));
  console.log(`NEXT_PUBLIC_MOCK_USDC_ADDRESS=${mockUsdcAddress}`);
  console.log(`NEXT_PUBLIC_MOCK_USDC_PRICE_FEED_ADDRESS=${mockUsdcPriceFeedAddress}`);
  console.log(`NEXT_PUBLIC_ORACLE_ADDRESS=${oracleAddress}`);
  console.log(`NEXT_PUBLIC_FHERC20_ADDRESS=${fherc20Address}`);
  console.log(`NEXT_PUBLIC_WALNUT_LENDING_ADDRESS=${lendingAddress}`);
  console.log("-".repeat(80));

  console.log("\nVerification Commands:");
  console.log("-".repeat(80));
  console.log(`npx hardhat verify --network arbitrumSepolia ${mockUsdcAddress}`);
  console.log(`npx hardhat verify --network arbitrumSepolia ${mockUsdcPriceFeedAddress}`);
  console.log(`npx hardhat verify --network arbitrumSepolia ${oracleAddress}`);
  console.log(`npx hardhat verify --network arbitrumSepolia ${fherc20Address}`);
  console.log(`npx hardhat verify --network arbitrumSepolia ${lendingAddress} ${fherc20Address} ${oracleAddress} ${treasuryAddress}`);
  console.log("-".repeat(80));

  // Save addresses to file
  const addresses = {
    mockUsdc: mockUsdcAddress,
    mockUsdcPriceFeed: mockUsdcPriceFeedAddress,
    oracle: oracleAddress,
    fherc20: fherc20Address,
    lending: lendingAddress,
    treasury: treasuryAddress,
    network: "arbitrumSepolia",
    deployedAt: new Date().toISOString(),
    deployer: deployer.address
  };

  const outputPath = path.join(__dirname, "..", "deployed-addresses.json");
  fs.writeFileSync(outputPath, JSON.stringify(addresses, null, 2));
  console.log(`\nAddresses saved to: ${outputPath}`);

  // Update .env.local if it exists
  const envPath = path.join(__dirname, "..", ".env.local");
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, "utf8");
    
    envContent = updateEnvVar(envContent, "NEXT_PUBLIC_MOCK_USDC_ADDRESS", mockUsdcAddress);
    envContent = updateEnvVar(envContent, "NEXT_PUBLIC_MOCK_USDC_PRICE_FEED_ADDRESS", mockUsdcPriceFeedAddress);
    envContent = updateEnvVar(envContent, "NEXT_PUBLIC_ORACLE_ADDRESS", oracleAddress);
    envContent = updateEnvVar(envContent, "NEXT_PUBLIC_FHERC20_ADDRESS", fherc20Address);
    envContent = updateEnvVar(envContent, "NEXT_PUBLIC_WALNUT_LENDING_ADDRESS", lendingAddress);
    
    fs.writeFileSync(envPath, envContent);
    console.log(`.env.local updated with new addresses`);
  }

  console.log("\n✅ Deployment successful!\n");
}

function updateEnvVar(content, key, value) {
  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(content)) {
    return content.replace(regex, `${key}=${value}`);
  } else {
    return content + `\n${key}=${value}`;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
