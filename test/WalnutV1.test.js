const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const {
  encrypt,
  decrypt,
  decryptCollateral,
  decryptDebt,
  decryptAggregatedCollateral,
} = require("./helpers/fhe-helpers");

const TASK_MANAGER_ADDRESS = "0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9";

function findEvent(receipt, eventName) {
  return receipt.logs.find((log) => log.fragment && log.fragment.name === eventName);
}

async function increaseTime(seconds) {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine");
}

async function expectRevertWith(txPromise, expectedMessage) {
  let didRevert = false;

  try {
    await txPromise;
  } catch (error) {
    didRevert = true;
    expect(String(error.message)).to.include(expectedMessage);
  }

  expect(didRevert).to.equal(true);
}

async function asTaskManager(callback) {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [TASK_MANAGER_ADDRESS],
  });

  await network.provider.send("hardhat_setBalance", [
    TASK_MANAGER_ADDRESS,
    "0x56BC75E2D63100000", // 100 ETH
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

describe("WalnutV1", function () {
  let contract;
  let owner;
  let borrower;
  let lender;
  let bidder1;
  let bidder2;

  beforeEach(async function () {
    [owner, borrower, lender, bidder1, bidder2] = await ethers.getSigners();

    const taskManager = await ethers.getContractAt(
      ["function setVerifierSigner(address signer) external"],
      TASK_MANAGER_ADDRESS
    );
    await (await taskManager.connect(owner).setVerifierSigner(ethers.ZeroAddress)).wait();

    const WalnutV1 = await ethers.getContractFactory("WalnutV1");
    contract = await WalnutV1.deploy();
    await contract.waitForDeployment();
  });

  async function markBorrowerLiquidatable(userSigner) {
    await (await contract.connect(userSigner).deposit(await encrypt(1000n))).wait();
    await (await contract.connect(userSigner).borrow(await encrypt(700n))).wait();
    await (await contract.connect(userSigner).withdraw(await encrypt(350n))).wait();

    const requestTx = await contract.connect(owner).requestLiquidationCheck(userSigner.address);
    const requestReceipt = await requestTx.wait();
    const requestEvent = findEvent(requestReceipt, "LiquidationCheckRequested");

    expect(requestEvent).to.not.equal(undefined);

    const reqId = requestEvent.args.requestId;

    await asTaskManager(async (taskManagerSigner) => {
      await (
        await contract.connect(taskManagerSigner).onLiquidationResult(reqId, 10000)
      ).wait();
    });

    expect(await contract.liquidatable(userSigner.address)).to.equal(true);

    return reqId;
  }

  it("Task 1: keeps lending loop and encrypted pool counters correct", async function () {
    await (await contract.connect(borrower).deposit(await encrypt(1000n))).wait();
    await (await contract.connect(borrower).borrow(await encrypt(700n))).wait();
    await (await contract.connect(borrower).repay(await encrypt(200n))).wait();
    await (await contract.connect(borrower).withdraw(await encrypt(100n))).wait();

    const userCollateral = await decryptCollateral(contract, borrower.address);
    const userDebt = await decryptDebt(contract, borrower.address);

    const poolCollateral = await decrypt(await contract.getEncryptedTotalPoolCollateral());
    const poolDebt = await decrypt(await contract.getEncryptedTotalPoolDebt());

    expect(userCollateral).to.equal(900n);
    expect(userDebt).to.equal(500n);
    expect(poolCollateral).to.equal(900n);
    expect(poolDebt).to.equal(500n);
  });

  it("Task 2: enforces onlyCoFHE on all callbacks", async function () {
    await expectRevertWith(
      contract.connect(owner).onLiquidationResult(1, 10000),
      "Only CoFHE coprocessor"
    );

    await expectRevertWith(
      contract.connect(owner).onWinnerSelected(1, 0),
      "Only CoFHE coprocessor"
    );

    await expectRevertWith(
      contract.connect(owner).onCreditCountDecrypted(1, 3),
      "Only CoFHE coprocessor"
    );
  });

  it("Task 3: requestLiquidationCheck -> callback marks user liquidatable and clears request", async function () {
    await (await contract.connect(borrower).deposit(await encrypt(1000n))).wait();
    await (await contract.connect(borrower).borrow(await encrypt(700n))).wait();
    await (await contract.connect(borrower).withdraw(await encrypt(350n))).wait();

    const requestTx = await contract.connect(owner).requestLiquidationCheck(borrower.address);
    const requestReceipt = await requestTx.wait();
    const requestEvent = findEvent(requestReceipt, "LiquidationCheckRequested");

    expect(requestEvent).to.not.equal(undefined);
    const reqId = requestEvent.args.requestId;

    await asTaskManager(async (taskManagerSigner) => {
      const tx = await contract.connect(taskManagerSigner).onLiquidationResult(reqId, 10000);
      const receipt = await tx.wait();
      const liquidationEvent = findEvent(receipt, "LiquidationTriggered");
      expect(liquidationEvent).to.not.equal(undefined);
      expect(liquidationEvent.args.user).to.equal(borrower.address);
    });

    expect(await contract.liquidatable(borrower.address)).to.equal(true);

    await asTaskManager(async (taskManagerSigner) => {
      await expectRevertWith(
        contract.connect(taskManagerSigner).onLiquidationResult(reqId, 10000),
        "No pending check"
      );
    });

    const defaultCount = await decrypt(await contract.getEncryptedDefaultCount(borrower.address));
    expect(defaultCount).to.equal(1n);
  });

  it("Task 4: auction flow settles winner through callback", async function () {
    await markBorrowerLiquidatable(borrower);

    await (await contract.connect(owner).openAuction(borrower.address)).wait();
    await (await contract.connect(bidder1).submitBid(borrower.address, await encrypt(80n))).wait();
    await (await contract.connect(bidder2).submitBid(borrower.address, await encrypt(10n))).wait();

    const bidWindow = await contract.BID_WINDOW();
    await increaseTime(Number(bidWindow) + 1);

    const selectionTx = await contract.connect(owner).selectWinningBid(borrower.address);
    const selectionReceipt = await selectionTx.wait();
    const selectionEvent = findEvent(selectionReceipt, "SelectionRequested");

    expect(selectionEvent).to.not.equal(undefined);
    const reqId = selectionEvent.args.requestId;

    await asTaskManager(async (taskManagerSigner) => {
      const tx = await contract.connect(taskManagerSigner).onWinnerSelected(reqId, 1);
      const receipt = await tx.wait();
      const settledEvent = findEvent(receipt, "AuctionSettled");

      expect(settledEvent).to.not.equal(undefined);
      expect(settledEvent.args.borrower).to.equal(borrower.address);
      expect(settledEvent.args.winner).to.equal(bidder2.address);
    });

    const summary = await contract.getAuctionSummary(borrower.address);
    expect(summary.settled).to.equal(true);
    expect(await contract.liquidatable(borrower.address)).to.equal(false);
    expect(await contract.getPendingWinnerRequestId(borrower.address)).to.equal(0n);
  });

  it("Task 5: credit tier callback updates tiers and affects dynamic LTV", async function () {
    await (await contract.connect(borrower).deposit(await encrypt(2000n))).wait();
    await (await contract.connect(borrower).borrow(await encrypt(700n))).wait();

    for (let i = 0; i < 10; i++) {
      await (await contract.connect(borrower).repay(await encrypt(70n))).wait();
    }

    const tierRequestTx = await contract.connect(owner).requestCreditTierUpdate(borrower.address);
    const tierRequestReceipt = await tierRequestTx.wait();
    const tierRequestEvent = findEvent(tierRequestReceipt, "CreditTierUpdateRequested");

    expect(tierRequestEvent).to.not.equal(undefined);
    const tierReqId = tierRequestEvent.args.requestId;

    await asTaskManager(async (taskManagerSigner) => {
      await (
        await contract.connect(taskManagerSigner).onCreditCountDecrypted(tierReqId, 10)
      ).wait();
    });

    expect(await contract.creditTier(borrower.address)).to.equal(4n);
    expect(await contract.TIER_LTV(0)).to.equal(7000n);
    expect(await contract.TIER_LTV(4)).to.equal(9000n);

    await (await contract.connect(lender).deposit(await encrypt(1000n))).wait();
    await (await contract.connect(lender).borrow(await encrypt(800n))).wait();
    const lenderDebt = await decryptDebt(contract, lender.address);
    expect(lenderDebt).to.equal(0n);

    await (await contract.connect(borrower).borrow(await encrypt(1800n))).wait();
    const borrowerDebt = await decryptDebt(contract, borrower.address);
    expect(borrowerDebt).to.equal(1800n);
  });

  it("Task 6: P2P offer lifecycle works with encrypted terms", async function () {
    const postTx = await contract
      .connect(lender)
      .postOffer(await encrypt(12n), await encrypt(1000n), await encrypt(30n));
    await postTx.wait();

    let meta = await contract.getOfferMeta(0n);
    expect(meta.lender).to.equal(lender.address);
    expect(meta.active).to.equal(true);
    expect(meta.matchedBorrower).to.equal(ethers.ZeroAddress);

    const aprHandle = await contract.getEncryptedOfferAPR(0n);
    expect(aprHandle.ctHash).to.not.equal(0n);

    await expectRevertWith(contract.connect(lender).matchOffer(0n), "Lender cannot self-match");

    await (await contract.connect(borrower).matchOffer(0n)).wait();

    meta = await contract.getOfferMeta(0n);
    expect(meta.active).to.equal(false);
    expect(meta.matchedBorrower).to.equal(borrower.address);

    await expectRevertWith(contract.connect(bidder1).matchOffer(0n), "Offer not active");
  });

  it("Task 7: ENS aggregation handles strict checks and aggregates collateral", async function () {
    await expectRevertWith(
      contract.connect(borrower).registerENSWallet("borrower.eth", ethers.ZeroAddress),
      "Invalid wallet"
    );

    await expectRevertWith(
      contract.connect(borrower).registerENSWallet("borrower.eth", borrower.address),
      "Cannot link self"
    );

    await expectRevertWith(
      contract.connect(borrower).registerENSWallet("", lender.address),
      "ENS name required"
    );

    await (await contract.connect(borrower).deposit(await encrypt(1000n))).wait();
    await (await contract.connect(lender).deposit(await encrypt(350n))).wait();

    await (await contract.connect(borrower).registerENSWallet("borrower.eth", lender.address)).wait();

    const aggregated = await decryptAggregatedCollateral(contract.connect(owner), borrower.address);
    expect(aggregated).to.equal(1350n);

    const linkedWallets = await contract.getLinkedWallets(borrower.address);
    expect(linkedWallets.length).to.equal(1);
    expect(linkedWallets[0]).to.equal(lender.address);

    await expectRevertWith(
      contract.connect(borrower).registerENSWallet("borrower.eth", lender.address),
      "Wallet already linked"
    );
  });

  it("Task 8: pause/unpause gates deposit and borrow", async function () {
    await expectRevertWith(contract.connect(borrower).pause(), "Only owner");

    await (await contract.connect(owner).pause()).wait();

    await expectRevertWith(contract.connect(borrower).deposit(await encrypt(100n)), "Protocol paused");

    await expectRevertWith(contract.connect(borrower).borrow(await encrypt(50n)), "Protocol paused");

    await (await contract.connect(owner).unpause()).wait();

    await (await contract.connect(borrower).deposit(await encrypt(100n))).wait();
    const collateral = await decryptCollateral(contract, borrower.address);
    expect(collateral).to.equal(100n);
  });
});
