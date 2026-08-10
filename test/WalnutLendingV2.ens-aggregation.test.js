const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");

const TASK_MANAGER_ADDRESS = "0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9";
const EXPECTED_SECURITY_ZONE = 0;

const TASK_MANAGER_ABI = [
  "function verifyInput((uint256 ctHash,uint8 securityZone,uint8 utype,bytes signature) input,address sender) returns (uint256)",
  "function MOCK_setInEuintKey(uint256 ctHash,uint256 value)",
  "function setVerifierSigner(address signer) external",
  "function setDecryptResultSigner(address signer) external"
];

let taskManager;
async function getTaskManager() {
  if (!taskManager) {
    taskManager = await ethers.getContractAt(TASK_MANAGER_ABI, TASK_MANAGER_ADDRESS);
  }
  return taskManager;
}

let mockCipherCounter = 1n;

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

async function decrypt(handle) {
  return await hre.ethers.provider.send("cofhe_decrypt", [handle.toString()]);
}

function toBytes32(bn) {
  let hex = bn.toString(16);
  while (hex.length < 64) hex = "0" + hex;
  return "0x" + hex;
}

const DUMMY_SIG_65 = "0x" + "00".repeat(65);

async function deployMockToken(name, symbol, decimals) {
  const MockERC20 = await ethers.getContractFactory("MockERC20WithDecimals");
  const token = await MockERC20.deploy(name, symbol, decimals);
  await token.waitForDeployment();
  return token;
}

async function deployMockAggregator(decimals, initialAnswer) {
  const MockChainlinkAggregator = await ethers.getContractFactory("MockChainlinkAggregator");
  const agg = await MockChainlinkAggregator.deploy(decimals, initialAnswer);
  await agg.waitForDeployment();
  return agg;
}

describe("WalnutLendingV2 ENS Aggregation", function () {
  this.timeout(1200000);
  let owner, treasury, primary, secondary1, secondary2, unauthorized;
  let mockUSDC, oracle, contract, cUSDC;
  let domain;

  before(async function () {
    const [deployer] = await ethers.getSigners();
    const manager = await getTaskManager();

    // We just ignore signature checks by passing zero address
    try { await (await manager.connect(deployer).setVerifierSigner(ethers.ZeroAddress)).wait(); } catch (e) { }
    try { await (await manager.connect(deployer).setDecryptResultSigner(ethers.ZeroAddress)).wait(); } catch (e) { }
    try { await (await manager.connect(deployer).setZoneBypass(true)).wait(); } catch(e) { }

  });

  beforeEach(async function () {
    mockCipherCounter = 1n;
    [owner, treasury, primary, secondary1, secondary2, unauthorized] = await ethers.getSigners();

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
    contract = await WalnutLendingV2.deploy(
      await cUSDC.getAddress(),
      await oracle.getAddress(),
      treasury.address
    );
    await contract.waitForDeployment();

    await cUSDC.connect(owner).setMinter(await contract.getAddress());

    await mockUSDC.mint(primary.address, ethers.parseUnits("10000", 6));
    await mockUSDC.mint(secondary1.address, ethers.parseUnits("10000", 6));

    domain = {
      name: "WalnutLending",
      version: "2",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await contract.getAddress()
    };

    // Dummy deposit to initialize primary collateral to 1
    const encInit = await encrypt(1);
    await mockUSDC.connect(primary).mint(primary.address, 1);
    await mockUSDC.connect(primary).approve(contract.target, 1);
    const tx = await contract.connect(primary).deposit(mockUSDC.target, encInit);
    const rc = await tx.wait();
    const reqLog = rc.logs.find(l => {
      try { return contract.interface.parseLog(l).name === "DepositSyncRequested"; } catch { return false; }
    });
    if (reqLog) {
      const parsed = contract.interface.parseLog(reqLog);
      await contract.syncDepositTransfer(toBytes32(parsed.args.requestId), 1, DUMMY_SIG_65);
    }
  });

  async function linkWalletSign(primaryAddr, secondarySigner, customConsent) {
    const nonce = await contract.nonces(secondarySigner.address);
    const types = {
      LinkWallet: [
        { name: "primary", type: "address" },
        { name: "secondary", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "consentMessage", type: "string" }
      ]
    };
    const consent = customConsent !== undefined ? customConsent : "I authorize aggregation and acknowledge that all liquidation surplus accrues exclusively to the primary wallet.";
    const value = {
      primary: primaryAddr,
      secondary: secondarySigner.address,
      nonce: nonce,
      consentMessage: consent
    };
    return await secondarySigner.signTypedData(domain, types, value);
  }

  async function deposit(user, amount) {
    const encAmount = await encrypt(amount);
    const tokenAddr = await mockUSDC.getAddress();
    await mockUSDC.connect(user).approve(await contract.getAddress(), amount);
    const tx = await contract.connect(user).deposit(tokenAddr, encAmount);
    const receipt = await tx.wait();

    const reqLog = receipt.logs.find(l => {
      try { return contract.interface.parseLog(l).name === "DepositSyncRequested"; } catch { return false; }
    });
    const requestId = contract.interface.parseLog(reqLog).args.requestId;
    await contract.syncDepositTransfer(toBytes32(requestId), amount, DUMMY_SIG_65);
  }

  async function borrow(user, amount) {
    const encAmount = await encrypt(amount);
    const tx = await contract.connect(user).borrow(encAmount);
    const receipt = await tx.wait();

    const reqLog = receipt.logs.find(l => {
      try { return contract.interface.parseLog(l).name === "BorrowActiveSyncRequested"; } catch { return false; }
    });
    const requestId = contract.interface.parseLog(reqLog).args.requestId;
    await contract.syncBorrowActive(toBytes32(requestId), amount, DUMMY_SIG_65);
  }

  describe("1. EIP-712 Linking Mechanics", function () {
    it("Secondary wallet explicitly consents via signature", async function () {
      const sig = await linkWalletSign(primary.address, secondary1);

      const tx = await contract.connect(primary).linkWallet(secondary1.address, sig);
      const receipt = await tx.wait();

      const log = receipt.logs.find(l => {
        try { return contract.interface.parseLog(l).name === "WalletLinked"; } catch { return false; }
      });
      expect(log).to.not.be.undefined;
      const parsed = contract.interface.parseLog(log);
      expect(parsed.args.primary).to.equal(primary.address);
      expect(parsed.args.secondary).to.equal(secondary1.address);

      expect(await contract.primaryWalletOf(secondary1.address)).to.equal(primary.address);
      expect(await contract.linkedWallets(primary.address, 0)).to.equal(secondary1.address);
    });


      it("Rejects if wrong consent message is provided", async function () {
      const sig = await linkWalletSign(primary.address, secondary1, "I authorize aggregation only.");
      let errorHit = false;
      try {
        await contract.connect(primary).linkWallet(secondary1.address, sig);
      } catch (e) {
        if (e.message.includes("Invalid signature")) errorHit = true;
      }
      if (!errorHit) throw new Error("Should have reverted on wrong consent");
    });

    it("Rejects if unauthorized signature is provided", async function () {
        const sig = await linkWalletSign(primary.address, unauthorized); // unauthorized signs instead of secondary1

        try {
          await contract.connect(primary).linkWallet(secondary1.address, sig);
          expect.fail("Should have reverted");
        } catch (err) {
          expect(err.message).to.include("Invalid signature");
        }
      });

      it("Rejects signature replay attack (same signature twice)", async function () {
        const sig = await linkWalletSign(primary.address, secondary1);
        await contract.connect(primary).linkWallet(secondary1.address, sig);

        // Force unlink so we can try to link again
        const tx = await contract.connect(primary).requestUnlink(secondary1.address);
        const receipt = await tx.wait();
        const reqLog = receipt.logs.find(l => {
          try { return contract.interface.parseLog(l).name === "UnlinkRequested"; } catch { return false; }
        });
        const requestId = contract.interface.parseLog(reqLog).args.requestId;
        await contract.syncUnlink(toBytes32(requestId), 1, DUMMY_SIG_65); // 1 = healthy

        // Re-link attempt with the OLD signature should fail
        try {
          await contract.connect(primary).linkWallet(secondary1.address, sig);
          expect.fail("Should have reverted");
        } catch (err) {
          expect(err.message).to.include("Invalid signature");
        }
      });

      it("Cannot create circular links", async function () {
        const sig1 = await linkWalletSign(primary.address, secondary1);
        await contract.connect(primary).linkWallet(secondary1.address, sig1);

        const sig2 = await linkWalletSign(secondary1.address, primary);
        try {
          await contract.connect(secondary1).linkWallet(primary.address, sig2);
          expect.fail("Should have reverted");
        } catch (err) {
          expect(err.message).to.include("Primary is already a secondary");
        }
      });
    });

    describe("2. FHE Aggregation and Health Factor Logic", function () {
      beforeEach(async function () {
        // Primary deposits 1000
        await deposit(primary, 1000000000n);
        // Secondary deposits 2000
        await deposit(secondary1, 2000000000n);

        const sig = await linkWalletSign(primary.address, secondary1);
        await contract.connect(primary).linkWallet(secondary1.address, sig);
      });

      it("Aggregates collateral accurately for health factor checks", async function () {
        // Primary has 1000, secondary has 2000 -> Total 3000 collateral
        // Primary borrows 2100 (which is 70% of 3000). Max borrow is usually determined by LTV.
        // Health factor check runs during liquidation. If we borrow 2100, we are safe (3000 * 0.8 = 2400 max liquidation limit).
        await borrow(primary, 2100_000000n);

        // Trigger liquidation check
        const tx = await contract.requestLiquidationCheck(primary.address);
        const receipt = await tx.wait();

        const reqLog = receipt.logs.find(l => {
          try { return contract.interface.parseLog(l).name === "LiquidationCheckRequested"; } catch { return false; }
        });
        const requestId = contract.interface.parseLog(reqLog).args.requestId;

        // Debt = 2100. Collateral = 3000. 
        // 2100 * 10000 <= 3000 * 8000 -> 21,000,000 <= 24,000,000 -> Healthy! (result = 0)

        const syncTx = await contract.syncLiquidationCheck(toBytes32(requestId), 0, DUMMY_SIG_65);
        const syncReceipt = await syncTx.wait();
        const syncLog = syncReceipt.logs.find(l => {
          try { return contract.interface.parseLog(l).name === "LiquidationAuctionHealthy"; } catch { return false; }
        });
        expect(syncLog).to.not.be.undefined;
        const parsed = contract.interface.parseLog(syncLog);
        expect(parsed.args.borrower).to.equal(primary.address);
      });

      it("Unlinking is blocked if it drops aggregated health factor below liquidation threshold", async function () {
        // Primary borrows 2100
        await borrow(primary, 2100_000000n);

        // Primary requests unlink
        const tx = await contract.connect(primary).requestUnlink(secondary1.address);
        const receipt = await tx.wait();
        const reqLog = receipt.logs.find(l => {
          try { return contract.interface.parseLog(l).name === "UnlinkRequested"; } catch { return false; }
        });
        const requestId = contract.interface.parseLog(reqLog).args.requestId;

        // If secondary1 is removed, primary collateral = 1000, debt = 2100. 
        // 2100 * 10000 <= 1000 * 8000 -> 21,000,000 <= 8,000,000 -> False! (isHealthy = 0)

        try {
          await contract.syncUnlink(toBytes32(requestId), 0, DUMMY_SIG_65);
          expect.fail("Should have reverted");
        } catch (err) {
          expect(err.message).to.include("Unlink would cause undercollateralization");
        }
      });

      it("Unlinking succeeds if health factor is safe", async function () {
        // Primary borrows 500
        await borrow(primary, 500_000000n);

        // Primary requests unlink
        const tx = await contract.connect(primary).requestUnlink(secondary1.address);
        const receipt = await tx.wait();
        const reqLog = receipt.logs.find(l => {
          try { return contract.interface.parseLog(l).name === "UnlinkRequested"; } catch { return false; }
        });
        const requestId = contract.interface.parseLog(reqLog).args.requestId;

        // If secondary1 is removed, primary collateral = 1000, debt = 500. 
        // 500 * 10000 <= 1000 * 8000 -> 5,000,000 <= 8,000,000 -> True! (isHealthy = 1)

        const syncTx = await contract.syncUnlink(toBytes32(requestId), 1, DUMMY_SIG_65);
        const syncReceipt = await syncTx.wait();
        const syncLog = syncReceipt.logs.find(l => {
          try { return contract.interface.parseLog(l).name === "WalletUnlinked"; } catch { return false; }
        });
        expect(syncLog).to.not.be.undefined;
        const parsed = contract.interface.parseLog(syncLog);
        expect(parsed.args.primary).to.equal(primary.address);
        expect(parsed.args.secondary).to.equal(secondary1.address);

        expect(await contract.primaryWalletOf(secondary1.address)).to.equal(ethers.ZeroAddress);
      });
    });

    describe("3. Liquidation Aggregation Clearing", function () {
      beforeEach(async function () {
        await deposit(primary, 1000000000n);
        await deposit(secondary1, 2000000000n);

        const sig = await linkWalletSign(primary.address, secondary1);
        await contract.connect(primary).linkWallet(secondary1.address, sig);

        // Mock auction open
        await borrow(primary, 3000000000n); // Borrow 3000, which is exactly 100% LTV, so they are liquidatable

        const tx = await contract.requestLiquidationCheck(primary.address);
        const receipt = await tx.wait();
        const reqLog = receipt.logs.find(l => {
          try { return contract.interface.parseLog(l).name === "LiquidationCheckRequested"; } catch { return false; }
        });
        const requestId = contract.interface.parseLog(reqLog).args.requestId;

        // They are liquidatable (result = 1)
        await contract.syncLiquidationCheck(toBytes32(requestId), 1, DUMMY_SIG_65);
      });

      it("Active liquidation blocks unlinking", async function () {
        try {
          await contract.connect(primary).requestUnlink(secondary1.address);
          expect.fail("Should have reverted");
        } catch (err) {
          expect(err.message).to.include("Active liquidation");
        }
      });
    });
  });
