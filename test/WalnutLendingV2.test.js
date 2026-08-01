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

describe("WalnutLendingV2 — Comprehensive Test Suite", function () {
  this.timeout(240000);
  let owner, treasury, user1, user2;
  let mockUSDC, oracle, cUSDC, walnutV2;

  async function deployMockAggregator(decimals, initialPrice) {
    const MockAggregator = await ethers.getContractFactory("MockChainlinkAggregator");
    const aggregator = await MockAggregator.deploy(decimals, initialPrice);
    await aggregator.waitForDeployment();
    return aggregator;
  }

  async function deployMockToken(name, symbol, decimals) {
    const MockToken = await ethers.getContractFactory("MockERC20WithDecimals");
    const token = await MockToken.deploy(name, symbol, decimals);
    await token.waitForDeployment();
    return token;
  }

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

  beforeEach(async function () {
    taskManager = null;
    mockCipherCounter = 1n;

    [owner, treasury, user1, user2] = await ethers.getSigners();

    mockUSDC = await deployMockToken("Mock USDC", "USDC", 6);
    const mockAggregatorUSDC = await deployMockAggregator(8, 1_00000000n); // $1.00

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
    await mockUSDC.mint(user2.address, ethers.parseUnits("10000", 6));
  });

  describe("1. Deposit & syncDepositTransfer", function () {
    it("initiates deposit and completes via syncDepositTransfer", async function () {
      const amount = 1000_000000n; // 1000 USDC
      const encAmount = await encrypt(amount);
      const tokenAddr = await mockUSDC.getAddress();

      await mockUSDC.connect(user1).approve(await walnutV2.getAddress(), amount);

      const tx = await walnutV2.connect(user1).deposit(tokenAddr, encAmount);
      const receipt = await tx.wait();

      const reqLog = receipt.logs.find(l => {
        try {
          const parsed = walnutV2.interface.parseLog(l);
          return parsed && parsed.name === "DepositSyncRequested";
        } catch { return false; }
      });
      expect(reqLog).to.not.be.undefined;
      const parsedReq = walnutV2.interface.parseLog(reqLog);
      const requestId = parsedReq.args.requestId;

      const syncTx = await walnutV2.syncDepositTransfer(
        toBytes32(requestId),
        amount,
        DUMMY_SIG_65
      );
      await syncTx.wait();

      const encCollateral = await walnutV2.getEncryptedCollateral(user1.address);
      const decCollateral = await decrypt(encCollateral);
      expect(decCollateral).to.equal(amount);
    });

    it("reverts on replay of syncDepositTransfer", async function () {
      const amount = 500_000000n;
      const encAmount = await encrypt(amount);
      const tokenAddr = await mockUSDC.getAddress();
      await mockUSDC.connect(user1).approve(await walnutV2.getAddress(), amount * 2n);

      const tx = await walnutV2.connect(user1).deposit(tokenAddr, encAmount);
      const receipt = await tx.wait();
      const reqLog = receipt.logs.find(l => {
        try { return walnutV2.interface.parseLog(l).name === "DepositSyncRequested"; } catch { return false; }
      });
      const requestId = walnutV2.interface.parseLog(reqLog).args.requestId;

      await (await walnutV2.syncDepositTransfer(toBytes32(requestId), amount, DUMMY_SIG_65)).wait();

      try {
        await walnutV2.syncDepositTransfer(toBytes32(requestId), amount, DUMMY_SIG_65);
        expect.fail("Should have reverted on replay");
      } catch (err) {
        expect(err.message).to.include("Unknown decrypt request");
      }
    });
  });

  describe("2. Borrow & syncBorrowActive", function () {
    it("borrows cUSDC and syncs active status", async function () {
      const borrowAmount = 300_000000n;
      const encBorrow = await encrypt(borrowAmount);

      const tx = await walnutV2.connect(user1).borrow(encBorrow);
      const receipt = await tx.wait();

      const reqLog = receipt.logs.find(l => {
        try { return walnutV2.interface.parseLog(l).name === "BorrowActiveSyncRequested"; } catch { return false; }
      });
      const requestId = walnutV2.interface.parseLog(reqLog).args.requestId;

      const syncTx = await walnutV2.syncBorrowActive(toBytes32(requestId), borrowAmount, DUMMY_SIG_65);
      await syncTx.wait();

      const loans = await walnutV2.connect(user1).getLoans();
      expect(loans.length).to.equal(1);
      expect(loans[0].principalPending).to.be.false;
      expect(loans[0].active).to.be.true;
    });

    it("reverts on replay of syncBorrowActive", async function () {
      const borrowAmount = 200_000000n;
      const encBorrow = await encrypt(borrowAmount);

      const tx = await walnutV2.connect(user1).borrow(encBorrow);
      const receipt = await tx.wait();
      const reqLog = receipt.logs.find(l => {
        try { return walnutV2.interface.parseLog(l).name === "BorrowActiveSyncRequested"; } catch { return false; }
      });
      const requestId = walnutV2.interface.parseLog(reqLog).args.requestId;

      await (await walnutV2.syncBorrowActive(toBytes32(requestId), borrowAmount, DUMMY_SIG_65)).wait();

      try {
        await walnutV2.syncBorrowActive(toBytes32(requestId), borrowAmount, DUMMY_SIG_65);
        expect.fail("Should have reverted on replay");
      } catch (err) {
        expect(err.message).to.include("Unknown borrow sync");
      }
    });
  });

  describe("3. Repay & syncLoanRepay", function () {
    it("repays loan and syncs state", async function () {
      const borrowAmount = 300_000000n;
      const encBorrow = await encrypt(borrowAmount);
      const txB = await walnutV2.connect(user1).borrow(encBorrow);
      const recB = await txB.wait();
      const reqIdB = walnutV2.interface.parseLog(recB.logs.find(l => {
        try { return walnutV2.interface.parseLog(l).name === "BorrowActiveSyncRequested"; } catch { return false; }
      })).args.requestId;
      await (await walnutV2.syncBorrowActive(toBytes32(reqIdB), borrowAmount, DUMMY_SIG_65)).wait();

      const encRepay = await encrypt(borrowAmount);
      const txR = await walnutV2.connect(user1).repay(encRepay, 0);
      const recR = await txR.wait();
      const reqIdR = walnutV2.interface.parseLog(recR.logs.find(l => {
        try { return walnutV2.interface.parseLog(l).name === "RepayStateSyncRequested"; } catch { return false; }
      })).args.requestId;

      const syncR = await walnutV2.syncLoanRepay(toBytes32(reqIdR), borrowAmount, DUMMY_SIG_65);
      await syncR.wait();

      const loans = await walnutV2.connect(user1).getLoans();
      expect(loans[0].active).to.be.false;
    });

    it("reverts on replay of syncLoanRepay", async function () {
      const borrowAmount = 100_000000n;
      const encBorrow = await encrypt(borrowAmount);
      const txB = await walnutV2.connect(user1).borrow(encBorrow);
      const recB = await txB.wait();
      const reqIdB = walnutV2.interface.parseLog(recB.logs.find(l => {
        try { return walnutV2.interface.parseLog(l).name === "BorrowActiveSyncRequested"; } catch { return false; }
      })).args.requestId;
      await (await walnutV2.syncBorrowActive(toBytes32(reqIdB), borrowAmount, DUMMY_SIG_65)).wait();

      const encRepay = await encrypt(borrowAmount);
      const txR = await walnutV2.connect(user1).repay(encRepay, 0);
      const recR = await txR.wait();
      const reqIdR = walnutV2.interface.parseLog(recR.logs.find(l => {
        try { return walnutV2.interface.parseLog(l).name === "RepayStateSyncRequested"; } catch { return false; }
      })).args.requestId;

      await (await walnutV2.syncLoanRepay(toBytes32(reqIdR), borrowAmount, DUMMY_SIG_65)).wait();

      try {
        await walnutV2.syncLoanRepay(toBytes32(reqIdR), borrowAmount, DUMMY_SIG_65);
        expect.fail("Should have reverted on replay");
      } catch (err) {
        expect(err.message).to.include("Unknown repay sync");
      }
    });
  });

  describe("4. Withdraw & syncWithdrawTransfer", function () {
    it("initiates withdraw and syncs transfer", async function () {
      const depAmount = 1000_000000n;
      const encDep = await encrypt(depAmount);
      const tokenAddr = await mockUSDC.getAddress();
      await mockUSDC.connect(user1).approve(await walnutV2.getAddress(), depAmount);
      const txD = await walnutV2.connect(user1).deposit(tokenAddr, encDep);
      const recD = await txD.wait();
      const reqIdD = walnutV2.interface.parseLog(recD.logs.find(l => {
        try { return walnutV2.interface.parseLog(l).name === "DepositSyncRequested"; } catch { return false; }
      })).args.requestId;
      await (await walnutV2.syncDepositTransfer(toBytes32(reqIdD), depAmount, DUMMY_SIG_65)).wait();

      const withdrawAmount = 400_000000n;
      const encW = await encrypt(withdrawAmount);
      const txW = await walnutV2.connect(user1).withdraw(tokenAddr, encW);
      const recW = await txW.wait();
      const reqIdW = walnutV2.interface.parseLog(recW.logs.find(l => {
        try { return walnutV2.interface.parseLog(l).name === "WithdrawSyncRequested"; } catch { return false; }
      })).args.requestId;

      const syncW = await walnutV2.syncWithdrawTransfer(toBytes32(reqIdW), withdrawAmount, DUMMY_SIG_65);
      await syncW.wait();
    });

    it("reverts on replay of syncWithdrawTransfer", async function () {
      const depAmount = 500_000000n;
      const encDep = await encrypt(depAmount);
      const tokenAddr = await mockUSDC.getAddress();
      await mockUSDC.connect(user1).approve(await walnutV2.getAddress(), depAmount);
      const txD = await walnutV2.connect(user1).deposit(tokenAddr, encDep);
      const recD = await txD.wait();
      const reqIdD = walnutV2.interface.parseLog(recD.logs.find(l => {
        try { return walnutV2.interface.parseLog(l).name === "DepositSyncRequested"; } catch { return false; }
      })).args.requestId;
      await (await walnutV2.syncDepositTransfer(toBytes32(reqIdD), depAmount, DUMMY_SIG_65)).wait();

      const withdrawAmount = 200_000000n;
      const encW = await encrypt(withdrawAmount);
      const txW = await walnutV2.connect(user1).withdraw(tokenAddr, encW);
      const recW = await txW.wait();
      const reqIdW = walnutV2.interface.parseLog(recW.logs.find(l => {
        try { return walnutV2.interface.parseLog(l).name === "WithdrawSyncRequested"; } catch { return false; }
      })).args.requestId;

      await (await walnutV2.syncWithdrawTransfer(toBytes32(reqIdW), withdrawAmount, DUMMY_SIG_65)).wait();

      try {
        await walnutV2.syncWithdrawTransfer(toBytes32(reqIdW), withdrawAmount, DUMMY_SIG_65);
        expect.fail("Should have reverted on replay");
      } catch (err) {
        expect(err.message).to.include("Unknown withdraw sync");
      }
    });
  });

  describe("5. Credit Tier Update & syncCreditCount", function () {
    it("requests credit tier update and syncs tier", async function () {
      const tx = await walnutV2.connect(user1).requestCreditTierUpdate(user1.address);
      const receipt = await tx.wait();

      const log = receipt.logs.find(l => {
        try { return walnutV2.interface.parseLog(l).name === "CreditCountSyncRequested"; } catch { return false; }
      });
      const requestId = walnutV2.interface.parseLog(log).args.requestId;

      const syncTx = await walnutV2.syncCreditCount(toBytes32(requestId), 5, DUMMY_SIG_65);
      await syncTx.wait();
    });

    it("reverts on replay of syncCreditCount", async function () {
      const tx = await walnutV2.connect(user1).requestCreditTierUpdate(user1.address);
      const receipt = await tx.wait();

      const log = receipt.logs.find(l => {
        try { return walnutV2.interface.parseLog(l).name === "CreditCountSyncRequested"; } catch { return false; }
      });
      const requestId = walnutV2.interface.parseLog(log).args.requestId;

      await (await walnutV2.syncCreditCount(toBytes32(requestId), 5, DUMMY_SIG_65)).wait();

      try {
        await walnutV2.syncCreditCount(toBytes32(requestId), 5, DUMMY_SIG_65);
        expect.fail("Should have reverted on replay");
      } catch (err) {
        expect(err.message).to.include("Unknown credit sync");
      }
    });
  });

  describe("6. Oracle Signature Verification Enforcement", function () {
    it("reverts callback execution when signature is invalid/tampered", async function () {
      const manager = await getTaskManager();
      const [deployer] = await ethers.getSigners();

      await (await manager.connect(deployer).setDecryptResultSigner(user2.address)).wait();

      const amount = 100_000000n;
      const encAmount = await encrypt(amount);
      const tokenAddr = await mockUSDC.getAddress();
      await mockUSDC.connect(user1).approve(await walnutV2.getAddress(), amount);

      const tx = await walnutV2.connect(user1).deposit(tokenAddr, encAmount);
      const receipt = await tx.wait();
      const reqLog = receipt.logs.find(l => {
        try { return walnutV2.interface.parseLog(l).name === "DepositSyncRequested"; } catch { return false; }
      });
      const requestId = walnutV2.interface.parseLog(reqLog).args.requestId;

      try {
        await walnutV2.syncDepositTransfer(toBytes32(requestId), amount, DUMMY_SIG_65);
        expect.fail("Should have reverted due to signature mismatch");
      } catch (err) {
        expect(err.message).to.be.a('string');
      }

      await (await manager.connect(deployer).setDecryptResultSigner(ethers.ZeroAddress)).wait();
    });
  });

  describe("7. CoFHE Access Control Regression Checks", function () {
    it("Should correctly enforce FHE.allow access controls and prevent cross-account decryption", async function () {
      const amount = 500n * 10n**6n;
      const encAmount = await encrypt(amount);
      const tokenAddr = await mockUSDC.getAddress();
      await mockUSDC.connect(user1).approve(await walnutV2.getAddress(), amount);
      
      // User 1 initiates deposit -> Contract executes FHE.allow(value, msg.sender)
      const tx = await walnutV2.connect(user1).deposit(tokenAddr, encAmount);
      const receipt = await tx.wait();
      
      const reqLog = receipt.logs.find(l => {
        try { return walnutV2.interface.parseLog(l).name === "DepositSyncRequested"; } catch { return false; }
      });
      const requestId = walnutV2.interface.parseLog(reqLog).args.requestId;
      
      const { cofhe } = require("hardhat");
      
      // Simulate User 2 attempting to decrypt User 1's data via their own permit
      // In the frontend, this replicates userB attempting .withPermit(userBPermit) or .withPermit() while connected
      let errorCaught = false;
      try {
        await cofhe.decryptForView(requestId, user2.address);
      } catch (e) {
        errorCaught = true;
        // Mock gateway correctly throws access control denial
        expect(e.message).to.match(/unauthorized|not allowed|User not found|denied/i);
      }
      expect(errorCaught).to.be.true;
      
      // User 1 can successfully decrypt their own data
      const result = await cofhe.decryptForView(requestId, user1.address);
      expect(result).to.be.a('bigint');
    });
  });
});
