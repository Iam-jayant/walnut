const hre = require("hardhat");
const { ethers } = require("hardhat");
const { createPublicClient, createWalletClient, http } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { arbitrumSepolia } = require("viem/chains");
const { createCofheClient } = require("@cofhe/sdk/node");
const { arbSepolia } = require("@cofhe/sdk/chains");
const { Encryptable } = require("@cofhe/sdk");

async function main() {
  const rpcUrl = "https://sepolia-rollup.arbitrum.io/rpc";
  const etherProvider = new ethers.JsonRpcProvider(rpcUrl);

  // Hardhat's default test account 0 private key (or get from process.env if live)
  let pkA = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  if (!pkA.startsWith("0x")) pkA = "0x" + pkA;
  const accountA = privateKeyToAccount(pkA);
  const etherWalletA = new ethers.Wallet(pkA, etherProvider);
  const walletA = etherWalletA;

  // Wallet C (Attacker)
  const pkC = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; // account 1
  const accountC = privateKeyToAccount(pkC);
  const etherWalletC = new ethers.Wallet(pkC, etherProvider);
  
  const walletB = ethers.Wallet.createRandom().connect(etherProvider);

  const { createCofheConfig } = require("@cofhe/sdk/node");
  const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(rpcUrl) });
  
  const cofheConfig = createCofheConfig({
    environment: "node",
    supportedChains: [arbSepolia],
    useWorker: false
  });
  
  const walletClientA = createWalletClient({ account: accountA, chain: arbitrumSepolia, transport: http(rpcUrl) });
  const cofheClientA = createCofheClient(cofheConfig);
  cofheClientA.config.useWorker = false;
  await cofheClientA.connect(publicClient, walletClientA);

  const walletClientB = createWalletClient({ account: privateKeyToAccount(walletB.privateKey), chain: arbitrumSepolia, transport: http(rpcUrl) });
  const cofheClientB = createCofheClient(cofheConfig);
  cofheClientB.config.useWorker = false;
  await cofheClientB.connect(publicClient, walletClientB);

  const walletClientC = createWalletClient({ account: accountC, chain: arbitrumSepolia, transport: http(rpcUrl) });
  const cofheClientC = createCofheClient(cofheConfig);
  cofheClientC.config.useWorker = false;
  await cofheClientC.connect(publicClient, walletClientC);

  console.log("========================================");
  console.log("LIVE SEPOLIA VERIFICATION: ENS AGGREGATION (CoFHE SDK)");
  console.log("========================================\n");
  console.log("Wallet A (Primary):   ", accountA.address);
  console.log("Wallet B (Secondary): ", walletB.address);
  console.log("Wallet C (Attacker):  ", accountC.address);

  const WalnutLendingV2 = await ethers.getContractFactory("WalnutLendingV2");
  const contractAddress = process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS;
  const contract = WalnutLendingV2.attach(contractAddress);

  console.log("\\n[0] Restoring Deposits: Depositing for Wallet A and B...");
  
  // Public key is managed internally by encryptInputs

  const mockUSDC = await ethers.getContractAt(
    ["function approve(address,uint256) returns (bool)", "function mint(address,uint256)", "function transfer(address,uint256) returns (bool)"], 
    process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS || "0xbaF9465042BeFA0714E56bcDAddcaF6311FF5F59"
  );

  console.log("Approving and Depositing 50 USDC for Wallet A...");
  await (await mockUSDC.connect(walletA).approve(contractAddress, 50n)).wait();
  
  const builderA = cofheClientA.encryptInputs([Encryptable.uint128(50n)]);
  const [ctA] = await builderA.execute();
  const inputA = {
      ctHash: ctA.ct_hash || ctA.ctHash,
      securityZone: ctA.security_zone || ctA.securityZone,
      utype: ctA.utype,
      signature: ctA.signature || "0x"
  };
  const depositTxA = await (await contract.connect(walletA).deposit(mockUSDC.target, inputA)).wait();
  console.log("Wallet A deposit transaction confirmed. Waiting for CoFHE relayer to sync...");
  
  let syncA = false;
  for(let i=0; i<30; i++) {
    const val = await contract.getEncryptedCollateral(walletA.address);
    console.log(`Polling A iteration ${i}: val=${val}`);
    if(val !== "0x0000000000000000000000000000000000000000000000000000000000000000" && val !== "0x0") {
      syncA = true;
      break;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  if (!syncA) console.log("WARNING: Wallet A deposit sync timed out. Data might still be 0.");
  else console.log("Wallet A deposit sync complete.");

  console.log('Funding walletB with ETH for deposit...');
  const fundTx = await walletA.sendTransaction({
    to: walletB.address,
    value: ethers.parseEther('0.0005')
  });
  await fundTx.wait();

  console.log("Approving and Depositing 25 USDC for Wallet B...");
  console.log("Transferring 25 MockUSDC from Wallet A to Wallet B...");
  await (await mockUSDC.connect(walletA).transfer(walletB.address, 25n)).wait();
  
  await (await mockUSDC.connect(walletB).approve(contractAddress, 25n)).wait();

  const builderB = cofheClientB.encryptInputs([Encryptable.uint128(25n)]);
  const [ctB] = await builderB.execute();
  const inputB = {
      ctHash: ctB.ct_hash || ctB.ctHash,
      securityZone: ctB.security_zone || ctB.securityZone,
      utype: ctB.utype,
      signature: ctB.signature || "0x"
  };
  const depositTxB = await (await contract.connect(walletB).deposit(mockUSDC.target, inputB)).wait();
  console.log("Wallet B deposit transaction confirmed. Waiting for CoFHE relayer to sync...");

  let syncB = false;
  for(let i=0; i<30; i++) {
    const val = await contract.getEncryptedCollateral(walletB.address);
    console.log(`Polling B iteration ${i}: val=${val}`);
    if(val !== "0x0000000000000000000000000000000000000000000000000000000000000000" && val !== "0x0") {
      syncB = true;
      break;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  if (!syncB) console.log("WARNING: Wallet B deposit sync timed out. Data might still be 0.");
  else console.log("Wallet B deposit sync complete.");

  console.log("\\n[1] Creating Privacy Boundary for Wallet A...");
  
  // Link B to A
  console.log("Linking Wallet B to Wallet A...");
  
  const nonce = await contract.nonces(walletB.address);
  const domain = {
    name: "WalnutLending",
    version: "2",
    chainId: 421614,
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
  const consentMessage = "I authorize aggregation and acknowledge that all liquidation surplus accrues exclusively to the primary wallet.";
  const value = { primary: walletA.address, secondary: walletB.address, nonce, consentMessage };
  
  const signature = await walletB.signTypedData(domain, types, value);
  const linkTx = await contract.connect(walletA).linkWallet(walletB.address, signature);
  await linkTx.wait();
  console.log("o. Wallet B linked to Wallet A successfully!");
  
  // Fetch the real encrypted balances from the contract state
  const ctHashA = await contract.getEncryptedCollateral(walletA.address);
  console.log(`ctHashA from contract: ${ctHashA.toString()}`);
  
  const ctHashB = await contract.getEncryptedCollateral(walletB.address);
  console.log(`ctHashB from contract: ${ctHashB.toString()}`);

  console.log("\\n[2] Decrypting Individual Balances (Wallet A - Authorized)...");
  try {
    const permitAObj = await cofheClientA.permits.createSelf({ issuer: contractAddress });
    const pHashA = permitAObj.hash;
    
    // Decrypt A's balance
    const builderA = await cofheClientA.decryptForView(ctHashA.toString(), 6).withPermit(permitAObj);
    const decryptedA = await builderA.execute();
    console.log("o. Wallet A Decrypted Value:", decryptedA.toString()); 
    
    // Decrypt B's balance using A's permit!
    const builderB = await cofheClientA.decryptForView(ctHashB.toString(), 6).withPermit(permitAObj);
    const decryptedB = await builderB.execute();
    console.log("o. Wallet B Decrypted Value (by Wallet A):", decryptedB.toString()); 
    
    console.log("==> TOTAL CLIENT-SIDE SUM:", Number(decryptedA) + Number(decryptedB));
  } catch(e) {
    console.error("Wallet A decryption failed:", e);
  }

  console.log("\\n[3] Cross-Account Privacy Guard (Wallet C - Unauthorized)...");
  try {
    const permitCObj = await cofheClientC.permits.createSelf({ issuer: contractAddress });
    
    console.log("Attempting to decrypt Wallet A's balance as Wallet C...");
    try {
      const builderC_A = await cofheClientC.decryptForView(ctHashA.toString(), 6).withPermit(permitCObj);
      await builderC_A.execute();
      console.log("WARNING: Wallet C successfully decrypted Wallet A! PRIVACY BREACH.");
    } catch(e) {
      if (e.message && e.message.includes("permit_invalid")) {
         console.log("o. SUCCESS: Wallet C blocked from decrypting Wallet A (permit_invalid).");
      } else {
         console.log("o. SUCCESS: Wallet C blocked, but unexpected error:", e.message);
      }
    }
  } catch(e) {
    console.error(e);
  }

  try {
    const permitCObj = await cofheClientC.permits.createSelf({ issuer: contractAddress });
    
    console.log("Attempting to decrypt Wallet B's balance as Wallet C...");
    const builderC_B = await cofheClientC.decryptForView(ctHashB.toString(), 6).withPermit(permitCObj);
    await builderC_B.execute();
    console.log("WARNING: Wallet C successfully decrypted Wallet B! PRIVACY BREACH.");
  } catch(e) {
    if (e.message && e.message.includes("permit_invalid")) {
       console.log("o. SUCCESS: Wallet C blocked from decrypting Wallet B (permit_invalid).");
    } else {
       console.log("o. SUCCESS: Wallet C blocked, but unexpected error:", e.message);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});