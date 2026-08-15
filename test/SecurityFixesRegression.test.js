const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Security Fixes Regression Test Suite", function () {
  let lendingV2, p2p, mockUsdc, mockOracle, mockWrapper;
  let owner, userA, userB;

  beforeEach(async function () {
    [owner, userA, userB] = await ethers.getSigners();

    // 1. Deploy Mock USDC
    const ERC20Mock = await ethers.getContractFactory("MockUSDC");
    mockUsdc = await ERC20Mock.deploy();
    await mockUsdc.waitForDeployment();

    // 2. Deploy Mock Oracle
    const OracleMock = await ethers.getContractFactory("WalnutPriceOracle");
    mockOracle = await OracleMock.deploy();
    await mockOracle.waitForDeployment();

    // 3. Deploy WalnutVaultWrapper
    const WalnutVaultWrapper = await ethers.getContractFactory("WalnutVaultWrapper");
    mockWrapper = await WalnutVaultWrapper.deploy(await mockUsdc.getAddress());
    await mockWrapper.waitForDeployment();

    // 4. Deploy WalnutLendingV2
    const WalnutLendingV2 = await ethers.getContractFactory("WalnutLendingV2");
    lendingV2 = await WalnutLendingV2.deploy(
      await mockUsdc.getAddress(),
      await mockOracle.getAddress(),
      owner.address
    );
    await lendingV2.waitForDeployment();

    // 5. Deploy WalnutP2P
    const WalnutP2P = await ethers.getContractFactory("WalnutP2P");
    p2p = await WalnutP2P.deploy(await mockUsdc.getAddress());
    await p2p.waitForDeployment();
  });

  describe("1. Vault Whitelist Protection (WalnutLendingV2)", function () {
    const dummyEncrypted64 = [0n, 0, 0, "0x"];
    const dummyEncrypted128 = [0n, 0, 0, "0x"];

    it("Should REVERT deposit() when an unregistered token/vault address is passed", async function () {
      const unregisteredAddress = userB.address;
      let errorMsg = "";
      try {
        await lendingV2.connect(userA).deposit(unregisteredAddress, dummyEncrypted64);
      } catch (err) {
        errorMsg = err.message || err.toString();
      }
      expect(errorMsg).to.include("Unregistered vault token");
    });

    it("Should REVERT withdraw() when an unregistered token/vault address is passed", async function () {
      const unregisteredAddress = userB.address;
      let errorMsg = "";
      try {
        await lendingV2.connect(userA).withdraw(unregisteredAddress, dummyEncrypted128);
      } catch (err) {
        errorMsg = err.message || err.toString();
      }
      expect(errorMsg).to.include("Unregistered vault token");
    });

    it("Should allow owner to approve a vault via setApprovedVault / setWUSDCAddress", async function () {
      const wrapperAddr = await mockWrapper.getAddress();

      expect(await lendingV2.isApprovedVault(wrapperAddr)).to.be.false;

      // Approve wrapper via setWUSDCAddress
      await lendingV2.connect(owner).setWUSDCAddress(wrapperAddr);
      expect(await lendingV2.isApprovedVault(wrapperAddr)).to.be.true;
      expect(await lendingV2.wUSDC_address()).to.equal(wrapperAddr);

      // Disallow non-owner from setting approved vault
      let errorMsg = "";
      try {
        await lendingV2.connect(userA).setApprovedVault(userB.address, true);
      } catch (err) {
        errorMsg = err.message || err.toString();
      }
      expect(errorMsg).to.include("Only owner");
    });

    it("Should pass whitelist validation for approved vault address", async function () {
      const wrapperAddr = await mockWrapper.getAddress();
      await lendingV2.connect(owner).setApprovedVault(wrapperAddr, true);

      let errorMsg = "";
      try {
        await lendingV2.connect(userA).deposit(wrapperAddr, dummyEncrypted64);
      } catch (err) {
        errorMsg = err.message || err.toString();
      }
      // Should pass whitelist requirement (error if any will be downstream FHE processing, not whitelist)
      expect(errorMsg).to.not.include("Unregistered vault token");
    });
  });

  describe("2. Plaintext Helper Access Control Protection (WalnutP2P)", function () {
    it("Should REVERT createOfferPlaintext() when called by non-owner", async function () {
      let errorMsg = "";
      try {
        await p2p.connect(userA).createOfferPlaintext(0, 1000000n, 500n, 30n);
      } catch (err) {
        errorMsg = err.message || err.toString();
      }
      expect(errorMsg).to.include("Only owner");
    });

    it("Should REVERT matchOfferPlaintext() when called by non-owner", async function () {
      let errorMsg = "";
      try {
        await p2p.connect(userA).matchOfferPlaintext(0, 1000000n, 500n, 30n);
      } catch (err) {
        errorMsg = err.message || err.toString();
      }
      expect(errorMsg).to.include("Only owner");
    });

    it("Should ALLOW owner to call createOfferPlaintext() for test fixtures", async function () {
      // Use OfferType.BORROW (1) which does not require cUSDC burn during creation
      const tx = await p2p.connect(owner).createOfferPlaintext(1, 1000000n, 500n, 30n);
      const rx = await tx.wait();
      expect(rx.status).to.equal(1);

      const info = await p2p.getOfferInfo(0);
      expect(info.creator).to.equal(owner.address);
    });
  });
});
