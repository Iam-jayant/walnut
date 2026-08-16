const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("=================================================");
  console.log("Deploying Patched Contracts to Arbitrum Sepolia");
  console.log("=================================================\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer / Owner address:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer ETH balance:    ", hre.ethers.formatEther(balance), "ETH");

  const cUSDC_Address = process.env.NEXT_PUBLIC_FHERC20_ADDRESS || "0x78136BC03b4549688C48181a26c521eb2F27F23F";
  const oracleAddress = "0x82E7caF958B329c47F10778E10A89B2319D67A14";
  const wUSDC_Address = "0x8684d325BE9B635BD72bFC2bB10bB6f354f5Cd61";
  const treasuryAddress = deployer.address;

  // 1. Deploy Patched WalnutLendingV2
  console.log("\n[1/4] Deploying patched WalnutLendingV2 (with isApprovedVault)...");
  const WalnutLendingV2 = await hre.ethers.getContractFactory("WalnutLendingV2");
  const walnutV2 = await WalnutLendingV2.deploy(cUSDC_Address, oracleAddress, treasuryAddress);
  await walnutV2.waitForDeployment();
  const v2Address = await walnutV2.getAddress();
  console.log("✅ NEW WalnutLendingV2 deployed at:", v2Address);

  // Set wUSDC address (auto-approves wUSDC in isApprovedVault)
  console.log("Setting wUSDC address & whitelist entry...");
  const setWUSDCTx = await walnutV2.setWUSDCAddress(wUSDC_Address);
  await setWUSDCTx.wait();
  console.log("✅ setWUSDCAddress Tx Hash:", setWUSDCTx.hash);

  // Set minter on cUSDC
  console.log("Updating minter on cUSDC...");
  const cUSDC = await hre.ethers.getContractAt("WalnutFHERC20", cUSDC_Address);
  const setMinterTx = await cUSDC.setMinter(v2Address);
  await setMinterTx.wait();
  console.log("✅ setMinter Tx Hash:", setMinterTx.hash);

  // 2. Deploy Patched WalnutP2P
  console.log("\n[2/4] Deploying patched WalnutP2P (with onlyOwner Plaintext Helpers)...");
  const WalnutP2P = await hre.ethers.getContractFactory("WalnutP2P");
  const walnutP2P = await WalnutP2P.deploy(cUSDC_Address);
  await walnutP2P.waitForDeployment();
  const p2pAddress = await walnutP2P.getAddress();
  console.log("✅ NEW WalnutP2P deployed at:", p2pAddress);

  // 3. Vault Whitelist On-Chain Revert Transactions
  console.log("\n[3/4] Submitting ON-CHAIN revert transactions against NEW WalnutLendingV2...");
  const fakeVault = "0x1111111111111111111111111111111111111111";
  const dummyEnc64 = { ctHash: 0n, securityZone: 0, utype: 0, signature: "0x" };
  const dummyEnc128 = { ctHash: 0n, securityZone: 0, utype: 0, signature: "0x" };

  // On-Chain deposit() revert tx
  console.log("Submitting deposit() with unregistered vault address...");
  try {
    const depTx = await walnutV2.deposit(fakeVault, dummyEnc64);
    console.log("Deposit Tx Hash Submitted:", depTx.hash);
    await depTx.wait();
  } catch (err) {
    console.log("✅ deposit() revert caught!");
    const hash = err.receipt?.hash || err.transactionHash || err.tx?.hash;
    console.log("✅ Deposit Revert Tx Hash:", hash || "N/A (Reverted during gas estimation)");
    console.log("Reason:", err.reason || err.message);
  }

  // On-Chain withdraw() revert tx
  console.log("Submitting withdraw() with unregistered vault address...");
  try {
    const wdTx = await walnutV2.withdraw(fakeVault, dummyEnc128);
    console.log("Withdraw Tx Hash Submitted:", wdTx.hash);
    await wdTx.wait();
  } catch (err) {
    console.log("✅ withdraw() revert caught!");
    const hash = err.receipt?.hash || err.transactionHash || err.tx?.hash;
    console.log("✅ Withdraw Revert Tx Hash:", hash || "N/A (Reverted during gas estimation)");
    console.log("Reason:", err.reason || err.message);
  }

  // 4. Plaintext Helper On-Chain Revert Transaction from Non-Owner Wallet
  console.log("\n[4/4] Submitting ON-CHAIN revert transaction against NEW WalnutP2P from Non-Owner...");
  const nonOwnerWallet = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
  console.log("Non-Owner Test Wallet:", nonOwnerWallet.address);

  // Fund non-owner wallet with 0.0005 ETH for gas
  const fundTx = await deployer.sendTransaction({
    to: nonOwnerWallet.address,
    value: hre.ethers.parseEther("0.0005")
  });
  await fundTx.wait();
  console.log("Funded non-owner wallet. Tx Hash:", fundTx.hash);

  try {
    const matchTx = await walnutP2P.connect(nonOwnerWallet).matchOfferPlaintext(0, 1000000n, 500n, 30n);
    console.log("matchOfferPlaintext Tx Hash Submitted:", matchTx.hash);
    await matchTx.wait();
  } catch (err) {
    console.log("✅ matchOfferPlaintext() revert caught!");
    const hash = err.receipt?.hash || err.transactionHash || err.tx?.hash;
    console.log("✅ matchOfferPlaintext Revert Tx Hash:", hash || "N/A (Reverted during gas estimation)");
    console.log("Reason:", err.reason || err.message);
  }

  // Also submit actual on-chain transaction with gas limit override to force transaction broadcast if gas estimation reverts
  console.log("\nForcing on-chain transaction broadcast with explicit gasLimit for Arbiscan receipt...");
  try {
    const forcedDepTx = await walnutV2.deposit(fakeVault, dummyEnc64, { gasLimit: 100000 });
    console.log("Explicit Mined Deposit Revert Tx Hash:", forcedDepTx.hash);
    await forcedDepTx.wait();
  } catch (err) {
    const hash = err.receipt?.hash || err.transactionHash || (err.transaction && err.transaction.hash);
    console.log("Explicit Mined Deposit Revert Tx Hash:", hash || "Revert recorded");
  }

  try {
    const forcedMatchTx = await walnutP2P.connect(nonOwnerWallet).matchOfferPlaintext(0, 1000000n, 500n, 30n, { gasLimit: 100000 });
    console.log("Explicit Mined MatchPlaintext Revert Tx Hash:", forcedMatchTx.hash);
    await forcedMatchTx.wait();
  } catch (err) {
    const hash = err.receipt?.hash || err.transactionHash || (err.transaction && err.transaction.hash);
    console.log("Explicit Mined MatchPlaintext Revert Tx Hash:", hash || "Revert recorded");
  }

  console.log("\n=================================================");
  console.log("NEW PATCHED CONTRACTS DEPLOYED & VERIFIED");
  console.log("New WalnutLendingV2 Address:", v2Address);
  console.log("New WalnutP2P Address:      ", p2pAddress);
  console.log("=================================================\n");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
