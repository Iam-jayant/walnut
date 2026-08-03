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

// Generate a dummy encrypted value structure that matches `InEuint128` format 
// (which is a tuple of bytes, bytes, and uint8) for the bid. We aren't testing 
// the actual FHE math here, just the state transition logic on live network.
let ctCounter = BigInt(Date.now());
function makeEncryptedInput() {
  ctCounter += 1n;
  // Format: InEuint128 = (bytes data, bytes security, uint8 precision)
  // Hardhat requires matching the tuple exactly.
  // Actually, InEuint128 is a struct: { data: bytes, security: bytes }
  // Wait, no, it's bytes. Let's look at how the other script did it:
  //   return [ctCounter << 24n, 0, 6, "0x"];
  // Let's check WalnutLendingV2.sol struct definition for InEuint128, oh it's from fhenix.
  // In `WalnutFHERC20`, we used `[ctHex, 0, 0, "0x"]` or similar in hardhat.
  // Actually, FHE.asEuint128 takes `inEuint128`. In modern fhenix it's usually 1 argument `bytes calldata`.
  // Wait, earlier I saw `makeEncryptedInput` returned `[ctCounter << 24n, 0, 6, "0x"]`. No, let's just use `0x` string for FHE mock, or use the CoFHE SDK `encrypt`?
  // CoFHE SDK doesn't encrypt to network, but for testnet we can just pass a dummy byte array if it's mocked, but it's not mocked! Arbitrum Sepolia has real CoFHE TaskManager!
  // BUT the testnet might have real FHE. Wait, the `submitLiquidationBid` accepts `InEuint128 calldata encryptedAmount`.
}

async function main() {
  console.log("========================================");
  console.log("CLEAN Full Liquidation Cycle Verify (No allowGlobal)");
  console.log("========================================\n");

  const [deployer] = await ethers.getSigners();
  const userBKey = ethers.Wallet.createRandom().privateKey;
  const userB = new ethers.Wallet(userBKey, ethers.provider);

  console.log("Deployer:", deployer.address);
  console.log("UserB:", userB.address);

  console.log("\nFunding UserB...");
  const fundTx = await deployer.sendTransaction({
    to: userB.address,
    value: ethers.parseEther("0.005"),
  });
  await fundTx.wait();

  const envContent = fs.readFileSync(".env", "utf8");
  const m = envContent.match(/NEXT_PUBLIC_WALNUT_LENDING_ADDRESS=(0x[a-fA-F0-9]{40})/);
  const contractAddr = m[1];
  console.log("Contract:", contractAddr);

  const walnutV2 = await ethers.getContractAt("WalnutLendingV2", contractAddr);
  
  // Create viem & CoFHE clients for deployer
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

  const borrower = ethers.Wallet.createRandom().address;
  console.log("\n--- STEP 1: Request Liquidation Check ---");
  console.log("Target Borrower:", borrower);
  
  const checkTx = await walnutV2.connect(deployer).requestLiquidationCheck(borrower);
  const checkRc = await checkTx.wait();
  console.log("✅ check tx:", checkRc.hash);

  const checkLog = checkRc.logs.find(l => {
    try { return walnutV2.interface.parseLog(l).name === "LiquidationCheckRequested"; } catch { return false; }
  });
  const reqId = walnutV2.interface.parseLog(checkLog).args.requestId.toString();
  console.log("check reqId:", reqId);

  console.log("Waiting 15s for CoFHE...");
  await new Promise(r => setTimeout(r, 15000));

  console.log("Fetching sync result...");
  const checkResult = await cofhe.decryptForTx(reqId).setChainId(421614).setAccount(accountA.address).withoutPermit().execute();
  
  console.log("Submitting syncLiquidationCheck...");
  const syncCheckTx = await walnutV2.connect(deployer).syncLiquidationCheck(toBytes32(reqId), checkResult.decryptedValue, checkResult.signature);
  const syncCheckRc = await syncCheckTx.wait();
  console.log("✅ syncCheck tx:", syncCheckRc.hash);
  
  const [stateAfterCheck] = await walnutV2.liquidations(borrower);
  console.log("Auction state (expected 1/OPEN):", stateAfterCheck.toString());

  console.log("\n--- STEP 2: Submitting 10 Bids (5 deployer, 5 userB) ---");
  // Helper to encrypt
  async function submitBid(signer) {
    const value = BigInt(Math.floor(Math.random() * 1000));
    // FHE encrypt on live testnet using instance method. 
    // Wait! CoFHE SDK doesn't encrypt to FHE, it only decrypts.
    // For testnet, we just pass an empty tuple or something if the contract doesn't actually parse it correctly?
    // Actually, `Encryptable` from FHE SDK is needed. 
    // Let me check how other scripts encrypt on live testnet.
  }
}
main().catch(console.error);
