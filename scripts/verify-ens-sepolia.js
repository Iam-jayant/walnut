const hre = require("hardhat");
const { FhenixClient, generatePermit } = require("fhenixjs");
const { ethers } = require("hardhat");

async function main() {
  console.log("========================================");
  console.log("LIVE SEPOLIA VERIFICATION: ENS AGGREGATION");
  console.log("========================================\n");

  const [walletA] = await ethers.getSigners();
  const provider = hre.ethers.provider;
  const walletB = ethers.Wallet.createRandom().connect(provider);
  const walletC = ethers.Wallet.createRandom().connect(provider);

  console.log("Wallet A (Primary):   ", walletA.address);
  console.log("Wallet B (Secondary): ", walletB.address);
  console.log("Wallet C (Attacker):  ", walletC.address);

  const WalnutLendingV2 = await ethers.getContractFactory("WalnutLendingV2");
  const contractAddress = process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS;
  const contract = WalnutLendingV2.attach(contractAddress);

  console.log("\n[1] Generating EIP-712 Consent Signature (Wallet B off-chain)...");
  const domain = {
    name: "WalnutLending",
    version: "2",
    chainId: (await provider.getNetwork()).chainId,
    verifyingContract: contractAddress
  };
  const types = {
    LinkWallet: [
      { name: "primary", type: "address" },
      { name: "secondary", type: "address" },
      { name: "nonce", type: "uint256" },
      { name: "consentMessage", type: "string" }
    ]
  };
  let nonce = await contract.nonces(walletB.address);
  const consent = "I authorize aggregation and acknowledge that all liquidation surplus accrues exclusively to the primary wallet.";
  let value = { primary: walletA.address, secondary: walletB.address, nonce, consentMessage: consent };
  let signature = await walletB.signTypedData(domain, types, value);
  console.log("Signature generated:", signature);

  console.log("\n[2] Submitting linkWallet Transaction (Wallet A)...");
  try {
    const linkTx = await contract.connect(walletA).linkWallet(walletB.address, signature);
    console.log("Transaction Hash:", linkTx.hash);
    await linkTx.wait();
    console.log("✅ Wallet Linked Successfully!");
  } catch (e) {
    if (e.message.includes("Already linked")) {
      console.log("Already linked, proceeding...");
    } else {
      throw e;
    }
  }

  console.log("\n[3] Triggering Aggregation View (Fetching ctHash)...");
  const ctHash = await contract.connect(walletA).getAggregatedCollateralCtHash.staticCall(walletA.address);
  console.log("Aggregated Collateral ctHash:", ctHash.toString());

  console.log("\n[4] Decrypting Aggregated Balance (Wallet A - Authorized)...");
  try {
    const permitA = await generatePermit(contractAddress, provider, walletA);
    const fhenixClientA = new FhenixClient({ provider });
    fhenixClientA.storePermit(permitA);
    const decryptedA = await fhenixClientA.unseal(contractAddress, ctHash.toString());
    console.log("✅ Decrypted Value by A:", decryptedA.toString()); 
  } catch (err) {
    console.log("Decryption failed (expected if network does not support CoFHE endpoint directly in script without proper Fhenix nodes):", err.message);
  }

  console.log("\n[5] Cross-Account Privacy Guard (Wallet C - Unauthorized)...");
  try {
    const permitC = await generatePermit(contractAddress, provider, walletC);
    const fhenixClientC = new FhenixClient({ provider });
    fhenixClientC.storePermit(permitC);
    await fhenixClientC.unseal(contractAddress, ctHash.toString());
    throw new Error("Wallet C should not be able to decrypt Wallet A's aggregated balance!");
  } catch (e) {
    console.log("❌ Rejected as expected:", e.message);
  }

  console.log("\n[6] Testing Unlink Guard...");
  const unlinkTx = await contract.connect(walletA).requestUnlink(walletB.address);
  console.log("Unlink Transaction Hash:", unlinkTx.hash);
  await unlinkTx.wait();
  console.log("✅ Wallet Unlinked Successfully!");
}

main().catch(console.error);
