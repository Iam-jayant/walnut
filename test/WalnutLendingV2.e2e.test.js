const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const TASK_MANAGER_ADDRESS = "0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9";
const EXPECTED_SECURITY_ZONE = 0;
const DUMMY_SIG_65 = "0x" + "00".repeat(65);

const TASK_MANAGER_ABI = [
  "function verifyInput((uint256 ctHash,uint8 securityZone,uint8 utype,bytes signature) input,address sender) returns (uint256)",
  "function MOCK_setInEuintKey(uint256 ctHash,uint256 value)",
  "function setVerifierSigner(address signer) external",
  "function setDecryptResultSigner(address signer) external"
];

let taskManager;
let mockCipherCounter = 1n;

async function getTaskManager() {
  if (!taskManager) {
    taskManager = await ethers.getContractAt(TASK_MANAGER_ABI, TASK_MANAGER_ADDRESS);
  }
  return taskManager;
}

async function encrypt(amount) {
  const value = typeof amount === 'bigint' ? amount : BigInt(amount);
  const manager = await getTaskManager();
  const preCtHash = mockCipherCounter << 24n;
  mockCipherCounter += 1n;

  const encryptedInput = {
    ctHash: preCtHash,
    securityZone: EXPECTED_SECURITY_ZONE,
    utype: 6,
    signature: "0x",
  };

  const [defaultSigner] = await ethers.getSigners();
  const appendedHash = await manager.verifyInput.staticCall(encryptedInput, defaultSigner.address);
  await manager.MOCK_setInEuintKey(appendedHash, value);

  return encryptedInput;
}

async function decrypt(encryptedValue) {
  const { cofhe } = require("hardhat");
  let val = encryptedValue;
  if (val && typeof val === "object") {
    if (val.data !== undefined) {
      val = val.data;
    } else if (val.ctHash !== undefined) {
      val = val.ctHash;
    } else if (val[0] !== undefined) {
      val = val[0];
    }
  }
  const ctHash = BigInt(val);
  return await cofhe.mocks.getPlaintext(ctHash);
}

function toBytes32(value) {
  const hex = BigInt(value).toString(16).padStart(64, "0");
  return "0x" + hex;
}

describe("WalnutLendingV2 — E2E Continuous Flow Test", function () {
  this.timeout(240000);
  let owner, treasury, user1;
  let mockUSDC, oracle, cUSDC, walnutV2;

  before(async function () {
    const [deployer] = await ethers.getSigners();
    const manager = await getTaskManager();
    await (await manager.connect(deployer).setVerifierSigner(ethers.ZeroAddress)).wait();
    await (await manager.connect(deployer).setDecryptResultSigner(ethers.ZeroAddress)).wait();

    const expectedPattern = "6a7aa469";
    let slotFound = -1;
    for (let slot = 0; slot < 40; slot++) {
      const data = await ethers.provider.getStorage(TASK_MANAGER_ADDRESS, slot);
      if (data.toLowerCase().includes(expectedPattern)) {
        slotFound = slot;
        break;
      }
    }

    if (slotFound !== -1) {
      const overrideValue = "0x000000000000000000000000000000000000000000000000000000007fffffff";
      await network.provider.send("hardhat_setStorageAt", [
        TASK_MANAGER_ADDRESS,
        "0x" + slotFound.toString(16),
        overrideValue
      ]);
    }
  });

  it("executes full continuous lending protocol lifecycle (deposit -> borrow -> repay -> withdraw -> credit tier)", async function () {
    [owner, treasury, user1] = await ethers.getSigners();

    // 1. Deploy contracts fresh
    const MockToken = await ethers.getContractFactory("MockERC20WithDecimals");
    mockUSDC = await MockToken.deploy("Mock USDC", "USDC", 6);
    await mockUSDC.waitForDeployment();

    const MockAggregator = await ethers.getContractFactory("MockChainlinkAggregator");
    const mockAggregatorUSDC = await MockAggregator.deploy(8, 1_00000000n);
    await mockAggregatorUSDC.waitForDeployment();

    const WalnutPriceOracle = await ethers.getContractFactory("WalnutPriceOracle");
    oracle = await WalnutPriceOracle.deploy();
    await oracle.waitForDeployment();
    await oracle.setPriceFeed(await mockUSDC.getAddress(), await mockAggregatorUSDC.getAddress());

    const WalnutFHERC20 = await ethers.getContractFactory("WalnutFHERC20");
    cUSDC = await WalnutFHERC20.deploy();
    await cUSDC.waitForDeployment();

    const WalnutLendingV2 = await ethers.getContractFactory("WalnutLendingV2");
    walnutV2 = await WalnutLendingV2.deploy(
      await cUSDC.getAddress(),
      await oracle.getAddress(),
      treasury.address
    );
    await walnutV2.waitForDeployment();

    await cUSDC.connect(owner).setMinter(await walnutV2.getAddress());
    await mockUSDC.mint(user1.address, ethers.parseUnits("10000", 6));

    const tokenAddr = await mockUSDC.getAddress();

    // 2. STEP: DEPOSIT
    console.log("--> STEP 1: DEPOSIT");
    const depositAmount = 1000_000000n; // 1000 USDC
    await mockUSDC.connect(user1).approve(await walnutV2.getAddress(), depositAmount);
    const encDeposit = await encrypt(depositAmount);

    const depTx = await walnutV2.connect(user1).deposit(tokenAddr, encDeposit);
    const depReceipt = await depTx.wait();

    const depEvent = depReceipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "Deposited"; } catch { return false; }
    });
    expect(depEvent).to.not.be.undefined;

    const depSyncEvent = depReceipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "DepositSyncRequested"; } catch { return false; }
    });
    expect(depSyncEvent).to.not.be.undefined;
    const depRequestId = walnutV2.interface.parseLog(depSyncEvent).args.requestId;

    // Simulate CoFHE decrypt callback
    const syncDepTx = await walnutV2.syncDepositTransfer(toBytes32(depRequestId), depositAmount, DUMMY_SIG_65);
    await syncDepTx.wait();

    const encCollateral = await walnutV2.getEncryptedCollateral(user1.address);
    const decCollateral = await decrypt(encCollateral);
    expect(decCollateral).to.equal(depositAmount);

    // Replay check
    try {
      await walnutV2.syncDepositTransfer(toBytes32(depRequestId), depositAmount, DUMMY_SIG_65);
      expect.fail("Replay should have reverted");
    } catch (err) {
      expect(err.message).to.include("Unknown decrypt request");
    }
    console.log("✅ DEPOSIT E2E PASSED");

    // 3. STEP: BORROW
    console.log("--> STEP 2: BORROW");
    const borrowAmount = 300_000000n; // 300 cUSDC
    const encBorrow = await encrypt(borrowAmount);

    const borTx = await walnutV2.connect(user1).borrow(encBorrow);
    const borReceipt = await borTx.wait();

    const borEvent = borReceipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "LoanOpened"; } catch { return false; }
    });
    expect(borEvent).to.not.be.undefined;

    const borSyncEvent = borReceipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "BorrowActiveSyncRequested"; } catch { return false; }
    });
    expect(borSyncEvent).to.not.be.undefined;
    const borRequestId = walnutV2.interface.parseLog(borSyncEvent).args.requestId;

    // Simulate CoFHE decrypt callback
    const syncBorTx = await walnutV2.syncBorrowActive(toBytes32(borRequestId), borrowAmount, DUMMY_SIG_65);
    await syncBorTx.wait();

    const loans = await walnutV2.connect(user1).getLoans();
    expect(loans.length).to.equal(1);
    expect(loans[0].principalPending).to.be.false;
    expect(loans[0].active).to.be.true;

    // Replay check
    try {
      await walnutV2.syncBorrowActive(toBytes32(borRequestId), borrowAmount, DUMMY_SIG_65);
      expect.fail("Replay should have reverted");
    } catch (err) {
      expect(err.message).to.include("Unknown borrow sync");
    }
    console.log("✅ BORROW E2E PASSED");

    // 4. STEP: REPAY
    console.log("--> STEP 3: REPAY");
    const repayAmount = borrowAmount;
    const encRepay = await encrypt(repayAmount);

    const repTx = await walnutV2.connect(user1).repay(encRepay, 0);
    const repReceipt = await repTx.wait();

    const repSyncEvent = repReceipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "RepayStateSyncRequested"; } catch { return false; }
    });
    expect(repSyncEvent).to.not.be.undefined;
    const repRequestId = walnutV2.interface.parseLog(repSyncEvent).args.requestId;

    // Simulate CoFHE decrypt callback
    const syncRepTx = await walnutV2.syncLoanRepay(toBytes32(repRequestId), repayAmount, DUMMY_SIG_65);
    await syncRepTx.wait();

    const updatedLoans = await walnutV2.connect(user1).getLoans();
    expect(updatedLoans[0].active).to.be.false;

    // Replay check
    try {
      await walnutV2.syncLoanRepay(toBytes32(repRequestId), repayAmount, DUMMY_SIG_65);
      expect.fail("Replay should have reverted");
    } catch (err) {
      expect(err.message).to.include("Unknown repay sync");
    }
    console.log("✅ REPAY E2E PASSED");

    // 5. STEP: WITHDRAW
    console.log("--> STEP 4: WITHDRAW");
    const withdrawAmount = 400_000000n; // 400 USDC
    const encWithdraw = await encrypt(withdrawAmount);

    const wdrTx = await walnutV2.connect(user1).withdraw(tokenAddr, encWithdraw);
    const wdrReceipt = await wdrTx.wait();

    const wdrEvent = wdrReceipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "Withdrawn"; } catch { return false; }
    });
    expect(wdrEvent).to.not.be.undefined;

    const wdrSyncEvent = wdrReceipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "WithdrawSyncRequested"; } catch { return false; }
    });
    expect(wdrSyncEvent).to.not.be.undefined;
    const wdrRequestId = walnutV2.interface.parseLog(wdrSyncEvent).args.requestId;

    // Simulate CoFHE decrypt callback
    const syncWdrTx = await walnutV2.syncWithdrawTransfer(toBytes32(wdrRequestId), withdrawAmount, DUMMY_SIG_65);
    await syncWdrTx.wait();

    // Replay check
    try {
      await walnutV2.syncWithdrawTransfer(toBytes32(wdrRequestId), withdrawAmount, DUMMY_SIG_65);
      expect.fail("Replay should have reverted");
    } catch (err) {
      expect(err.message).to.include("Unknown withdraw sync");
    }
    console.log("✅ WITHDRAW E2E PASSED");

    // 6. STEP: CREDIT TIER UPDATE
    console.log("--> STEP 5: CREDIT TIER UPDATE");
    const ctTx = await walnutV2.connect(user1).requestCreditTierUpdate(user1.address);
    const ctReceipt = await ctTx.wait();

    const ctSyncEvent = ctReceipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "CreditCountSyncRequested"; } catch { return false; }
    });
    expect(ctSyncEvent).to.not.be.undefined;
    const ctRequestId = walnutV2.interface.parseLog(ctSyncEvent).args.requestId;

    // Simulate CoFHE decrypt callback with 2 repayments -> Tier 1
    const syncCtTx = await walnutV2.syncCreditCount(toBytes32(ctRequestId), 2, DUMMY_SIG_65);
    await syncCtTx.wait();

    // Replay check
    try {
      await walnutV2.syncCreditCount(toBytes32(ctRequestId), 2, DUMMY_SIG_65);
      expect.fail("Replay should have reverted");
    } catch (err) {
      expect(err.message).to.include("Unknown credit sync");
    }
    console.log("✅ CREDIT TIER E2E PASSED");
  });
});
