const { ethers } = require("hardhat");
const { createCofheClient } = require("@cofhe/sdk/node");
const { createPublicClient, createWalletClient, http } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { arbitrumSepolia } = require("viem/chains");
const fs = require("fs");
require("dotenv").config();
require("dns").setDefaultResultOrder("ipv4first");

const { Encryptable } = require("@cofhe/sdk");

function toBytes32(num) {
  return ethers.zeroPadValue(ethers.toBeHex(num), 32);
}

async function main() {
  console.log("========================================");
  console.log("CLEAN Full Liquidation Cycle Verify (No allowGlobal)");
  console.log("REAL CoFHE Sync for BOTH Request & Selection");
  console.log("========================================\n");

  const [deployer] = await ethers.getSigners();
  const userBKey = ethers.Wallet.createRandom().privateKey;
  const userB = new ethers.Wallet(userBKey, ethers.provider);

  console.log("Deployer (Wallet A):", deployer.address);
  console.log("User B (Wallet B):", userB.address);

  console.log("\nFunding User B with ETH for gas...");
  const fundTx = await deployer.sendTransaction({
    to: userB.address,
    value: ethers.parseEther("0.0002"),
  });
  await fundTx.wait();
  console.log("✅ User B funded.");

  const envContent = fs.readFileSync(".env", "utf8");
  const m = envContent.match(/NEXT_PUBLIC_WALNUT_LENDING_ADDRESS=(0x[a-fA-F0-9]{40})/);
  const contractAddr = m[1];
  console.log("Using WalnutLendingV2 at:", contractAddr);

  const walnutV2 = await ethers.getContractAt("WalnutLendingV2", contractAddr);
  
  // Viem & CoFHE setup
  const pkHex = process.env.PRIVATE_KEY.startsWith("0x") ? process.env.PRIVATE_KEY : "0x" + process.env.PRIVATE_KEY;
  const accountA = privateKeyToAccount(pkHex);
  const pubClient = createPublicClient({ chain: arbitrumSepolia, transport: http("https://sepolia-rollup.arbitrum.io/rpc") });
  const walClientA = createWalletClient({ account: accountA, chain: arbitrumSepolia, transport: http("https://sepolia-rollup.arbitrum.io/rpc") });
  
  const cofhe = createCofheClient({
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    supportedChains: [{
      id: 421614, name: "Arbitrum Sepolia", network: "arb-sepolia",
      coFheUrl: "https://testnet-cofhe.fhenix.zone", verifierUrl: "https://testnet-cofhe-vrf.fhenix.zone",
      thresholdNetworkUrl: "https://testnet-cofhe-tn.fhenix.zone", environment: "TESTNET"
    }]
  });
  await cofhe.connect(pubClient, walClientA);
  
  console.log("Generating/fetching Permit for Deployer (Wallet A)...");
  const permit = await cofhe.permits.getOrCreateSelfPermit(421614, accountA.address, {
    issuer: contractAddr,
    signMessage: async (msg) => accountA.signMessage(msg.raw)
  });


  const borrower = ethers.Wallet.createRandom().address;
  console.log("\nTarget Borrower:", borrower);
  
  // ----------------------------------------------------
  // STEP 1: REQUEST LIQUIDATION CHECK
  // ----------------------------------------------------
  console.log("\n--- STEP 1: requestLiquidationCheck ---");
  const checkTx = await walnutV2.connect(deployer).requestLiquidationCheck(borrower);
  const checkRc = await checkTx.wait();
  console.log("✅ check tx:", checkRc.hash);

  const checkLog = checkRc.logs.find(l => {
    try { return walnutV2.interface.parseLog(l).name === "LiquidationCheckRequested"; } catch { return false; }
  });
  const reqId1 = walnutV2.interface.parseLog(checkLog).args.requestId.toString();
  
  console.log("Waiting 15s for CoFHE Threshold Network...");
  await new Promise(r => setTimeout(r, 15000));

  console.log("Fetching check decrypt result (with Deployer permit)...");
  const checkResult = await cofhe.decryptForTx(reqId1).setChainId(421614).setAccount(accountA.address).withPermit(permit.hash).execute();
  
  console.log("Submitting syncLiquidationCheck on-chain...");
  const syncCheckTx = await walnutV2.connect(deployer).syncLiquidationCheck(toBytes32(reqId1), checkResult.decryptedValue, checkResult.signature);
  const syncCheckRc = await syncCheckTx.wait();
  console.log("✅ syncCheck tx:", syncCheckRc.hash);
  
  const [stateAfterCheck] = await walnutV2.liquidations(borrower);
  console.log("Auction state:", stateAfterCheck.toString(), "(Expected: 1 = OPEN)");
  
  if (stateAfterCheck.toString() !== "1") {
    console.error("Auction did not open! Aborting.");
    process.exit(1);
  }

  // ----------------------------------------------------
  // STEP 2: SUBMIT 10 BIDS TO REACH CAP (FORCE EARLY CLOSE)
  // ----------------------------------------------------
  console.log("\n--- STEP 2: Submitting 10 Bids (2 Real Wallets) ---");

  async function encryptBid(client, accountAddr, amount) {
    const [encrypted] = await client.encryptInputs([Encryptable.uint128(amount)])
      .setAccount(accountAddr)
      .setChainId(421614)
      .execute();
    return encrypted;
  }
  
  const enc1 = await encryptBid(cofhe, accountA.address, 100n);
  const bid1Tx = await walnutV2.connect(deployer).submitLiquidationBid(borrower, enc1);
  const bid1Rc = await bid1Tx.wait();
  console.log("✅ Bid 1 Tx (Deployer):", bid1Rc.hash);

  // We need a CoFHE client for userB
  const cofheB = createCofheClient({
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    supportedChains: [{
      id: 421614, name: "Arbitrum Sepolia", network: "arb-sepolia",
      coFheUrl: "https://testnet-cofhe.fhenix.zone", verifierUrl: "https://testnet-cofhe-vrf.fhenix.zone",
      thresholdNetworkUrl: "https://testnet-cofhe-tn.fhenix.zone", environment: "TESTNET"
    }]
  });
  const accountB = privateKeyToAccount(userBKey);
  const walClientB = createWalletClient({ account: accountB, chain: arbitrumSepolia, transport: http("https://sepolia-rollup.arbitrum.io/rpc") });
  await cofheB.connect(pubClient, walClientB);

  const enc2 = await encryptBid(cofheB, accountB.address, 200n);
  const bid2Tx = await walnutV2.connect(userB).submitLiquidationBid(borrower, enc2);
  const bid2Rc = await bid2Tx.wait();
  console.log("✅ Bid 2 Tx (UserB):", bid2Rc.hash);

  console.log("Submitting remaining 8 bids to hit cap...");
  for (let i = 2; i < 10; i++) {
    const encN = await encryptBid(cofhe, accountA.address, BigInt(i));
    const bTx = await walnutV2.connect(deployer).submitLiquidationBid(borrower, encN);
    await bTx.wait();
  }
  console.log("✅ Auction reached 10 bids cap.");

  // ----------------------------------------------------
  // STEP 3: SELECT WINNING BID
  // ----------------------------------------------------
  console.log("\n--- STEP 3: selectWinningBid ---");
  const selTx = await walnutV2.connect(deployer).selectWinningBid(borrower);
  const selRc = await selTx.wait();
  console.log("✅ select tx:", selRc.hash);

  const selLog = selRc.logs.find(l => {
    try { return walnutV2.interface.parseLog(l).name === "WinnerSelectionRequested"; } catch { return false; }
  });
  const reqId2 = walnutV2.interface.parseLog(selLog).args.requestId.toString();
  console.log("Winner selection Request ID:", reqId2);

  // ----------------------------------------------------
  // STEP 4: REAL SYNC CALLBACK FOR WINNER
  // ----------------------------------------------------
  console.log("\n--- STEP 4: Waiting 15s for CoFHE Winner Selection ---");
  await new Promise(r => setTimeout(r, 15000));

  console.log("Fetching winner decrypt result (with Deployer permit)...");
  try {
    const winResult = await cofhe.decryptForTx(reqId2).setChainId(421614).setAccount(accountA.address).withPermit(permit.hash).execute();
    console.log("✅ Off-chain Decrypt Success!");
    console.log("   Winner Index:", winResult.decryptedValue);
    
    console.log("Submitting syncWinnerSelection on-chain...");
    const syncWinTx = await walnutV2.connect(deployer).syncWinnerSelection(toBytes32(reqId2), winResult.decryptedValue, winResult.signature);
    const syncWinRc = await syncWinTx.wait();
    console.log("✅ syncWinnerSelection tx:", syncWinRc.hash);

    const [finalState] = await walnutV2.liquidations(borrower);
    console.log("\n========================================");
    console.log("FULL LIFECYCLE COMPLETE");
    console.log("Final Auction State:", finalState.toString(), "(Expected: 0 = IDLE)");
    console.log("Check Request Tx:    ", checkRc.hash);
    console.log("Wallet A Bid Tx:     ", bid1Rc.hash);
    console.log("Wallet B Bid Tx:     ", bid2Rc.hash);
    console.log("Select Winner Tx:    ", selRc.hash);
    console.log("Sync Settlement Tx:  ", syncWinRc.hash);
    console.log("========================================");
  } catch (e) {
    console.log("Winner Selection Sync Failed:", e.message || e);
    if (e.context) console.log("Status:", e.context.status);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
