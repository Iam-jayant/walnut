const hre = require("hardhat");
const { ethers } = require("hardhat");
const { createPublicClient, createWalletClient, http } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { arbitrumSepolia } = require("viem/chains");
const { createCofheClient, createCofheConfig } = require("@cofhe/sdk/node");
const { arbSepolia } = require("@cofhe/sdk/chains");
const { Encryptable } = require("@cofhe/sdk");

function formatInput(ct) {
  let hash = ct.ct_hash || ct.ctHash || "0x0";
  if (typeof hash === "bigint" || typeof hash === "number") {
    hash = "0x" + BigInt(hash).toString(16).padStart(64, "0");
  } else if (typeof hash === "string" && !hash.startsWith("0x")) {
    hash = "0x" + hash.padStart(64, "0");
  } else if (typeof hash === "string" && hash.startsWith("0x")) {
    hash = "0x" + hash.slice(2).padStart(64, "0");
  }
  return {
    ctHash: hash,
    securityZone: ct.security_zone !== undefined ? ct.security_zone : (ct.securityZone !== undefined ? ct.securityZone : 0),
    utype: ct.utype !== undefined ? ct.utype : 0,
    signature: ct.signature || "0x",
  };
}

async function main() {
  console.log("=======================================================================");
  console.log("EXECUTING CANONICAL LIFECYCLE ON NEW PATCHED DEPLOYMENT (Arbitrum Sepolia)");
  console.log("=======================================================================\n");

  const [primaryUser] = await ethers.getSigners();
  const secondaryUser = ethers.Wallet.createRandom().connect(ethers.provider);

  console.log("Primary Wallet:   ", primaryUser.address);
  console.log("Secondary Wallet: ", secondaryUser.address);

  // Fund secondary wallet for gas
  const fundTx = await primaryUser.sendTransaction({
    to: secondaryUser.address,
    value: ethers.parseEther("0.005"),
  });
  await fundTx.wait();
  console.log("✅ Funded Secondary Wallet Tx Hash:", fundTx.hash);

  const rpcUrl = "https://sepolia-rollup.arbitrum.io/rpc";
  const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(rpcUrl) });
  const cofheConfig = createCofheConfig({
    environment: "node",
    supportedChains: [arbSepolia],
    useWorker: false,
  });

  const pk1 = process.env.PRIVATE_KEY;
  const account1 = privateKeyToAccount(pk1.startsWith("0x") ? pk1 : `0x${pk1}`);
  const walletClient1 = createWalletClient({ account: account1, chain: arbitrumSepolia, transport: http(rpcUrl) });

  const cofheClientPrimary = createCofheClient(cofheConfig);
  cofheClientPrimary.config.useWorker = false;
  await cofheClientPrimary.connect(publicClient, walletClient1);

  const account2 = privateKeyToAccount(secondaryUser.privateKey);
  const walletClient2 = createWalletClient({ account: account2, chain: arbitrumSepolia, transport: http(rpcUrl) });

  const cofheClientSecondary = createCofheClient(cofheConfig);
  cofheClientSecondary.config.useWorker = false;
  await cofheClientSecondary.connect(publicClient, walletClient2);

  // Canonical NEW contract addresses
  const LENDING_ADDRESS = "0xdF921cF29Aae0fBf524139a4cae9289478893fDf";
  const P2P_ADDRESS = "0xFd2AbEB7fd4fe91fc78ddD54dB13f7762a17A88E";
  const MOCK_USDC_ADDRESS = "0x6341A12D08EE6F6fA071CF94C7C4a878ee5AF3ef";
  const WRAPPER_ADDRESS = "0x8684d325BE9B635BD72bFC2bB10bB6f354f5Cd61";
  const FHERC20_ADDRESS = "0x78136BC03b4549688C48181a26c521eb2F27F23F";

  const lending = await ethers.getContractAt("WalnutLendingV2", LENDING_ADDRESS);
  const p2p = await ethers.getContractAt("WalnutP2P", P2P_ADDRESS);
  const mockUSDC = await ethers.getContractAt(
    ["function mint(address to, uint256 amount) external", "function approve(address spender, uint256 amount) external returns (bool)"],
    MOCK_USDC_ADDRESS
  );
  const wrapper = await ethers.getContractAt(
    ["function shield(address to, uint256 amount) external returns (uint256)", "function setOperator(address operator, uint48 until) external"],
    WRAPPER_ADDRESS
  );
  const cUSDC = await ethers.getContractAt(
    ["function setMinter(address minter) external"],
    FHERC20_ADDRESS
  );

  // Verify Oracle configuration
  const oracleAddressOnChain = await lending.oracle();
  console.log("Oracle Address configured on WalnutLendingV2:", oracleAddressOnChain);
  if (oracleAddressOnChain.toLowerCase() !== "0x82e7caf958b329c47f10778e10a89b2319d67a14") {
    throw new Error("Oracle address mismatch on new deployment!");
  }

  // Ensure cUSDC minter is set to Lending contract
  let txM = await cUSDC.setMinter(LENDING_ADDRESS);
  await txM.wait();

  const depositAmount = 100n * 1000000n; // $100 wUSDC
  const borrow50 = 50n * 1000000n;       // $50 cUSDC
  const borrow79 = 79n * 1000000n;       // $79 cUSDC

  // 1. Shield $200 MockUSDC -> wUSDC
  console.log("\n--- STEP 1: SHIELD $200 USDC INTO wUSDC ---");
  let tx = await mockUSDC.mint(primaryUser.address, depositAmount * 2n);
  await tx.wait();
  tx = await mockUSDC.approve(WRAPPER_ADDRESS, depositAmount * 2n);
  await tx.wait();
  tx = await wrapper.shield(primaryUser.address, depositAmount * 2n);
  await tx.wait();
  tx = await wrapper.setOperator(LENDING_ADDRESS, 0xffffffff);
  await tx.wait();
  console.log("✅ Shielded $200 USDC to wUSDC & Operator approved.");

  // 2. Deposit $100 wUSDC Collateral against NEW WalnutLendingV2
  console.log("\n--- STEP 2: DEPOSIT $100 wUSDC COLLATERAL ---");
  const builderDep = cofheClientPrimary.encryptInputs([Encryptable.uint64(depositAmount)]);
  const [ctDep] = await builderDep.execute();
  tx = await lending.deposit(WRAPPER_ADDRESS, formatInput(ctDep));
  let rx = await tx.wait();
  console.log(`[TX HASH 1] Deposit $100 Collateral: ${rx.hash}`);

  // 3. Borrow $50 cUSDC
  console.log("\n--- STEP 3: BORROW $50 cUSDC ---");
  const builderB50 = cofheClientPrimary.encryptInputs([Encryptable.uint128(borrow50)]);
  const [ctB50] = await builderB50.execute();
  tx = await lending.borrow(formatInput(ctB50));
  rx = await tx.wait();
  console.log(`[TX HASH 2] Borrow $50 cUSDC: ${rx.hash}`);

  // 4. Failed Repay Attempt ($0 / Credit Farming Check)
  console.log("\n--- STEP 4: REPAY $0 ATTEMPT ---");
  const builderZero = cofheClientPrimary.encryptInputs([Encryptable.uint128(0n)]);
  const [ctZero] = await builderZero.execute();
  tx = await lending.repay(formatInput(ctZero), 0);
  rx = await tx.wait();
  console.log(`[TX HASH 3] Failed Repay $0 Attempt: ${rx.hash}`);

  // 5. Over-Repayment ($100 Repay against $50 Active Debt)
  console.log("\n--- STEP 5: OVER-REPAYMENT EXCEEDING DEBT TEST VECTOR ---");
  const builderOver = cofheClientPrimary.encryptInputs([Encryptable.uint128(100n * 1000000n)]);
  const [ctOver] = await builderOver.execute();
  tx = await lending.repay(formatInput(ctOver), 0);
  rx = await tx.wait();
  console.log(`[TX HASH 4] Over-Repay ($100 against $50 active loan): ${rx.hash}`);

  // 6. Borrow $79 & Health Factor Boundary Checks
  console.log("\n--- STEP 6: BORROW $79 cUSDC & HEALTH FACTOR BOUNDARY TEST ---");
  const builder79 = cofheClientPrimary.encryptInputs([Encryptable.uint128(borrow79)]);
  const [ct79] = await builder79.execute();
  tx = await lending.borrow(formatInput(ct79));
  rx = await tx.wait();
  console.log(`[TX HASH 5] Borrow $79 cUSDC: ${rx.hash}`);

  const withdraw1Amount = 1n * 1000000n;
  const builderW1 = cofheClientPrimary.encryptInputs([Encryptable.uint128(withdraw1Amount)]);
  const [ctW1] = await builderW1.execute();
  tx = await lending.withdraw(WRAPPER_ADDRESS, formatInput(ctW1));
  rx = await tx.wait();
  console.log(`[TX HASH 6] Withdraw $1.00 Collateral (Healthy/Allowed): ${rx.hash}`);

  // 7. Liquidation Check
  console.log("\n--- STEP 7: REQUEST LIQUIDATION CHECK ---");
  tx = await lending.requestLiquidationCheck(primaryUser.address);
  rx = await tx.wait();
  console.log(`[TX HASH 7] Request Liquidation Check: ${rx.hash}`);

  // 8. ENS Multi-Wallet Linking
  console.log("\n--- STEP 8: ENS MULTI-WALLET LINKING ---");
  const networkObj = await ethers.provider.getNetwork();
  const domain = { name: "WalnutLending", version: "2", chainId: networkObj.chainId, verifyingContract: LENDING_ADDRESS };
  const types = { LinkWallet: [{ name: "primary", type: "address" }, { name: "secondary", type: "address" }, { name: "nonce", type: "uint256" }, { name: "consentMessage", type: "string" }] };
  const nonce = await lending.nonces(secondaryUser.address);
  const value = { primary: primaryUser.address, secondary: secondaryUser.address, nonce: nonce, consentMessage: "I authorize aggregation and acknowledge that all liquidation surplus accrues exclusively to the primary wallet." };
  const signature = await secondaryUser.signTypedData(domain, types, value);

  tx = await lending.linkWallet(secondaryUser.address, signature);
  rx = await tx.wait();
  console.log(`[TX HASH 8] Link Wallet EIP-712: ${rx.hash}`);

  // 9. P2P Marketplace Offer Creation & Cancel on NEW WalnutP2P Contract
  console.log("\n--- STEP 9: P2P MARKETPLACE CREATE & CANCEL ON NEW WALNUTP2P CONTRACT ---");
  txM = await cUSDC.setMinter(P2P_ADDRESS);
  await txM.wait();

  const p2pOfferAmt = 20n * 1000000n;
  const p2pRate = 400n;
  const p2pDuration = 10n * 86400n;

  const builderP2P = cofheClientPrimary.encryptInputs([Encryptable.uint128(p2pOfferAmt), Encryptable.uint128(p2pRate), Encryptable.uint128(p2pDuration)]);
  const [ctP1, ctR1, ctD1] = await builderP2P.execute();

  tx = await p2p.createOffer(0, formatInput(ctP1), formatInput(ctR1), formatInput(ctD1));
  rx = await tx.wait();
  console.log(`[TX HASH 9] P2P Create LEND Offer: ${rx.hash}`);

  tx = await p2p.cancelOffer(0);
  rx = await tx.wait();
  console.log(`[TX HASH 10] P2P Cancel Offer: ${rx.hash}`);

  console.log("\n=======================================================================");
  console.log("FULL CANONICAL USER JOURNEY SUCCESSFULLY VERIFIED ON NEW DEPLOYMENT!");
  console.log("WalnutLendingV2:", LENDING_ADDRESS);
  console.log("WalnutP2P:      ", P2P_ADDRESS);
  console.log("=======================================================================\n");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
