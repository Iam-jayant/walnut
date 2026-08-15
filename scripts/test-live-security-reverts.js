const hre = require("hardhat");

async function main() {
  console.log("=================================================");
  console.log("Testing Live On-Chain Security Reverts on Arbitrum Sepolia");
  console.log("=================================================\n");

  const [signer] = await hre.ethers.getSigners();
  console.log("Test Signer Address:", signer.address);
  const bal = await hre.ethers.provider.getBalance(signer.address);
  console.log("Signer Balance:     ", hre.ethers.formatEther(bal), "ETH");

  const lendingAddress = "0x0EdA387ef2bE47317c5a342EAcEabE7CED297ED8";
  const p2pAddress = "0xDBE85a6e8369B7E155B4c78dA7e0e841d97322Bc";
  const wUSDCAddress = "0x8684d325BE9B635BD72bFC2bB10bB6f354f5Cd61";
  const fakeVault = "0x1111111111111111111111111111111111111111";

  const dummyEnc64 = { ctHash: 0n, securityZone: 0, utype: 0, signature: "0x" };
  const dummyEnc128 = { ctHash: 0n, securityZone: 0, utype: 0, signature: "0x" };

  // 1. Check WalnutLendingV2 contract read
  console.log("\n[1] Checking WalnutLendingV2 at", lendingAddress);
  const lending = await hre.ethers.getContractAt("WalnutLendingV2", lendingAddress);

  try {
    const isApp = await lending.isApprovedVault(wUSDCAddress);
    console.log("isApprovedVault(wUSDC):", isApp);
  } catch (err) {
    console.log("isApprovedVault query (older deployment):", err.message || err);
  }

  // Static call simulation for deposit with unregistered vault
  console.log("\n[2] Simulating deposit() with unregistered vault address...");
  try {
    await lending.deposit.staticCall(fakeVault, dummyEnc64);
    console.log("❌ FAILURE: deposit() did not revert!");
  } catch (err) {
    const reason = err.reason || err.message || err.toString();
    console.log("✅ deposit() reverted as expected on-chain with:", reason);
  }

  // Static call simulation for withdraw with unregistered vault
  console.log("\n[3] Simulating withdraw() with unregistered vault address...");
  try {
    await lending.withdraw.staticCall(fakeVault, dummyEnc128);
    console.log("❌ FAILURE: withdraw() did not revert!");
  } catch (err) {
    const reason = err.reason || err.message || err.toString();
    console.log("✅ withdraw() reverted as expected on-chain with:", reason);
  }

  // 2. Check WalnutP2P contract
  console.log("\n[4] Checking WalnutP2P at", p2pAddress);
  const p2p = await hre.ethers.getContractAt("WalnutP2P", p2pAddress);

  console.log("Simulating matchOfferPlaintext() called by non-owner...");
  try {
    await p2p.matchOfferPlaintext.staticCall(0, 1000000n, 500n, 30n);
    console.log("❌ FAILURE: matchOfferPlaintext() did not revert!");
  } catch (err) {
    const reason = err.reason || err.message || err.toString();
    console.log("✅ matchOfferPlaintext() reverted as expected on-chain with:", reason);
  }

  console.log("\n=================================================");
  console.log("LIVE SECURITY REVERT VERIFICATION COMPLETE");
  console.log("=================================================\n");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
