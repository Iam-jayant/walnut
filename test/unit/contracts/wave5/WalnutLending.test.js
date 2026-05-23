const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { encrypt, decrypt, decryptCollateral, resetMockState } = require("../../../helpers/fhe-helpers");

const TASK_MANAGER_ADDRESS = "0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9";

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

describe("WalnutLending Wave 5", function () {
  let owner;
  let treasury;
  let user1;
  let user2;
  let mockUSDC;
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

  async function syncBorrowFromReceipt(receipt) {
    const principalSync = findEvent(receipt, walnut, "BorrowPrincipalSyncRequested");
    const aggregateSync = findEvent(receipt, walnut, "TotalBorrowedSyncRequested");

    expect(principalSync, "missing BorrowPrincipalSyncRequested").to.not.equal(undefined);
    expect(aggregateSync, "missing TotalBorrowedSyncRequested").to.not.equal(undefined);

    await asTaskManager(async (taskManager) => {
      await walnut.connect(taskManager).onBorrowPrincipalDecrypted(
        principalSync.args.requestId,
        500_000000
      );
      await walnut.connect(taskManager).onTotalBorrowedDecrypted(
        aggregateSync.args.requestId,
        500_000000
      );
    });
  }

  async function openSyncedLoan() {
    const depositAmount = ethers.parseUnits("1000", 6);
    const borrowAmount = ethers.parseUnits("500", 6);

    await mockUSDC.connect(user1).approve(await walnut.getAddress(), depositAmount);
    await walnut.connect(user1).deposit(await mockUSDC.getAddress(), depositAmount);

    const borrowTx = await walnut.connect(user1).borrow(await encrypt(borrowAmount));
    const borrowReceipt = await borrowTx.wait();
    await syncBorrowFromReceipt(borrowReceipt);

    return { depositAmount, borrowAmount };
  }

  before(async function () {
    const [deployer] = await ethers.getSigners();
    const taskManager = await ethers.getContractAt(
      ["function setVerifierSigner(address signer) external"],
      TASK_MANAGER_ADDRESS
    );
    await (await taskManager.connect(deployer).setVerifierSigner(ethers.ZeroAddress)).wait();
  });

  beforeEach(async function () {
    resetMockState();

    [owner, treasury, user1, user2] = await ethers.getSigners();

    mockUSDC = await deployMockToken("Mock USDC", "USDC", 6);
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
  });

  it("tracks aggregate totals and syncs principal after borrow", async function () {
    const { borrowAmount } = await openSyncedLoan();

    expect(await walnut.totalDeposited()).to.equal(ethers.parseUnits("1000", 6));
    expect(await walnut.totalBorrowed()).to.equal(borrowAmount);
    expect(await walnut.utilizationRate()).to.equal(5000n);
    expect(await walnut.currentBorrowRate()).to.equal(900n);

    const encryptedDebt = await walnut.getEncryptedDebt(user1.address);
    expect(await decrypt(encryptedDebt)).to.equal(borrowAmount);
    expect(await decrypt(await cUSDC.balanceOf(user1.address))).to.equal(borrowAmount);
    expect(await walnut.borrowTimestamp(user1.address)).to.be.gt(0n);
  });

  it("prevents overlapping borrows while a sync is pending or a loan is active", async function () {
    const depositAmount = ethers.parseUnits("1000", 6);
    const borrowAmount = ethers.parseUnits("500", 6);

    await mockUSDC.connect(user1).approve(await walnut.getAddress(), depositAmount);
    await walnut.connect(user1).deposit(await mockUSDC.getAddress(), depositAmount);
    const borrowTx = await walnut.connect(user1).borrow(await encrypt(borrowAmount));

    // Try to borrow while sync is pending - should fail
    try {
      await walnut.connect(user1).borrow(await encrypt(ethers.parseUnits("100", 6)));
      expect.fail("Should have reverted with 'borrow sync pending'");
    } catch (error) {
      expect(error.message).to.include("WalnutLending: borrow sync pending");
    }

    await syncBorrowFromReceipt(await borrowTx.wait());

    // Try to borrow while loan is active - should fail
    try {
      await walnut.connect(user1).borrow(await encrypt(ethers.parseUnits("100", 6)));
      expect.fail("Should have reverted with 'active loan exists'");
    } catch (error) {
      expect(error.message).to.include("WalnutLending: active loan exists");
    }
  });

  it("clears protocol-owned loan state after repay and allows withdraw", async function () {
    const { borrowAmount, depositAmount } = await openSyncedLoan();

    await ethers.provider.send("evm_increaseTime", [30 * 86400]);
    await ethers.provider.send("evm_mine");

    const [totalInterest, protocolFee] = await walnut.calculateInterest(user1.address, borrowAmount);
    const repayAmount = borrowAmount + totalInterest;

    const repayTx = await walnut.connect(user1).repay(await encrypt(repayAmount));
    const repayReceipt = await repayTx.wait();

    const repaySync = findEvent(repayReceipt, walnut, "RepayStateSyncRequested");
    const aggregateSync = findEvent(repayReceipt, walnut, "TotalBorrowedSyncRequested");
    expect(repaySync).to.not.equal(undefined);
    expect(aggregateSync).to.not.equal(undefined);

    await asTaskManager(async (taskManager) => {
      await walnut.connect(taskManager).onRepayStateDecrypted(repaySync.args.requestId, 1);
      await walnut.connect(taskManager).onTotalBorrowedDecrypted(aggregateSync.args.requestId, 0);
    });

    // Verify protocol-owned state is cleared
    expect(await walnut.totalBorrowed()).to.equal(0n);
    expect(await walnut.borrowTimestamp(user1.address)).to.equal(0n);

    // Update oracle price to avoid stale price error after time advance
    const mockAggregatorUSDC = await ethers.getContractAt(
      "MockChainlinkAggregator",
      await (await oracle.priceFeeds(await mockUSDC.getAddress()))
    );
    await mockAggregatorUSDC.setPrice(1_00000000n);

    // Verify user can withdraw after repayment
    await walnut.connect(user1).withdraw(await mockUSDC.getAddress(), depositAmount);
    expect(await decryptCollateral(walnut, user1.address)).to.equal(0n);
    expect(await walnut.totalDeposited()).to.equal(0n);

    const settlementIntent = findEvent(repayReceipt, walnut, "RepaymentSettlementIntent");
    expect(settlementIntent.args.principal).to.equal(borrowAmount);
    // Allow for 1 wei rounding error in protocol fee calculation
    expect(settlementIntent.args.protocolFee).to.be.closeTo(protocolFee, 1n);
  });

  it("does not clear protocol-owned loan state after insufficient repay", async function () {
    const { borrowAmount } = await openSyncedLoan();

    const partialRepay = ethers.parseUnits("100", 6);
    const repayTx = await walnut.connect(user1).repay(await encrypt(partialRepay));
    const repayReceipt = await repayTx.wait();
    const repaySync = findEvent(repayReceipt, walnut, "RepayStateSyncRequested");
    const aggregateSync = findEvent(repayReceipt, walnut, "TotalBorrowedSyncRequested");

    await asTaskManager(async (taskManager) => {
      await walnut.connect(taskManager).onRepayStateDecrypted(repaySync.args.requestId, 0);
      await walnut.connect(taskManager).onTotalBorrowedDecrypted(aggregateSync.args.requestId, borrowAmount);
    });

    expect(await walnut.totalBorrowed()).to.equal(borrowAmount);
    expect(await walnut.borrowTimestamp(user1.address)).to.be.gt(0n);
    
    // Try to withdraw - should fail
    try {
      await walnut.connect(user1).withdraw(await mockUSDC.getAddress(), ethers.parseUnits("100", 6));
      expect.fail("Should have reverted with 'repay loan before withdrawing'");
    } catch (error) {
      expect(error.message).to.include("WalnutLending: repay loan before withdrawing");
    }
  });

  it("restricts callback entrypoints to the CoFHE task manager", async function () {
    // Try to call onTotalBorrowedDecrypted from non-CoFHE address - should fail
    try {
      await walnut.connect(user1).onTotalBorrowedDecrypted(1, 1);
      expect.fail("Should have reverted with 'not CoFHE'");
    } catch (error) {
      expect(error.message).to.include("WalnutLending: not CoFHE");
    }

    // Try to call onBorrowPrincipalDecrypted from non-CoFHE address - should fail
    try {
      await walnut.connect(user1).onBorrowPrincipalDecrypted(1, 1);
      expect.fail("Should have reverted with 'not CoFHE'");
    } catch (error) {
      expect(error.message).to.include("WalnutLending: not CoFHE");
    }
  });

  it("allows user to borrow again after full repayment clears loan state", async function () {
    // First loan cycle
    const { borrowAmount, depositAmount } = await openSyncedLoan();
    
    // Verify loan is active
    expect(await walnut.borrowTimestamp(user1.address)).to.be.gt(0n);
    
    // Repay the loan
    await ethers.provider.send("evm_increaseTime", [30 * 86400]);
    await ethers.provider.send("evm_mine");
    
    const [totalInterest] = await walnut.calculateInterest(user1.address, borrowAmount);
    const repayAmount = borrowAmount + totalInterest;
    
    const repayTx = await walnut.connect(user1).repay(await encrypt(repayAmount));
    const repayReceipt = await repayTx.wait();
    
    const repaySync = findEvent(repayReceipt, walnut, "RepayStateSyncRequested");
    const aggregateSync = findEvent(repayReceipt, walnut, "TotalBorrowedSyncRequested");
    
    await asTaskManager(async (taskManager) => {
      await walnut.connect(taskManager).onRepayStateDecrypted(repaySync.args.requestId, 1);
      await walnut.connect(taskManager).onTotalBorrowedDecrypted(aggregateSync.args.requestId, 0);
    });
    
    // Verify protocol-owned loan state is cleared
    expect(await walnut.borrowTimestamp(user1.address)).to.equal(0n);
    
    // Second loan cycle - should succeed
    const secondBorrowAmount = ethers.parseUnits("300", 6);
    const secondBorrowTx = await walnut.connect(user1).borrow(await encrypt(secondBorrowAmount));
    const secondBorrowReceipt = await secondBorrowTx.wait();
    
    // Sync the second borrow
    await syncBorrowFromReceipt(secondBorrowReceipt);
    
    // Verify second loan is active
    expect(await walnut.borrowTimestamp(user1.address)).to.be.gt(0n);
  });

  it("does not set borrowTimestamp when borrow fails due to insufficient collateral", async function () {
    const depositAmount = ethers.parseUnits("100", 6); // Small deposit
    const borrowAmount = ethers.parseUnits("500", 6); // Try to borrow more than allowed
    
    await mockUSDC.connect(user1).approve(await walnut.getAddress(), depositAmount);
    await walnut.connect(user1).deposit(await mockUSDC.getAddress(), depositAmount);
    
    // Attempt to borrow beyond LTV limit
    const borrowTx = await walnut.connect(user1).borrow(await encrypt(borrowAmount));
    const borrowReceipt = await borrowTx.wait();
    
    const principalSync = findEvent(borrowReceipt, walnut, "BorrowPrincipalSyncRequested");
    const aggregateSync = findEvent(borrowReceipt, walnut, "TotalBorrowedSyncRequested");
    
    // Sync with 0 (borrow failed due to LTV check)
    await asTaskManager(async (taskManager) => {
      await walnut.connect(taskManager).onBorrowPrincipalDecrypted(
        principalSync.args.requestId,
        0 // Failed borrow returns 0
      );
      await walnut.connect(taskManager).onTotalBorrowedDecrypted(
        aggregateSync.args.requestId,
        0
      );
    });
    
    // Verify borrowTimestamp was NOT set (remains 0)
    expect(await walnut.borrowTimestamp(user1.address)).to.equal(0n);
    expect(await decrypt(await walnut.getEncryptedDebt(user1.address))).to.equal(0n);
    
    // User should be able to try borrowing again (no active loan)
    const validBorrowAmount = ethers.parseUnits("50", 6);
    const secondBorrowTx = await walnut.connect(user1).borrow(await encrypt(validBorrowAmount));
    const secondBorrowReceipt = await secondBorrowTx.wait();
    
    const secondPrincipalSync = findEvent(secondBorrowReceipt, walnut, "BorrowPrincipalSyncRequested");
    const secondAggregateSync = findEvent(secondBorrowReceipt, walnut, "TotalBorrowedSyncRequested");
    
    await asTaskManager(async (taskManager) => {
      await walnut.connect(taskManager).onBorrowPrincipalDecrypted(
        secondPrincipalSync.args.requestId,
        validBorrowAmount
      );
      await walnut.connect(taskManager).onTotalBorrowedDecrypted(
        secondAggregateSync.args.requestId,
        validBorrowAmount
      );
    });
    
    // Now borrowTimestamp should be set
    expect(await walnut.borrowTimestamp(user1.address)).to.be.gt(0n);
  });

  it("prevents multiple borrows from corrupting timestamp", async function () {
    const { borrowAmount } = await openSyncedLoan();
    
    const initialTimestamp = await walnut.borrowTimestamp(user1.address);
    expect(initialTimestamp).to.be.gt(0n);
    
    // Advance time
    await ethers.provider.send("evm_increaseTime", [10 * 86400]); // 10 days
    await ethers.provider.send("evm_mine");
    
    // Attempt second borrow should fail
    try {
      await walnut.connect(user1).borrow(await encrypt(ethers.parseUnits("100", 6)));
      expect.fail("Should have reverted with 'active loan exists'");
    } catch (error) {
      expect(error.message).to.include("WalnutLending: active loan exists");
    }
    
    // Verify timestamp was not corrupted
    expect(await walnut.borrowTimestamp(user1.address)).to.equal(initialTimestamp);
  });
});
