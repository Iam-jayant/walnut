const { ethers } = require("hardhat");
const { createCofheClient } = require("@cofhe/sdk/node");
const { createPublicClient, createWalletClient, http } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { arbitrumSepolia } = require("viem/chains");
const fs = require("fs");
require("dotenv").config();
require("dns").setDefaultResultOrder("ipv4first");

function toBytes32(num) {
  return ethers.zeroPadValue(ethers.toBeHex(num), 32);
}

async function main() {
  console.log("========================================");
  console.log("CLEAN Liquidation Verify: No allowGlobal");
  console.log("========================================\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const envContent = fs.readFileSync(".env", "utf8");
  const m = envContent.match(/NEXT_PUBLIC_WALNUT_LENDING_ADDRESS=(0x[a-fA-F0-9]{40})/);
  const contractAddr = m[1];
  console.log("Contract:", contractAddr);

  const walnutV2 = await ethers.getContractAt("WalnutLendingV2", contractAddr);

  // Setup viem clients
  const pkHex = process.env.PRIVATE_KEY.startsWith("0x")
    ? process.env.PRIVATE_KEY
    : "0x" + process.env.PRIVATE_KEY;
  const account = privateKeyToAccount(pkHex);
  
  const pubClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http("https://sepolia-rollup.arbitrum.io/rpc"),
  });
  const walClient = createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http("https://sepolia-rollup.arbitrum.io/rpc"),
  });

  // Create CoFHE client
  const cofhe = createCofheClient({
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    supportedChains: [{
      id: 421614,
      name: "Arbitrum Sepolia",
      network: "arb-sepolia",
      coFheUrl: "https://testnet-cofhe.fhenix.zone",
      verifierUrl: "https://testnet-cofhe-vrf.fhenix.zone",
      thresholdNetworkUrl: "https://testnet-cofhe-tn.fhenix.zone",
      environment: "TESTNET",
    }],
  });
  await cofhe.connect(pubClient, walClient);

  // Create self-permit with contract as issuer (matching frontend WalnutPermitProvider)
  console.log("\n--- Creating self-permit ---");
  console.log("Issuer (contract):", contractAddr);
  console.log("Account:", account.address);
  
  const permit = await cofhe.permits.getOrCreateSelfPermit(421614, account.address, {
    issuer: contractAddr,
    signMessage: async (msg) => account.signMessage(msg.raw),
  });
  console.log("Permit hash:", permit.hash);
  console.log("Permit type:", permit.type);
  console.log("Permit issuer:", permit.issuer);
  console.log("Permit recipient:", permit.recipient);

  // Step 1: Request liquidation check
  const borrower = ethers.Wallet.createRandom().address;
  console.log("\n--- STEP 1: requestLiquidationCheck ---");
  console.log("Borrower:", borrower);
  const tx = await walnutV2.connect(deployer).requestLiquidationCheck(borrower);
  const rc = await tx.wait();
  console.log("Tx hash:", rc.hash);

  const log = rc.logs.find((l) => {
    try { return walnutV2.interface.parseLog(l).name === "LiquidationCheckRequested"; }
    catch { return false; }
  });
  const reqId = walnutV2.interface.parseLog(log).args.requestId.toString();
  console.log("Request ID:", reqId);

  // Step 2: Wait for CoFHE processing
  console.log("\n--- STEP 2: Waiting 15s for CoFHE ---");
  await new Promise((r) => setTimeout(r, 15000));

  // Step 3: Try decryptForTx with permit
  console.log("\n--- STEP 3: decryptForTx with permit ---");
  try {
    const result = await cofhe
      .decryptForTx(reqId)
      .setChainId(421614)
      .setAccount(account.address)
      .withPermit(permit.hash)
      .execute();
    console.log("✅ Decrypt success (withPermit)!");
    console.log("   Value:", result.decryptedValue);
    console.log("   Sig:", result.signature);

    // Step 4: Submit on-chain callback
    console.log("\n--- STEP 4: syncLiquidationCheck ---");
    const ctHex = toBytes32(reqId);
    const syncTx = await walnutV2.connect(deployer).syncLiquidationCheck(
      ctHex,
      result.decryptedValue,
      result.signature
    );
    const syncRc = await syncTx.wait();
    console.log("✅ Callback tx:", syncRc.hash);

    const [state] = await walnutV2.liquidations(borrower);
    console.log("\n========================================");
    console.log("RESULT: Auction state =", state.toString(), "(0=IDLE, 1=OPEN)");
    console.log("Check tx: ", rc.hash);
    console.log("Sync tx:  ", syncRc.hash);
    console.log("========================================");
    return;
  } catch (e) {
    console.log("withPermit failed:", e.code || e.message);
    if (e.context) {
      console.log("  Status:", e.context.status, e.context.statusText);
      console.log("  Body:", JSON.stringify(e.context.body, null, 2));
    }
  }

  // Fallback: Try withoutPermit (for comparison)
  console.log("\n--- STEP 3b: decryptForTx withoutPermit (fallback) ---");
  try {
    const result = await cofhe
      .decryptForTx(reqId)
      .setChainId(421614)
      .setAccount(account.address)
      .withoutPermit()
      .execute();
    console.log("✅ Decrypt success (withoutPermit)!");
    console.log("   Value:", result.decryptedValue);
    console.log("   Sig:", result.signature);

    // Step 4: Submit on-chain callback
    console.log("\n--- STEP 4: syncLiquidationCheck ---");
    const ctHex = toBytes32(reqId);
    const syncTx = await walnutV2.connect(deployer).syncLiquidationCheck(
      ctHex,
      result.decryptedValue,
      result.signature
    );
    const syncRc = await syncTx.wait();
    console.log("✅ Callback tx:", syncRc.hash);

    const [state] = await walnutV2.liquidations(borrower);
    console.log("\n========================================");
    console.log("RESULT: Auction state =", state.toString(), "(0=IDLE, 1=OPEN)");
    console.log("Check tx: ", rc.hash);
    console.log("Sync tx:  ", syncRc.hash);
    console.log("NOTE: withoutPermit worked — investigate why permit fails");
    console.log("========================================");
  } catch (e2) {
    console.log("withoutPermit also failed:", e2.code || e2.message);
    if (e2.context) {
      console.log("  Status:", e2.context.status, e2.context.statusText);
    }
    console.log("\n========================================");
    console.log("BOTH decryptForTx methods FAILED.");
    console.log("This means the issue is NOT just the ACL pattern.");
    console.log("Next: investigate how the deposit frontend creates permits");
    console.log("and what's different about the headless script context.");
    console.log("========================================");
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
