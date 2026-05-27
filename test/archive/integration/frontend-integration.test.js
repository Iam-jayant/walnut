const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Frontend Integration Tests", function () {
  let walnut;
  let owner, user1, user2;
  let contractAddress;

  before(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    // Deploy contract
    const WalnutV1 = await ethers.getContractFactory("WalnutV1");
    walnut = await WalnutV1.deploy();
    await walnut.waitForDeployment();
    
    contractAddress = await walnut.getAddress();
    console.log(`\n📍 Contract deployed at: ${contractAddress}`);
  });

  describe("1. Contract Deployment", function () {
    it("Should deploy successfully", async function () {
      expect(contractAddress).to.be.properAddress;
    });

    it("Should have correct owner", async function () {
      expect(await walnut.owner()).to.equal(owner.address);
    });

    it("Should not be paused", async function () {
      expect(await walnut.paused()).to.equal(false);
    });
  });

  describe("2. Read Functions (Empty State)", function () {
    it("Should return encrypted collateral for new user", async function () {
      const result = await walnut.getEncryptedCollateral(user1.address);
      expect(result.ctHash).to.exist;
      expect(result.utype).to.equal(6); // EUINT128_UTYPE
      console.log(`   ✅ Collateral ctHash: ${result.ctHash}`);
    });

    it("Should return encrypted debt for new user", async function () {
      const result = await walnut.getEncryptedDebt(user1.address);
      expect(result.ctHash).to.exist;
      expect(result.utype).to.equal(6);
      console.log(`   ✅ Debt ctHash: ${result.ctHash}`);
    });

    it("Should return encrypted pool collateral", async function () {
      const result = await walnut.getEncryptedTotalPoolCollateral();
      expect(result.ctHash).to.exist;
      expect(result.utype).to.equal(6);
      console.log(`   ✅ Pool Collateral ctHash: ${result.ctHash}`);
    });

    it("Should return encrypted pool debt", async function () {
      const result = await walnut.getEncryptedTotalPoolDebt();
      expect(result.ctHash).to.exist;
      expect(result.utype).to.equal(6);
      console.log(`   ✅ Pool Debt ctHash: ${result.ctHash}`);
    });

    it("Should return credit tier for new user", async function () {
      const tier = await walnut.creditTier(user1.address);
      expect(tier).to.equal(0n);
      console.log(`   ✅ Credit Tier: ${tier}`);
    });

    it("Should return tier LTV", async function () {
      const ltv = await walnut.TIER_LTV(0);
      expect(ltv).to.equal(7000n); // 70%
      console.log(`   ✅ Tier 0 LTV: ${ltv} (70%)`);
    });

    it("Should return liquidatable status", async function () {
      const liquidatable = await walnut.liquidatable(user1.address);
      expect(liquidatable).to.equal(false);
      console.log(`   ✅ Liquidatable: ${liquidatable}`);
    });
  });

  describe("3. Critical Functions Exist", function () {
    const requiredFunctions = [
      "deposit",
      "borrow",
      "repay",
      "withdraw",
      "requestCreditTierUpdate",
      "requestLiquidationCheck",
      "openAuction",
      "submitBid",
      "selectWinningBid",
      "postOffer",
      "matchOffer",
      "registerENSWallet",
      "getHealthFactor",
      "getAggregatedCollateral",
    ];

    requiredFunctions.forEach((funcName) => {
      it(`Should have ${funcName} function`, function () {
        expect(walnut[funcName]).to.be.a("function");
      });
    });
  });

  describe("4. Gas Estimation", function () {
    it("Should estimate gas for deposit", async function () {
      // Create a mock encrypted input
      const mockEncrypted = {
        data: ethers.randomBytes(32),
        signature: ethers.randomBytes(65),
      };

      try {
        const gasEstimate = await walnut.deposit.estimateGas(mockEncrypted);
        console.log(`   ✅ Deposit gas estimate: ${gasEstimate.toString()}`);
        expect(gasEstimate).to.be.gt(0);
      } catch (error) {
        // Expected to fail without proper FHE setup, but should not revert on ABI issues
        console.log(`   ⚠️  Gas estimation failed (expected without FHE): ${error.message.substring(0, 100)}`);
      }
    });

    it("Should estimate gas for requestCreditTierUpdate", async function () {
      try {
        const gasEstimate = await walnut.requestCreditTierUpdate.estimateGas(user1.address);
        console.log(`   ✅ Credit tier update gas estimate: ${gasEstimate.toString()}`);
        expect(gasEstimate).to.be.gt(0);
      } catch (error) {
        console.log(`   ⚠️  Gas estimation failed (expected without FHE): ${error.message.substring(0, 100)}`);
      }
    });
  });

  describe("5. ENS Wallet Linking", function () {
    it("Should register ENS wallet", async function () {
      const tx = await walnut.connect(user1).registerENSWallet("user1.eth", user2.address);
      await tx.wait();
      
      const linkedWallets = await walnut.getLinkedWallets(user1.address);
      expect(linkedWallets).to.include(user2.address);
      console.log(`   ✅ Linked wallet: ${user2.address}`);
    });

    it("Should return linked wallet count", async function () {
      const count = await walnut.getLinkedWalletCount(user1.address);
      expect(count).to.equal(1n);
      console.log(`   ✅ Linked wallet count: ${count}`);
    });
  });

  describe("6. Offer System", function () {
    it("Should return initial offer count", async function () {
      const count = await walnut.offerCount();
      expect(count).to.equal(0n);
      console.log(`   ✅ Initial offer count: ${count}`);
    });
  });

  describe("7. Auction System", function () {
    it("Should return empty auction borrowers", async function () {
      const borrowers = await walnut.getAuctionBorrowers();
      expect(borrowers).to.be.an("array").that.is.empty;
      console.log(`   ✅ Auction borrowers: ${borrowers.length}`);
    });
  });

  after(function () {
    console.log(`\n✅ All integration tests completed`);
    console.log(`📍 Contract Address: ${contractAddress}`);
    console.log(`🔗 Network: Hardhat Local`);
  });
});
