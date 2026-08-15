const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("=================================================");
  console.log("Deploying & Verifying Security Fixes on Arbitrum Sepolia");
  console.log("=================================================\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer / Owner address:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer ETH balance:    ", hre.ethers.formatEther(balance), "ETH");

  // Create a secondary non-owner wallet for testing access restrictions
  const nonOwnerWallet = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
  console.log("Non-Owner Test Wallet:   ", nonOwnerWallet.address);

  // Fund non-owner wallet with 0.005 ETH for gas fees
  console.log("\nFunding non-owner test wallet with 0.005 ETH...");
  const fundTx = await deployer.sendTransaction({
    to: nonOwnerWallet.address,
    value: hre.ethers.parseEther("0.005"),
  });
  await fundTx.wait();
  console.log("✅ Funding Tx Hash:", fundTx.hash);

  const cUSDC_Address = "0x78136BC03b4549688C48181a26c521eb2F27F23F";
  const oracleAddress = "0x82E7caF958B329c47F10778E10A89B2319D67A14";
  const wUSDC_Address = "0x8684d325BE9B635BD72bFC2bB10bB6f354f5Cd61";
  const treasuryAddress = deployer.address;

  // -------------------------------------------------------------------
  // 1. Deploy Updated WalnutLendingV2
  // -------------------------------------------------------------------
  console.log("\n[1/4] Deploying updated WalnutLendingV2 with Vault Whitelist...");
  const WalnutLendingV2 = await hre.ethers.getContractFactory("WalnutLendingV2");
  const walnutV2 = await WalnutLendingV2.deploy(cUSDC_Address, oracleAddress, treasuryAddress);
  await walnutV2.waitForDeployment();
  const v2Address = await walnutV2.getAddress();
  console.log("✅ WalnutLendingV2 deployed at:", v2Address);

  // Set wUSDC Address (which also auto-approves wUSDC in isApprovedVault)
  console.log("Configuring wUSDC wrapper address & whitelist entry...");
  const setWUSDCTx = await walnutV2.setWUSDCAddress(wUSDC_Address);
  await setWUSDCTx.wait();
  console.log("✅ setWUSDCAddress Tx Hash:", setWUSDCTx.hash);

  // Set minter on cUSDC
  console.log("Updating minter on cUSDC...");
  const cUSDC = await hre.ethers.getContractAt("WalnutFHERC20", cUSDC_Address);
  const setMinterTx = await cUSDC.setMinter(v2Address);
  await setMinterTx.wait();
  console.log("✅ setMinter Tx Hash:", setMinterTx.hash);

  // -------------------------------------------------------------------
  // 2. Deploy Updated WalnutP2P
  // -------------------------------------------------------------------
  console.log("\n[2/4] Deploying updated WalnutP2P with onlyOwner Plaintext Helpers...");
  const WalnutP2P = await hre.ethers.getContractFactory("WalnutP2P");
  const walnutP2P = await WalnutP2P.deploy(cUSDC_Address);
  await walnutP2P.waitForDeployment();
  const p2pAddress = await walnutP2P.getAddress();
  console.log("✅ WalnutP2P deployed at:", p2pAddress);

  // -------------------------------------------------------------------
  // 3. Vault Whitelist Regression Testing
  // -------------------------------------------------------------------
  console.log("\n[3/4] Running Vault Whitelist Regression Tests against WalnutLendingV2...");

  const isApprovedBefore = await walnutV2.isApprovedVault(wUSDC_Address);
  console.log("Canonical wUSDC Vault Approved:", isApprovedBefore);

  const fakeUnregisteredVault = "0x1111111111111111111111111111111111111111";
  const dummyEncryptedInput = {
    ctHash: 0n,
    securityZone: 0,
    utype: 0,
    signature: "0x",
  };

  // Test deposit() with unregistered vault token
  console.log("Testing deposit() with unregistered vault address:", fakeUnregisteredVault);
  let depositReverted = false;
  let depositTxHash = null;
  try {
    const depTx = await walnutV2.connect(deployer).deposit(fakeUnregisteredVault, dummyEncryptedInput);
    depositTxHash = depTx.hash;
    await depTx.wait();
  } catch (err) {
    depositReverted = true;
    const msg = err.reason || err.message || err.toString();
    console.log("✅ deposit() reverted as expected with error:", msg);
  }
  if (!depositReverted) {
    throw new Error("❌ FAILURE: deposit() did not revert with unregistered vault token!");
  }

  // Test withdraw() with unregistered vault token
  console.log("Testing withdraw() with unregistered vault address:", fakeUnregisteredVault);
  let withdrawReverted = false;
  let withdrawTxHash = null;
  try {
    const wdTx = await walnutV2.connect(deployer).withdraw(fakeUnregisteredVault, dummyEncryptedInput);
    withdrawTxHash = wdTx.hash;
    await wdTx.wait();
  } catch (err) {
    withdrawReverted = true;
    const msg = err.reason || err.message || err.toString();
    console.log("✅ withdraw() reverted as expected with error:", msg);
  }
  if (!withdrawReverted) {
    throw new Error("❌ FAILURE: withdraw() did not revert with unregistered vault token!");
  }

  // -------------------------------------------------------------------
  // 4. Plaintext Helper Protection Regression Testing
  // -------------------------------------------------------------------
  console.log("\n[4/4] Running Plaintext Helper Protection Regression Tests against WalnutP2P...");

  // Non-owner calling createOfferPlaintext
  console.log("Testing createOfferPlaintext() called by non-owner wallet:", nonOwnerWallet.address);
  let createPlaintextReverted = false;
  try {
    const tx = await walnutP2P.connect(nonOwnerWallet).createOfferPlaintext(0, 1000000, 500, 30);
    console.log("Tx hash submitted:", tx.hash);
    await tx.wait();
  } catch (err) {
    createPlaintextReverted = true;
    const msg = err.reason || err.message || err.toString();
    console.log("✅ createOfferPlaintext() reverted as expected for non-owner with error:", msg);
  }
  if (!createPlaintextReverted) {
    throw new Error("❌ FAILURE: createOfferPlaintext() did not revert for non-owner caller!");
  }

  // Non-owner calling matchOfferPlaintext
  console.log("Testing matchOfferPlaintext() called by non-owner wallet:", nonOwnerWallet.address);
  let matchPlaintextReverted = false;
  try {
    const tx = await walnutP2P.connect(nonOwnerWallet).matchOfferPlaintext(0, 1000000, 500, 30);
    console.log("Tx hash submitted:", tx.hash);
    await tx.wait();
  } catch (err) {
    matchPlaintextReverted = true;
    const msg = err.reason || err.message || err.toString();
    console.log("✅ matchOfferPlaintext() reverted as expected for non-owner with error:", msg);
  }
  if (!matchPlaintextReverted) {
    throw new Error("❌ FAILURE: matchOfferPlaintext() did not revert for non-owner caller!");
  }

  // Owner calling createOfferPlaintext (should succeed)
  console.log("\nTesting createOfferPlaintext() called by OWNER wallet...");
  const ownerCreateTx = await walnutP2P.connect(deployer).createOfferPlaintext(0, 1000000, 500, 30);
  await ownerCreateTx.wait();
  console.log("✅ Owner createOfferPlaintext Tx Hash:", ownerCreateTx.hash);

  console.log("\n=================================================");
  console.log("ALL SECURITY FIXES DEPLOYED AND VERIFIED SUCCESSFULLY!");
  console.log("New WalnutLendingV2 Address:", v2Address);
  console.log("New WalnutP2P Address:      ", p2pAddress);
  console.log("setWUSDCAddress Tx Hash:    ", setWUSDCTx.hash);
  console.log("setMinter Tx Hash:          ", setMinterTx.hash);
  console.log("Owner createOfferPlaintext: ", ownerCreateTx.hash);
  console.log("=================================================\n");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
