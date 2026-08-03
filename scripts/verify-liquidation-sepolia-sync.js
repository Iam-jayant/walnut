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
  console.log("Arbitrum Sepolia Liquidation Off-Chain Decrypt & Sync Verification");
  console.log("========================================\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer Wallet:", deployer.address);

  const envContent = fs.readFileSync(".env", "utf8");
  const lendingAddressMatch = envContent.match(/NEXT_PUBLIC_WALNUT_LENDING_ADDRESS=(0x[a-fA-F0-9]{40})/);
  const WalnutLendingV2Address = lendingAddressMatch[1];
  console.log("Using WalnutLendingV2 at:", WalnutLendingV2Address);

  const walnutV2 = await ethers.getContractAt("WalnutLendingV2", WalnutLendingV2Address);

  // Setup CoFHE client
  const baseClient = createPublicClient({ 
    chain: arbitrumSepolia, 
    transport: http("https://sepolia-rollup.arbitrum.io/rpc") 
  });
  const publicClient = baseClient.extend((client) => ({ getChainId: async () => 421614 }));

  const pkA = process.env.PRIVATE_KEY.startsWith("0x") ? process.env.PRIVATE_KEY : "0x" + process.env.PRIVATE_KEY;
  const accountA = privateKeyToAccount(pkA);
  const walletClientA = createWalletClient({ account: accountA, chain: arbitrumSepolia, transport: http() });

  const cofhe = createCofheClient({ 
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    supportedChains: [{
      id: 421614,
      name: "Arbitrum Sepolia",
      network: "arb-sepolia",
      coFheUrl: "https://testnet-cofhe.fhenix.zone",
      verifierUrl: "https://testnet-cofhe-vrf.fhenix.zone",
      thresholdNetworkUrl: "https://testnet-cofhe-tn.fhenix.zone",
      environment: "TESTNET"
    }]
  });
  await cofhe.connect(publicClient, walletClientA);

  console.log("Generating CoFHE self-permit for deployer...");
  const permit = await cofhe.permits.getOrCreateSelfPermit(421614, accountA.address, {
    issuer: WalnutLendingV2Address,
    signMessage: async (msg) => accountA.signMessage(msg.raw)
  });
  const pHash = permit.hash;
  console.log("✅ Permit obtained. Hash:", pHash);

  const freshBorrower = ethers.Wallet.createRandom().address;
  console.log("\n--- STEP 1: Submitting fresh requestLiquidationCheck on Sepolia ---");
  console.log("Target Borrower:", freshBorrower);
  const tx = await walnutV2.connect(deployer).requestLiquidationCheck(freshBorrower);
  const rc = await tx.wait();
  console.log("✅ STEP 1 TX HASH (requestLiquidationCheck):", rc.hash);

  const log = rc.logs.find(l => {
    try { return walnutV2.interface.parseLog(l).name === "LiquidationCheckRequested"; } catch { return false; }
  });
  const freshReqId = walnutV2.interface.parseLog(log).args.requestId.toString();
  console.log("Generated Request ID:", freshReqId);

  console.log("\n--- STEP 2: Waiting 15 seconds for CoFHE Threshold Network calculation ---");
  await new Promise((resolve) => setTimeout(resolve, 15000));

  console.log("Calling decryptForTx off-chain to fetch threshold result + signature...");
  console.log("Using .withPermit(pHash) — matching deposit/borrow frontend pattern");
  console.log("ACL source: _requestDecrypt() → FHE.allowThis + FHE.allow(value, msg.sender)");
  const decryptResult = await cofhe
    .decryptForTx(freshReqId)
    .setChainId(421614)
    .setAccount(accountA.address)
    .withPermit(pHash)
    .execute();
  console.log("✅ Off-chain Decryption Result Fetched from CoFHE Threshold Network!");
  console.log("   - Decrypted Value:", decryptResult.decryptedValue);
  console.log("   - Signature:       ", decryptResult.signature);

  console.log("\n--- STEP 3: Submitting ON-CHAIN CALLBACK (syncLiquidationCheck) ---");
  const ctHex = toBytes32(freshReqId);
  const syncTx = await walnutV2.connect(deployer).syncLiquidationCheck(
    ctHex,
    decryptResult.decryptedValue,
    decryptResult.signature
  );
  const syncRc = await syncTx.wait();
  console.log("✅ STEP 3 TX HASH (syncLiquidationCheck Callback):", syncRc.hash);

  const [state] = await walnutV2.liquidations(freshBorrower);
  console.log("\n========================================");
  console.log("LIVE SEPOLIA ASYNC LIQUIDATION CHECK & CALLBACK COMPLETE!");
  console.log("----------------------------------------");
  console.log("Target Borrower:", freshBorrower);
  console.log("Request ID:     ", freshReqId);
  console.log("Auction State:  ", state, "(0 = IDLE, 1 = OPEN)");
  console.log("Check Tx Hash:   ", rc.hash);
  console.log("Callback Tx Hash:", syncRc.hash);
  console.log("========================================\n");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
