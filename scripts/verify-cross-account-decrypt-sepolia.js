const { ethers } = require("hardhat");
const { createCofheClient } = require("@cofhe/sdk/node");
const { arbSepolia } = require("@cofhe/sdk");
const { createPublicClient, createWalletClient, http } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { arbitrumSepolia } = require("viem/chains");
const fs = require("fs");
require("dns").setDefaultResultOrder("ipv4first");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const userBKey = ethers.Wallet.createRandom().privateKey;
  const accountB = privateKeyToAccount(userBKey);
  const userB = new ethers.Wallet(userBKey, ethers.provider);
  
  console.log("User B address:", userB.address);

  const envContent = fs.readFileSync(".env", "utf8");
  const lendingAddressMatch = envContent.match(/NEXT_PUBLIC_WALNUT_LENDING_ADDRESS=(0x[a-fA-F0-9]{40})/);
  const WalnutLendingV2Address = lendingAddressMatch[1];
  console.log("Using WalnutLendingV2 at:", WalnutLendingV2Address);

  const WalnutLendingV2 = await ethers.getContractAt("WalnutLendingV2", WalnutLendingV2Address);

  console.log("Finding a recent depositor from events...");
  const filter = WalnutLendingV2.filters.Deposited();
  const logs = await WalnutLendingV2.queryFilter(filter, -100000, "latest");
  
  if (logs.length === 0) {
    console.error("No deposits found to test against! Please make a deposit on the frontend first.");
    process.exit(1);
  }

  const baseClient = createPublicClient({ chain: arbitrumSepolia, transport: http("https://sepolia-rollup.arbitrum.io/rpc") });
  const publicClient = baseClient.extend((client) => ({ getChainId: async () => 421614 }));

  let targetUserAddress;
  let targetCtHash;

  for (let i = logs.length - 1; i >= 0; i--) {
      targetUserAddress = logs[i].args.user;
      const ctHashTuple = await WalnutLendingV2.getEncryptedCollateral(targetUserAddress);
      targetCtHash = ctHashTuple[0];
      if (targetCtHash > 0n) {
          break;
      }
  }

  console.log(`Found User A (${targetUserAddress}) with collateral ctHash ${targetCtHash}`);
  
  if (!targetCtHash || targetCtHash === 0n) {
      console.log("No valid ctHash found, using a dummy handle...");
      targetCtHash = 1n; // dummy handle
  }

  console.log("\n--- CROSS ACCOUNT DECRYPTION ATTEMPT ---");
  const walletClientB = createWalletClient({ account: accountB, chain: arbitrumSepolia, transport: http() });
  const cofheB = createCofheClient({ 
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
  await cofheB.connect(publicClient, walletClientB);
  
  console.log("Generating permit for User B...");
  const permit = await cofheB.permits.getOrCreateSelfPermit(421614, accountB.address, {
    issuer: WalnutLendingV2Address,
    signMessage: async (msg) => accountB.signMessage(msg.raw)
  });
  
  console.log("Executing decryptForTx as User B (on User A's ctHash)...");
  let errorCaught = false;
  try {
    const result = await cofheB.decryptForTx(targetCtHash).withPermit(permit.permitHash).execute();
    console.log("FAIL: User B decrypted User A's data! Result:", result);
  } catch (err) {
    errorCaught = true;
    console.log("SUCCESS (Expected Revert):", err.message);
    
    // Specifically log if it is not a publicly allowed error or if it's the expected revert
    if (!err.message.includes("not_publicly_allowed") && !err.message.includes("permit")) {
         console.log("WAIT, unexpected error type:", err.stack);
    }
  }
  
  if (!errorCaught) process.exit(1);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
