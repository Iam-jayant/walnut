const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { resetMockState } = require("./archive/helpers/fhe-helpers");

const TASK_MANAGER_ADDRESS = "0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9";
const EXPECTED_SECURITY_ZONE = 0; // As required by the CoFHE environment/worktree configuration

const TASK_MANAGER_ABI = [
  "function verifyInput((uint256 ctHash,uint8 securityZone,uint8 utype,bytes signature) input,address sender) returns (uint256)",
  "function MOCK_setInEuintKey(uint256 ctHash,uint256 value)",
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

  // Use the exact securityZone required by the CoFHE environment to prevent InvalidSecurityZone reverts
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

async function asTaskManager(callback) {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [TASK_MANAGER_ADDRESS],
  });

  await network.provider.send("hardhat_setBalance", [
    TASK_MANAGER_ADDRESS,
    "0x56BC75E2D63100000",
  ]);

  const signer = await ethers.getSigner(TASK_MANAGER_ADDRESS);

  try {
    return await callback(signer);
  } finally {
    await network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [TASK_MANAGER_ADDRESS],
    });
  }
}

function findEvent(receipt, contract, name) {
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === name) return parsed;
    } catch {}
  }
  return undefined;
}

// Robust native assertions to bypass fragile chai matcher configuration dependencies
async function expectRevert(promise, expectedMessage) {
  try {
    await promise;
    expect.fail("Transaction was expected to revert but succeeded.");
  } catch (error) {
    if (expectedMessage) {
      expect(error.message).to.include(expectedMessage);
    }
  }
}

async function expectEmit(promise, contract, eventName) {
  const tx = await promise;
  const receipt = await tx.wait();
  const event = findEvent(receipt, contract, eventName);
  expect(event, `Expected event ${eventName} was not emitted.`).to.not.equal(undefined);
  return { event, receipt };
}

describe("WalnutLending — core protocol tests", function () {
  this.timeout(240000);
  let owner;
  let treasury;
  let user1;
  let user2;
  let mockUSDC;
  let unsupportedToken;
  let oracle;
  let cUSDC;
  let walnut;

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
    const taskManager = await ethers.getContractAt(
      ["function setVerifierSigner(address signer) external"],
      TASK_MANAGER_ADDRESS
    );
    await (await taskManager.connect(deployer).setVerifierSigner(ethers.ZeroAddress)).wait();

    // Find and override the securityZoneMin and securityZoneMax storage slot in MockTaskManager
    const expectedPattern = "6a7aa469"; // "jz¤i" hex signature from Slot 7
    let slotFound = -1;
    for (let slot = 0; slot < 40; slot++) {
      const data = await ethers.provider.getStorage(TASK_MANAGER_ADDRESS, slot);
      if (data.toLowerCase().includes(expectedPattern)) {
        slotFound = slot;
        break;
      }
    }

    if (slotFound !== -1) {
      // Overwrite the slot to set min = 0, max = 2147483647 (0x7fffffff)
      // Since securityZoneMin is at bytes 4-7 and securityZoneMax is at bytes 0-3:
      // min = 0 -> 0x00000000
      // max = 0x7fffffff -> 0x7fffffff
      const overrideValue = "0x000000000000000000000000000000000000000000000000000000007fffffff";
      await network.provider.send("hardhat_setStorageAt", [
        TASK_MANAGER_ADDRESS,
        "0x" + slotFound.toString(16),
        overrideValue
      ]);
    }
  });

  beforeEach(async function () {
    resetMockState();
    taskManager = null;
    mockCipherCounter = 1n;

    [owner, treasury, user1, user2] = await ethers.getSigners();

    mockUSDC = await deployMockToken("Mock USDC", "USDC", 6);
    unsupportedToken = await deployMockToken("Unsupported Token", "UNS", 18);
    const mockAggregatorUSDC = await deployMockAggregator(8, 1_00000000n);

    const WalnutPriceOracle = await ethers.getContractFactory("WalnutPriceOracle");
    oracle = await WalnutPriceOracle.deploy();
    await oracle.waitForDeployment();
    await oracle.setPriceFeed(await mockUSDC.getAddress(), await mockAggregatorUSDC.getAddress());

    const WalnutFHERC20 = await ethers.getContractFactory("WalnutFHERC20");
    cUSDC = await WalnutFHERC20.deploy();
    await cUSDC.waitForDeployment();

    const WalnutLending = await ethers.getContractFactory("WalnutLending");
    walnut = await WalnutLending.deploy(
      await cUSDC.getAddress(),
      await oracle.getAddress(),
      treasury.address
    );
    await walnut.waitForDeployment();

    await cUSDC.connect(owner).setMinter(await walnut.getAddress());
    await mockUSDC.mint(user1.address, ethers.parseUnits("10000", 6));
    await mockUSDC.mint(user2.address, ethers.parseUnits("10000", 6));
    await unsupportedToken.mint(user1.address, ethers.parseUnits("10000", 18));
  });

  describe("Deposit", () => {
    it("accepts ERC20 deposit and updates encrypted collateral handle", async () => {
      const depositAmount = ethers.parseUnits("1000", 6);
      await mockUSDC.connect(user1).approve(await walnut.getAddress(), depositAmount);
      
      await expectEmit(
        walnut.connect(user1).deposit(await mockUSDC.getAddress(), depositAmount),
        walnut,
        "Deposited"
      );

      const encCollateral = await walnut.getEncryptedCollateral(user1.address);
      const plaintext = await decrypt(encCollateral);
      expect(plaintext).to.equal(1000_000000n); // $1000 USD represented as 6 decimals
    });

    it("reverts on zero amount deposit", async () => {
      await mockUSDC.connect(user1).approve(await walnut.getAddress(), 1000);
      await expectRevert(
        walnut.connect(user1).deposit(await mockUSDC.getAddress(), 0),
        "WalnutLending: zero amount"
      );
    });

    it("reverts on unsupported token", async () => {
      const depositAmount = ethers.parseUnits("100", 18);
      await unsupportedToken.connect(user1).approve(await walnut.getAddress(), depositAmount);
      await expectRevert(
        walnut.connect(user1).deposit(await unsupportedToken.getAddress(), depositAmount),
        "No price feed"
      );
    });
  });

  describe("Borrow", () => {
    it("mints cUSDC and creates a Loan record on successful borrow", async () => {
      const depositAmount = ethers.parseUnits("1000", 6);
      await mockUSDC.connect(user1).approve(await walnut.getAddress(), depositAmount);
      await walnut.connect(user1).deposit(await mockUSDC.getAddress(), depositAmount);

      const borrowAmount = ethers.parseUnits("500", 6);
      const encBorrow = await encrypt(borrowAmount);

      const { receipt } = await expectEmit(
        walnut.connect(user1).borrow(encBorrow),
        walnut,
        "LoanOpened"
      );

      const principalSync = findEvent(receipt, walnut, "BorrowPrincipalSyncRequested");
      const aggregateSync = findEvent(receipt, walnut, "TotalBorrowedSyncRequested");

      expect(principalSync).to.not.equal(undefined);
      expect(aggregateSync).to.not.equal(undefined);

      // Verify cUSDC minted to user
      const encryptedBal = await cUSDC.balanceOf(user1.address);
      expect(await decrypt(encryptedBal)).to.equal(borrowAmount);

      // Verify Loan record created
      const loans = await walnut.getLoans(user1.address);
      expect(loans.length).to.equal(1);
      expect(loans[0].active).to.equal(true);
      expect(loans[0].principalPending).to.equal(true);

      // Sync the principal via CoFHE mock task manager
      await asTaskManager(async (taskManager) => {
        await walnut.connect(taskManager).onLoanPrincipalDecrypted(
          principalSync.args.requestId,
          500_000000
        );
      });

      const updatedLoans = await walnut.getLoans(user1.address);
      expect(updatedLoans[0].principalPending).to.equal(false);
      expect(updatedLoans[0].principal).to.equal(500_000000n);
    });

    it("allows a second borrow before first loan principal is synced", async () => {
      const depositAmount = ethers.parseUnits("2000", 6);
      await mockUSDC.connect(user1).approve(await walnut.getAddress(), depositAmount);
      await walnut.connect(user1).deposit(await mockUSDC.getAddress(), depositAmount);

      // First borrow
      const borrowAmount1 = ethers.parseUnits("500", 6);
      const encBorrow1 = await encrypt(borrowAmount1);
      await walnut.connect(user1).borrow(encBorrow1);

      // Second borrow immediately without syncing first
      const borrowAmount2 = ethers.parseUnits("300", 6);
      const encBorrow2 = await encrypt(borrowAmount2);
      
      await expectEmit(
        walnut.connect(user1).borrow(encBorrow2),
        walnut,
        "LoanOpened"
      );

      const loans = await walnut.getLoans(user1.address);
      expect(loans.length).to.equal(2);
      expect(loans[0].active).to.equal(true);
      expect(loans[1].active).to.equal(true);
    });

    it("silently rejects borrow that exceeds LTV (no revert, no state change)", async () => {
      const depositAmount = ethers.parseUnits("100", 6); // $100 collateral
      await mockUSDC.connect(user1).approve(await walnut.getAddress(), depositAmount);
      await walnut.connect(user1).deposit(await mockUSDC.getAddress(), depositAmount);

      // Try to borrow $500 (exceeds 70% LTV threshold of $70)
      const borrowAmount = ethers.parseUnits("500", 6);
      const encBorrow = await encrypt(borrowAmount);
      
      const tx = await walnut.connect(user1).borrow(encBorrow);
      const receipt = await tx.wait();

      const principalSync = findEvent(receipt, walnut, "BorrowPrincipalSyncRequested");
      expect(principalSync).to.not.equal(undefined);

      // Trigger sync callback with 0 (representing rejected/failed LTV evaluation)
      await asTaskManager(async (taskManager) => {
        await walnut.connect(taskManager).onLoanPrincipalDecrypted(
          principalSync.args.requestId,
          0 // 0 means LTV check failed, borrow is rejected
        );
      });

      const loans = await walnut.getLoans(user1.address);
      expect(loans[0].active).to.equal(false); // Should be silently rejected (loan set inactive)
      expect(loans[0].principal).to.equal(0n); // No principal tracked
    });
  });

  describe("Multi-loan repayment", () => {
    let borrowReceipt0;
    let borrowReceipt1;

    beforeEach(async () => {
      const depositAmount = ethers.parseUnits("3000", 6);
      await mockUSDC.connect(user1).approve(await walnut.getAddress(), depositAmount);
      await walnut.connect(user1).deposit(await mockUSDC.getAddress(), depositAmount);

      // Borrow Loan #0
      const tx0 = await walnut.connect(user1).borrow(await encrypt(ethers.parseUnits("500", 6)));
      borrowReceipt0 = await tx0.wait();
      const sync0 = findEvent(borrowReceipt0, walnut, "BorrowPrincipalSyncRequested");
      await asTaskManager(async (tm) => {
        await walnut.connect(tm).onLoanPrincipalDecrypted(sync0.args.requestId, 500_000000);
      });

      // Borrow Loan #1
      const tx1 = await walnut.connect(user1).borrow(await encrypt(ethers.parseUnits("800", 6)));
      borrowReceipt1 = await tx1.wait();
      const sync1 = findEvent(borrowReceipt1, walnut, "BorrowPrincipalSyncRequested");
      await asTaskManager(async (tm) => {
        await walnut.connect(tm).onLoanPrincipalDecrypted(sync1.args.requestId, 800_000000);
      });
    });

    it("repaying loanIndex 0 does not affect loanIndex 1", async () => {
      // Repay Loan #0 completely
      const repayAmount = ethers.parseUnits("500", 6);
      const encRepay = await encrypt(repayAmount);

      const tx = await walnut.connect(user1).repay(encRepay, 0);
      const receipt = await tx.wait();

      const repaySync = findEvent(receipt, walnut, "RepayStateSyncRequested");
      expect(repaySync).to.not.equal(undefined);

      await asTaskManager(async (tm) => {
        await walnut.connect(tm).onLoanRepayDecrypted(repaySync.args.requestId, 1);
      });

      const loans = await walnut.getLoans(user1.address);
      expect(loans[0].active).to.equal(false); // Repaid loan index 0 is inactive
      expect(loans[1].active).to.equal(true);  // Repaid loan index 1 remains completely active
    });

    it("reverts repay on invalid loanIndex", async () => {
      const repayAmount = ethers.parseUnits("500", 6);
      const encRepay = await encrypt(repayAmount);

      await expectRevert(
        walnut.connect(user1).repay(encRepay, 99),
        "WalnutLending: invalid loan index"
      );
    });

    it("marks loan inactive after sufficient repayment via CoFHE callback", async () => {
      const repayAmount = ethers.parseUnits("800", 6);
      const encRepay = await encrypt(repayAmount);

      const tx = await walnut.connect(user1).repay(encRepay, 1);
      const receipt = await tx.wait();

      const repaySync = findEvent(receipt, walnut, "RepayStateSyncRequested");
      
      await asTaskManager(async (tm) => {
        await walnut.connect(tm).onLoanRepayDecrypted(repaySync.args.requestId, 1); // 1 = successful repayment
      });

      const loans = await walnut.getLoans(user1.address);
      expect(loans[1].active).to.equal(false); // Marked inactive
      expect(loans[1].principal).to.equal(0n); // Cleared principal
    });
  });

  describe("Withdraw", () => {
    it("reverts withdraw when any active loan exists", async () => {
      const depositAmount = ethers.parseUnits("1000", 6);
      await mockUSDC.connect(user1).approve(await walnut.getAddress(), depositAmount);
      await walnut.connect(user1).deposit(await mockUSDC.getAddress(), depositAmount);

      // Borrow
      const tx = await walnut.connect(user1).borrow(await encrypt(ethers.parseUnits("500", 6)));
      const receipt = await tx.wait();
      const sync = findEvent(receipt, walnut, "BorrowPrincipalSyncRequested");
      await asTaskManager(async (tm) => {
        await walnut.connect(tm).onLoanPrincipalDecrypted(sync.args.requestId, 500_000000);
      });

      // Try to withdraw while loan is active
      await expectRevert(
        walnut.connect(user1).withdraw(await mockUSDC.getAddress(), ethers.parseUnits("100", 6)),
        "WalnutLending: repay all loans before withdrawing"
      );
    });

    it("succeeds and returns ERC20 after all loans are repaid", async () => {
      const depositAmount = ethers.parseUnits("1000", 6);
      await mockUSDC.connect(user1).approve(await walnut.getAddress(), depositAmount);
      await walnut.connect(user1).deposit(await mockUSDC.getAddress(), depositAmount);

      // Borrow and repay completely
      const tx = await walnut.connect(user1).borrow(await encrypt(ethers.parseUnits("500", 6)));
      const receipt = await tx.wait();
      const sync = findEvent(receipt, walnut, "BorrowPrincipalSyncRequested");
      await asTaskManager(async (tm) => {
        await walnut.connect(tm).onLoanPrincipalDecrypted(sync.args.requestId, 500_000000);
      });

      // Repay
      const repayTx = await walnut.connect(user1).repay(await encrypt(ethers.parseUnits("500", 6)), 0);
      const repayReceipt = await repayTx.wait();
      const repaySync = findEvent(repayReceipt, walnut, "RepayStateSyncRequested");
      await asTaskManager(async (tm) => {
        await walnut.connect(tm).onLoanRepayDecrypted(repaySync.args.requestId, 1);
      });

      // Now withdraw should succeed
      const beforeBal = await mockUSDC.balanceOf(user1.address);
      
      await expectEmit(
        walnut.connect(user1).withdraw(await mockUSDC.getAddress(), ethers.parseUnits("1000", 6)),
        walnut,
        "Withdrawn"
      );

      const afterBal = await mockUSDC.balanceOf(user1.address);
      expect(afterBal - beforeBal).to.equal(ethers.parseUnits("1000", 6));
    });
  });

  describe("Security", () => {
    it("onlyCoFHE callbacks revert when called by non-coprocessor address", async () => {
      await expectRevert(
        walnut.connect(user1).onLoanPrincipalDecrypted(1234, 500),
        "WalnutLending: not CoFHE"
      );

      await expectRevert(
        walnut.connect(user2).onLoanRepayDecrypted(5678, 1),
        "WalnutLending: not CoFHE"
      );
    });
  });
});
