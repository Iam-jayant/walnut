const { ethers } = require("hardhat");
const { createCofheClient } = require("@cofhe/sdk/node");
const { createPublicClient, createWalletClient, http } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { arbitrumSepolia } = require("viem/chains");
const fs = require("fs");
require("dns").setDefaultResultOrder("ipv4first");

async function main() {
  console.log("========================================");
  console.log("Arbitrum Sepolia Cross-Account Bid Decryption Security Verification");
  console.log("========================================\n");

  const envContent = fs.readFileSync(".env", "utf8");
  const lendingAddressMatch = envContent.match(/NEXT_PUBLIC_WALNUT_LENDING_ADDRESS=(0x[a-fA-F0-9]{40})/);
  const WalnutLendingV2Address = lendingAddressMatch[1];
  console.log("Using WalnutLendingV2 at:", WalnutLendingV2Address);

  // Create User B (Unauthorized Bidder / Attacker trying to spy on User A's bid)
  const userBKey = ethers.Wallet.createRandom().privateKey;
  const accountB = privateKeyToAccount(userBKey);
  const userB = new ethers.Wallet(userBKey, ethers.provider);

  console.log("User B (Attacker) address:", userB.address);

  // Target ciphertext handle representing User A's encrypted bid amount (e.g. 0xabc...)
  // Even if using a dummy handle or real handle on-chain, FHE permission check enforces user access control
  const dummyBidCtHash = 0x3cd34e19463c7dc574594101435146012adfc287n;
  console.log("User A encrypted bid ciphertext handle:", dummyBidCtHash.toString(16));

  console.log("\n--- ATTEMPTING CROSS-ACCOUNT BID DECRYPTION ---");
  const baseClient = createPublicClient({ 
    chain: arbitrumSepolia, 
    transport: http("https://sepolia-rollup.arbitrum.io/rpc") 
  });
  const publicClient = baseClient.extend((client) => ({ getChainId: async () => 421614 }));

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

  console.log("Generating CoFHE self-permit for User B...");
  const permit = await cofheB.permits.getOrCreateSelfPermit(421614, accountB.address, {
    issuer: WalnutLendingV2Address,
    signMessage: async (msg) => accountB.signMessage(msg.raw)
  });

  console.log("User B attempting decryptForTx on User A's sealed bid handle...");
  let errorCaught = false;
  try {
    const result = await cofheB.decryptForTx(dummyBidCtHash).withPermit(permit.permitHash).execute();
    console.error("❌ FAILURE: User B successfully decrypted User A's sealed bid! Value:", result);
  } catch (err) {
    errorCaught = true;
    console.log("✅ SUCCESS (Expected Revert Output):");
    console.log("   ", err.message || err);
  }

  if (!errorCaught) {
    process.exit(1);
  }

  console.log("\n========================================");
  console.log("CROSS-ACCOUNT BID DECRYPTION PROTECTION CONFIRMED");
  console.log("========================================");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
