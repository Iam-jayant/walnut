const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const TASK_MANAGER_ADDRESS = "0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9";
const EXPECTED_SECURITY_ZONE = 0;
const DUMMY_SIG_65 = "0x" + "00".repeat(65);
const BAD_SIG = "0x" + "11".repeat(65);

const TASK_MANAGER_ABI = [
  "function verifyInput((uint256 ctHash,uint8 securityZone,uint8 utype,bytes signature) input,address sender) returns (uint256)",
  "function MOCK_setInEuintKey(uint256 ctHash,uint256 value)",
  "function setVerifierSigner(address signer) external",
  "function setDecryptResultSigner(address signer) external",
  "function verifyDecryptResult(uint256 ciphertext, uint256 result, bytes calldata signature) external view"
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
    if (val.data !== undefined) val = val.data;
    else if (val.ctHash !== undefined) val = val.ctHash;
    else if (val[0] !== undefined) val = val[0];
  }
  const ctHash = BigInt(val);
  return await cofhe.mocks.getPlaintext(ctHash);
}

function toBytes32(value) {
  return "0x" + BigInt(value).toString(16).padStart(64, "0");
}

describe("WalnutLendingV2 — Sealed-Bid Liquidation Lifecycle", function () {
  this.timeout(600000); // 10 minutes for slow FHE mock operations
  let owner, treasury, borrower, bidder1, bidder2, bidder3;
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

  beforeEach(async function () {
    mockCipherCounter = 1n;
    [owner, treasury, borrower, bidder1, bidder2, bidder3] = await ethers.getSigners();

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
    walnutV2 = await WalnutLendingV2.deploy(await cUSDC.getAddress(), await oracle.getAddress(), treasury.address);
    await walnutV2.waitForDeployment();

    await cUSDC.connect(owner).setMinter(await walnutV2.getAddress());

    // Mint USDC to users
    for (const user of [borrower, bidder1, bidder2, bidder3]) {
      await mockUSDC.mint(user.address, ethers.parseUnits("10000", 6));
      await mockUSDC.connect(user).approve(await walnutV2.getAddress(), ethers.MaxUint256);
    }
  });

  it("Executes the full liquidation lifecycle correctly", async function () {
    const usdcAddr = await mockUSDC.getAddress();

    // 1. Borrower Deposits 1000 USDC
    const depAmt = 1000_000000n;
    let tx = await walnutV2.connect(borrower).deposit(usdcAddr, await encrypt(depAmt));
    let receipt = await tx.wait();
    let reqId = walnutV2.interface.parseLog(receipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "DepositSyncRequested"; } catch { return false; }
    })).args.requestId;
    await walnutV2.syncDepositTransfer(toBytes32(reqId), depAmt, DUMMY_SIG_65);

    // Borrower Borrows 500 cUSDC (Healthy, LTV = 50%)
    let borAmt = 500_000000n;
    tx = await walnutV2.connect(borrower).borrow(await encrypt(borAmt));
    receipt = await tx.wait();
    reqId = walnutV2.interface.parseLog(receipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "BorrowActiveSyncRequested"; } catch { return false; }
    })).args.requestId;
    await walnutV2.syncBorrowActive(toBytes32(reqId), borAmt, DUMMY_SIG_65);

    // 2. Check Liquidation (Should be healthy)
    tx = await walnutV2.connect(bidder1).requestLiquidationCheck(borrower.address);
    receipt = await tx.wait();
    reqId = walnutV2.interface.parseLog(receipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "LiquidationCheckRequested"; } catch { return false; }
    })).args.requestId;
    
    // Result 0 = false (Healthy)
    tx = await walnutV2.syncLiquidationCheck(toBytes32(reqId), 0, DUMMY_SIG_65);
    receipt = await tx.wait();
    let healthyEvent = receipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "LiquidationAuctionHealthy"; } catch { return false; }
    });
    expect(healthyEvent).to.not.be.undefined;

    // Borrower Borrows 350 more cUSDC (Total 850, LTV = 85% > 80% Threshold)
    borAmt = 350_000000n;
    tx = await walnutV2.connect(borrower).borrow(await encrypt(borAmt));
    receipt = await tx.wait();
    reqId = walnutV2.interface.parseLog(receipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "BorrowActiveSyncRequested"; } catch { return false; }
    })).args.requestId;
    await walnutV2.syncBorrowActive(toBytes32(reqId), borAmt, DUMMY_SIG_65);

    // 3. Position is now liquidation-eligible
    tx = await walnutV2.connect(bidder1).requestLiquidationCheck(borrower.address);
    receipt = await tx.wait();
    reqId = walnutV2.interface.parseLog(receipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "LiquidationCheckRequested"; } catch { return false; }
    })).args.requestId;
    
    // Result 1 = true (Liquidatable)
    tx = await walnutV2.syncLiquidationCheck(toBytes32(reqId), 1, DUMMY_SIG_65);
    receipt = await tx.wait();
    let openEvent = receipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "LiquidationAuctionOpened"; } catch { return false; }
    });
    expect(openEvent).to.not.be.undefined;

    // Verify Replay Reverts
    try {
      await walnutV2.syncLiquidationCheck(toBytes32(reqId), 1, DUMMY_SIG_65);
      expect.fail("Should revert");
    } catch (err) {
      expect(err.message).to.include("Unknown check");
    }

    // Mint cUSDC to bidders to use for bidding
    await cUSDC.connect(owner).setMinter(owner.address);
    await cUSDC.mint(bidder1.address, await encrypt(1000_000000n));
    await cUSDC.mint(bidder2.address, await encrypt(1000_000000n));
    await cUSDC.mint(bidder3.address, await encrypt(1000_000000n));
    await cUSDC.connect(owner).setMinter(await walnutV2.getAddress());

    // 4. Submit encrypted bids
    // Bidder 1 bids 700
    await walnutV2.connect(bidder1).submitLiquidationBid(borrower.address, await encrypt(700_000000n));
    // Bidder 2 bids 900 (Highest)
    await walnutV2.connect(bidder2).submitLiquidationBid(borrower.address, await encrypt(900_000000n));
    // Bidder 3 bids 800
    await walnutV2.connect(bidder3).submitLiquidationBid(borrower.address, await encrypt(800_000000n));

    // Borrower attempts to repay during auction -> must revert
    try {
      await walnutV2.connect(borrower).repay(await encrypt(100n), 0);
      expect.fail("Should revert");
    } catch (err) {
      expect(err.message).to.include("Active liquidation");
    }

    // Fast forward time to end auction
    await network.provider.send("evm_increaseTime", [605]);
    await network.provider.send("evm_mine");

    // 5. Select Winning Bid
    tx = await walnutV2.selectWinningBid(borrower.address);
    receipt = await tx.wait();
    reqId = walnutV2.interface.parseLog(receipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "WinnerSelectionRequested"; } catch { return false; }
    })).args.requestId;

    // Bidder 2 (index 1) is the winner. Mock CoFHE returns index 1.
    tx = await walnutV2.syncWinnerSelection(toBytes32(reqId), 1, DUMMY_SIG_65);
    receipt = await tx.wait();
    
    let settledEvent = receipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "AuctionSettled"; } catch { return false; }
    });
    expect(settledEvent).to.not.be.undefined;
    const settledArgs = walnutV2.interface.parseLog(settledEvent).args;
    expect(settledArgs.winner).to.equal(bidder2.address);

    // 6. Assert winner's decrypted result is correct (collateral transferred)
    const winnerCollateral = await decrypt(await walnutV2.getEncryptedCollateral(bidder2.address));
    expect(winnerCollateral).to.equal(1000_000000n); // Winner took all 1000 collateral

    const borrowerCollateral = await decrypt(await walnutV2.getEncryptedCollateral(borrower.address));
    expect(borrowerCollateral).to.equal(0n); // Borrower lost all collateral

    const borrowerDebt = await decrypt(await walnutV2.getEncryptedDebt(borrower.address));
    expect(borrowerDebt).to.equal(0n); // Debt was 850, bid was 900. Debt becomes 0.

    // 7. Surplus and refunds
    // Borrower should have received 50 cUSDC surplus
    const borrowerCUSDC = await cUSDC.balanceOf(borrower.address);
    expect(borrowerCUSDC).to.equal(50_000000n); // Surplus minted

    // Losers should have received refunds
    // Bidder 1 bid 700. Initial 1000. 1000 - 700 + 700 = 1000
    const b1Bal = await cUSDC.balanceOf(bidder1.address);
    expect(b1Bal).to.equal(1000_000000n);

    // Bidder 3 bid 800.
    const b3Bal = await cUSDC.balanceOf(bidder3.address);
    expect(b3Bal).to.equal(1000_000000n);

    // Bidder 2 bid 900 (won). Initial 1000. Bal = 100
    const b2Bal = await cUSDC.balanceOf(bidder2.address);
    expect(b2Bal).to.equal(100_000000n);

    // 8. Replay protection
    try {
      await walnutV2.syncWinnerSelection(toBytes32(reqId), 1, DUMMY_SIG_65);
      expect.fail("Should revert");
    } catch (err) {
      expect(err.message).to.include("Unknown winner selection");
    }
  });
});
