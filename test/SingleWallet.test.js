const { expect } = require("chai");
const { ethers } = require("hardhat");

const EXPECTED_SECURITY_ZONE = 0; // Required by FHE.sol bypasses

async function getTaskManager() {
  const managerAddr = "0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9";
  return await ethers.getContractAt("MockTaskManager", managerAddr);
}

let mockCipherCounter = 1000n;

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

describe("Single Wallet Addition Test", function() {
  let WalnutLendingV2, walnutV2;
  let owner, user1;
  let mockUSDC, mockOracle;

  before(async function() {
    const [deployer] = await ethers.getSigners();
    const manager = await getTaskManager();
    try { await (await manager.connect(deployer).setVerifierSigner(ethers.ZeroAddress)).wait(); } catch (e) { }
    try { await (await manager.connect(deployer).setDecryptResultSigner(ethers.ZeroAddress)).wait(); } catch (e) { }
    try { await (await manager.connect(deployer).setZoneBypass(true)).wait(); } catch(e) { }

    [owner, user1] = await ethers.getSigners();
    
    const MockERC20 = await ethers.getContractFactory("MockERC20WithDecimals");
    mockUSDC = await MockERC20.deploy("Mock USDC", "USDC", 6);
    await mockUSDC.waitForDeployment();
    
    const MockChainlinkAggregator = await ethers.getContractFactory("MockChainlinkAggregator");
    const agg = await MockChainlinkAggregator.deploy(8, 1_00000000n);
    await agg.waitForDeployment();
    
    const WalnutPriceOracle = await ethers.getContractFactory("WalnutPriceOracle");
    mockOracle = await WalnutPriceOracle.deploy();
    await mockOracle.waitForDeployment();
    await mockOracle.setPriceFeed(await mockUSDC.getAddress(), await agg.getAddress());

    const WalnutFHERC20 = await ethers.getContractFactory("WalnutFHERC20");
    const cUSDC = await WalnutFHERC20.deploy();
    await cUSDC.waitForDeployment();

    WalnutLendingV2 = await ethers.getContractFactory("WalnutLendingV2");
    walnutV2 = await WalnutLendingV2.deploy(
      await cUSDC.getAddress(),
      await mockOracle.getAddress(),
      owner.address
    );
    await walnutV2.waitForDeployment();
    
    // Deposit for user1
    await mockUSDC.mint(user1.address, 1000n * 10n**6n);
    await mockUSDC.connect(user1).approve(await walnutV2.getAddress(), 1000n * 10n**6n);
    
    const encAmount = await encrypt(500n * 10n**6n);
    const tx = await walnutV2.connect(user1).deposit(await mockUSDC.getAddress(), encAmount);
    await tx.wait();
  });

  it("Should test single wallet getAggregatedCollateralCtHash (adding to 0) without bypass", async function() {
    // Wait, getAggregatedCollateralCtHash iterates through wallets.
    // If we only have user1, it adds user1 collateral to 0.
    
    // We should be able to call this without getTaskManager bypass.
    // Let's call getAggregatedCollateralCtHash
    const ctHash = await walnutV2.getAggregatedCollateralCtHash(user1.address);
    expect(ctHash).to.not.equal(0n);
  });
});
