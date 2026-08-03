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

describe("WalnutLendingV2 — Sealed-Bid Liquidation Suite", function () {
  this.timeout(1200000); // 20 minutes for FHE mock calculations across 5 tests
  let owner, treasury, borrower, bidder1, bidder2, bidder3, biddersExtra;
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
    const signers = await ethers.getSigners();
    [owner, treasury, borrower, bidder1, bidder2, bidder3] = signers;
    biddersExtra = signers.slice(6);

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
    for (const user of [borrower, bidder1, bidder2, bidder3, ...biddersExtra]) {
      await mockUSDC.mint(user.address, ethers.parseUnits("10000", 6));
      await mockUSDC.connect(user).approve(await walnutV2.getAddress(), ethers.MaxUint256);
    }
  });

  it("1. Executes the full liquidation lifecycle correctly", async function () {
    const usdcAddr = await mockUSDC.getAddress();

    // Borrower Deposits 1000 USDC & Borrows 850 cUSDC (LTV = 85% > 80% Threshold)
    let tx = await walnutV2.connect(borrower).deposit(usdcAddr, await encrypt(1000_000000n));
    let receipt = await tx.wait();
    let reqId = walnutV2.interface.parseLog(receipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "DepositSyncRequested"; } catch { return false; }
    })).args.requestId;
    await walnutV2.syncDepositTransfer(toBytes32(reqId), 1000_000000n, DUMMY_SIG_65);

    tx = await walnutV2.connect(borrower).borrow(await encrypt(850_000000n));
    receipt = await tx.wait();
    reqId = walnutV2.interface.parseLog(receipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "BorrowActiveSyncRequested"; } catch { return false; }
    })).args.requestId;
    await walnutV2.syncBorrowActive(toBytes32(reqId), 850_000000n, DUMMY_SIG_65);

    // Request Liquidation Check & Sync Liquidatable = 1
    tx = await walnutV2.connect(bidder1).requestLiquidationCheck(borrower.address);
    receipt = await tx.wait();
    reqId = walnutV2.interface.parseLog(receipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "LiquidationCheckRequested"; } catch { return false; }
    })).args.requestId;
    
    tx = await walnutV2.syncLiquidationCheck(toBytes32(reqId), 1, DUMMY_SIG_65);
    await tx.wait();

    // Mint cUSDC to bidders
    await cUSDC.connect(owner).setMinter(owner.address);
    await cUSDC.mint(bidder1.address, await encrypt(1000_000000n));
    await cUSDC.mint(bidder2.address, await encrypt(1000_000000n));
    await cUSDC.mint(bidder3.address, await encrypt(1000_000000n));
    await cUSDC.connect(owner).setMinter(await walnutV2.getAddress());

    // Submit bids: Bidder 2 bids 900 (Highest)
    await walnutV2.connect(bidder1).submitLiquidationBid(borrower.address, await encrypt(700_000000n));
    await walnutV2.connect(bidder2).submitLiquidationBid(borrower.address, await encrypt(900_000000n));
    await walnutV2.connect(bidder3).submitLiquidationBid(borrower.address, await encrypt(800_000000n));

    // Fast forward time to end auction
    await network.provider.send("evm_increaseTime", [605]);
    await network.provider.send("evm_mine");

    // Select Winner & Sync (Index 1 = Bidder 2)
    tx = await walnutV2.selectWinningBid(borrower.address);
    receipt = await tx.wait();
    reqId = walnutV2.interface.parseLog(receipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "WinnerSelectionRequested"; } catch { return false; }
    })).args.requestId;

    tx = await walnutV2.syncWinnerSelection(toBytes32(reqId), 1, DUMMY_SIG_65);
    receipt = await tx.wait();

    const winnerCollateral = await decrypt(await walnutV2.getEncryptedCollateral(bidder2.address));
    expect(winnerCollateral).to.equal(1000_000000n);
  });

  it("2. Handles zero-bid fallback when 10-minute window closes with 0 bids", async function () {
    const usdcAddr = await mockUSDC.getAddress();

    // Setup liquidatable position
    let tx = await walnutV2.connect(borrower).deposit(usdcAddr, await encrypt(1000_000000n));
    let receipt = await tx.wait();
    let reqId = walnutV2.interface.parseLog(receipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "DepositSyncRequested"; } catch { return false; }
    })).args.requestId;
    await walnutV2.syncDepositTransfer(toBytes32(reqId), 1000_000000n, DUMMY_SIG_65);

    tx = await walnutV2.connect(borrower).borrow(await encrypt(850_000000n));
    receipt = await tx.wait();
    reqId = walnutV2.interface.parseLog(receipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "BorrowActiveSyncRequested"; } catch { return false; }
    })).args.requestId;
    await walnutV2.syncBorrowActive(toBytes32(reqId), 850_000000n, DUMMY_SIG_65);

    // Open auction
    tx = await walnutV2.connect(bidder1).requestLiquidationCheck(borrower.address);
    receipt = await tx.wait();
    reqId = walnutV2.interface.parseLog(receipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "LiquidationCheckRequested"; } catch { return false; }
    })).args.requestId;
    await walnutV2.syncLiquidationCheck(toBytes32(reqId), 1, DUMMY_SIG_65);

    // Fast forward 10 minutes WITHOUT submitting any bids
    await network.provider.send("evm_increaseTime", [605]);
    await network.provider.send("evm_mine");

    // Call selectWinningBid
    tx = await walnutV2.selectWinningBid(borrower.address);
    await tx.wait();

    // Verify auction state is reset to IDLE (state is 1st return value)
    const [state, endTime] = await walnutV2.liquidations(borrower.address);
    expect(state).to.equal(0n); // IDLE state
  });

  it("3. Enforces max 10 bids cap per auction", async function () {
    const usdcAddr = await mockUSDC.getAddress();

    // Open auction
    let tx = await walnutV2.connect(borrower).deposit(usdcAddr, await encrypt(1000_000000n));
    let receipt = await tx.wait();
    let reqId = walnutV2.interface.parseLog(receipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "DepositSyncRequested"; } catch { return false; }
    })).args.requestId;
    await walnutV2.syncDepositTransfer(toBytes32(reqId), 1000_000000n, DUMMY_SIG_65);

    tx = await walnutV2.connect(borrower).borrow(await encrypt(850_000000n));
    receipt = await tx.wait();
    reqId = walnutV2.interface.parseLog(receipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "BorrowActiveSyncRequested"; } catch { return false; }
    })).args.requestId;
    await walnutV2.syncBorrowActive(toBytes32(reqId), 850_000000n, DUMMY_SIG_65);

    tx = await walnutV2.connect(bidder1).requestLiquidationCheck(borrower.address);
    receipt = await tx.wait();
    reqId = walnutV2.interface.parseLog(receipt.logs.find(l => {
      try { return walnutV2.interface.parseLog(l).name === "LiquidationCheckRequested"; } catch { return false; }
    })).args.requestId;
    await walnutV2.syncLiquidationCheck(toBytes32(reqId), 1, DUMMY_SIG_65);

    // Mint cUSDC to 10 bidders
    await cUSDC.connect(owner).setMinter(owner.address);
    const biddersList = [bidder1, bidder2, bidder3, ...biddersExtra.slice(0, 7)];
    for (const b of biddersList) {
      await cUSDC.mint(b.address, await encrypt(100_000000n));
    }
    await cUSDC.connect(owner).setMinter(await walnutV2.getAddress());

    // Submit 10 valid bids
    for (let i = 0; i < 10; i++) {
      await walnutV2.connect(biddersList[i]).submitLiquidationBid(borrower.address, await encrypt(10_000000n * BigInt(i + 1)));
    }

    // 11th bid attempt must revert with "Max bids reached"
    const bidder11 = biddersExtra[7];
    await cUSDC.connect(owner).setMinter(owner.address);
    await cUSDC.mint(bidder11.address, await encrypt(100_000000n));
    await cUSDC.connect(owner).setMinter(await walnutV2.getAddress());

    try {
      await walnutV2.connect(bidder11).submitLiquidationBid(borrower.address, await encrypt(120_000000n));
      expect.fail("11th bid should revert");
    } catch (err) {
      expect(err.message).to.include("Max bids reached");
    }
  });

  it("4. Enforces state guards on submitLiquidationBid (reverts when bidding on IDLE state)", async function () {
    // Attempting to submit a bid on a borrower with no open auction
    try {
      await walnutV2.connect(bidder1).submitLiquidationBid(borrower.address, await encrypt(500_000000n));
      expect.fail("Bid on IDLE state should revert");
    } catch (err) {
      expect(err.message).to.include("Auction not open");
    }
  });

  it("5. Rejects unauthorized / unknown requests on sync callbacks", async function () {
    // Attempting syncLiquidationCheck on bogus requestId
    const bogusReqId = toBytes32(999999);
    try {
      await walnutV2.syncLiquidationCheck(bogusReqId, 1, DUMMY_SIG_65);
      expect.fail("Unknown check should revert");
    } catch (err) {
      expect(err.message).to.include("Unknown check");
    }

    // Attempting syncWinnerSelection on bogus requestId
    try {
      await walnutV2.syncWinnerSelection(bogusReqId, 0, DUMMY_SIG_65);
      expect.fail("Unknown winner selection should revert");
    } catch (err) {
      expect(err.message).to.include("Unknown winner selection");
    }
  });
});
