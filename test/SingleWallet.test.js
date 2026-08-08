const { expect } = require("chai");
const { ethers, cofhe } = require("hardhat");

describe("Single Wallet Addition Test", function() {
  let WalnutLendingV2, walnutV2;
  let owner, user1;
  let mockUSDC, mockOracle;

  async function encrypt(value) {
    return await cofhe.encrypt_uint128(value);
  }

  before(async function() {
    [owner, user1] = await ethers.getSigners();
    
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockUSDC = await MockERC20.deploy("Mock USDC", "USDC");
    await mockUSDC.waitForDeployment();
    
    const MockOracle = await ethers.getContractFactory("MockOracle");
    mockOracle = await MockOracle.deploy(100000000); // 1 USD
    await mockOracle.waitForDeployment();

    WalnutLendingV2 = await ethers.getContractFactory("WalnutLendingV2");
    walnutV2 = await WalnutLendingV2.deploy(
      await mockUSDC.getAddress(),
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
