const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const {
  encrypt,
  decryptCollateral,
  decryptDebt,
  decryptAggregatedCollateral,
  setupPosition,
} = require("./helpers/fhe-helpers");

function toBytes32(value) {
  return ethers.zeroPadValue(ethers.toBeHex(value), 32);
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

async function waitAndSubmitLiquidationCheck(contract, signer, reqId) {
  for (let i = 0; i < 12; i++) {
    try {
      await (await contract.connect(signer).submitLiquidationCheck(toBytes32(reqId))).wait();
      return;
    } catch (error) {
      if (!String(error.message).includes("Decrypt result not ready")) {
        throw error;
      }
      await increaseTime(1);
    }
  }

  throw new Error("Timed out waiting for liquidation decrypt result");
}

async function waitAndFinalizeWinnerSelection(contract, signer, reqId) {
  for (let i = 0; i < 12; i++) {
    try {
      return await (await contract.connect(signer).finalizeWinnerSelection(reqId)).wait();
    } catch (error) {
      if (!String(error.message).includes("Decrypt result not ready")) {
        throw error;
      }
      await increaseTime(1);
    }
  }

  throw new Error("Timed out waiting for winner decrypt result");
}

describe("WalnutWave2b", function () {
  let contract;
  let owner;
  let borrower;
  let bidder1;
  let bidder2;
  let extra;

  beforeEach(async function () {
    [owner, borrower, bidder1, bidder2, extra] = await ethers.getSigners();

    const WalnutWave2b = await ethers.getContractFactory("WalnutWave2b");
    contract = await WalnutWave2b.deploy();
    await contract.waitForDeployment();
  });

  async function markBorrowerLiquidatable() {
    await setupPosition(contract, borrower, 1000n, 800n);

    const withdrawAmount = await encrypt(200n);
    await (await contract.connect(borrower).withdraw(withdrawAmount)).wait();

    const requestTx = await contract.connect(owner).requestLiquidationCheck(borrower.address);
    const requestReceipt = await requestTx.wait();
    const requestEvent = requestReceipt.logs.find(
      (log) => log.fragment && log.fragment.name === "LiquidationCheckRequested"
    );

    expect(requestEvent).to.not.equal(undefined);

    const reqId = requestEvent.args.requestId;
    await waitAndSubmitLiquidationCheck(contract, owner, reqId);

    expect(await contract.liquidatable(borrower.address)).to.equal(true);
  }

  it("keeps Wave2 core flow working (deposit/borrow/repay/withdraw)", async function () {
    const depositAmount = await encrypt(1000n);
    await (await contract.connect(borrower).deposit(depositAmount)).wait();

    const borrowAmount = await encrypt(500n);
    await (await contract.connect(borrower).borrow(borrowAmount)).wait();

    const repayAmount = await encrypt(200n);
    await (await contract.connect(borrower).repay(repayAmount)).wait();

    const withdrawAmount = await encrypt(300n);
    await (await contract.connect(borrower).withdraw(withdrawAmount)).wait();

    const collateral = await decryptCollateral(contract, borrower.address);
    const debt = await decryptDebt(contract, borrower.address);

    expect(collateral).to.equal(700n);
    expect(debt).to.equal(300n);
  });

  it("opens auction only for liquidatable borrower", async function () {
    await expectRevertWith(
      contract.connect(owner).openAuction(borrower.address),
      "Borrower not liquidatable"
    );

    await markBorrowerLiquidatable();

    const tx = await contract.connect(owner).openAuction(borrower.address);
    const receipt = await tx.wait();
    const event = receipt.logs.find((log) => log.fragment && log.fragment.name === "AuctionOpened");
    expect(event).to.not.equal(undefined);

    const summary = await contract.getAuctionSummary(borrower.address);
    expect(summary.auctionBorrower).to.equal(borrower.address);
    expect(summary.active).to.equal(true);
    expect(summary.settled).to.equal(false);
  });

  it("accepts encrypted bids and rejects duplicate bidder", async function () {
    await markBorrowerLiquidatable();
    await (await contract.connect(owner).openAuction(borrower.address)).wait();

    const bid1 = await encrypt(70n);
    const bid2 = await encrypt(30n);

    const bidTx1 = await contract.connect(bidder1).submitBid(borrower.address, bid1);
    const bidReceipt1 = await bidTx1.wait();
    const bidEvent1 = bidReceipt1.logs.find(
      (log) =>
        log.fragment &&
        log.fragment.name === "BidSubmitted" &&
        log.args.borrower === borrower.address &&
        log.args.bidder === bidder1.address
    );
    expect(bidEvent1).to.not.equal(undefined);

    await (await contract.connect(bidder2).submitBid(borrower.address, bid2)).wait();

    await expectRevertWith(
      contract.connect(bidder1).submitBid(borrower.address, await encrypt(20n)),
      "Bidder already submitted"
    );

    const bidCount = await contract.getAuctionBidCount(borrower.address);
    expect(bidCount).to.equal(2n);
  });

  it("settles auction end-to-end and reveals winner address only", async function () {
    await markBorrowerLiquidatable();
    await (await contract.connect(owner).openAuction(borrower.address)).wait();

    await (await contract.connect(bidder1).submitBid(borrower.address, await encrypt(80n))).wait();
    await (await contract.connect(bidder2).submitBid(borrower.address, await encrypt(10n))).wait();

    const bidWindow = await contract.BID_WINDOW();
    await increaseTime(Number(bidWindow) + 1);

    const selectTx = await contract.connect(owner).selectWinningBid(borrower.address);
    const selectReceipt = await selectTx.wait();
    const selectEvent = selectReceipt.logs.find(
      (log) =>
        log.fragment &&
        log.fragment.name === "SelectionRequested" &&
        log.args.borrower === borrower.address
    );
    expect(selectEvent).to.not.equal(undefined);

    const reqId = await contract.getPendingWinnerRequestId(borrower.address);
    expect(reqId).to.be.greaterThan(0n);

    const finalizeReceipt = await waitAndFinalizeWinnerSelection(contract, owner, reqId);
    const settledEvent = finalizeReceipt.logs.find(
      (log) =>
        log.fragment &&
        log.fragment.name === "AuctionSettled" &&
        log.args.borrower === borrower.address &&
        log.args.winner === bidder2.address
    );
    expect(settledEvent).to.not.equal(undefined);

    const summary = await contract.getAuctionSummary(borrower.address);
    expect(summary.settled).to.equal(true);
    expect(await contract.liquidatable(borrower.address)).to.equal(false);
  });

  it("registers ENS-linked wallets with strict reverts", async function () {
    await expectRevertWith(
      contract.connect(borrower).registerENSWallet("borrower.eth", ethers.ZeroAddress),
      "Invalid wallet"
    );

    await expectRevertWith(
      contract.connect(borrower).registerENSWallet("borrower.eth", borrower.address),
      "Cannot link self"
    );

    await (await contract.connect(borrower).registerENSWallet("borrower.eth", bidder1.address)).wait();

    await expectRevertWith(
      contract.connect(borrower).registerENSWallet("borrower.eth", bidder1.address),
      "Wallet already linked"
    );

    await expectRevertWith(
      contract.connect(extra).registerENSWallet("extra.eth", bidder1.address),
      "Wallet already linked"
    );
  });

  it("decrypts aggregated collateral across linked wallets", async function () {
    await (await contract.connect(borrower).deposit(await encrypt(1000n))).wait();
    await (await contract.connect(bidder1).deposit(await encrypt(350n))).wait();

    await (await contract.connect(borrower).registerENSWallet("borrower.eth", bidder1.address)).wait();

    const aggregated = await decryptAggregatedCollateral(contract.connect(owner), borrower.address);
    expect(aggregated).to.equal(1350n);

    const linkedWallets = await contract.getLinkedWallets(borrower.address);
    const linkedWalletCount = await contract.getLinkedWalletCount(borrower.address);

    expect(linkedWalletCount).to.equal(1n);
    expect(linkedWallets[0]).to.equal(bidder1.address);
  });

  it("exposes helper views for UI without log scanning", async function () {
    await markBorrowerLiquidatable();
    await (await contract.connect(owner).openAuction(borrower.address)).wait();

    const borrowers = await contract.getAuctionBorrowers();
    expect(borrowers).to.include(borrower.address);

    const summary = await contract.getAuctionSummary(borrower.address);
    expect(summary.active).to.equal(true);
    expect(summary.bidCount).to.equal(0n);
  });
});
