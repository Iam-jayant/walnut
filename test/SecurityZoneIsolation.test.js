const { expect } = require("chai");
const { ethers, cofhe } = require("hardhat");

const TASK_MANAGER_ADDRESS = "0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9";
const EXPECTED_SECURITY_ZONE = 0;

const TASK_MANAGER_ABI = [
  "function verifyInput((uint256 ctHash,uint8 securityZone,uint8 utype,bytes signature) input,address sender) returns (uint256)",
  "function MOCK_setInEuintKey(uint256 ctHash,uint256 value)",
  "function setVerifierSigner(address signer) external",
  "function setDecryptResultSigner(address signer) external"
];

let mockCipherCounter = 1n;

async function encrypt(amount, contractAddress) {
  const value = typeof amount === 'bigint' ? amount : BigInt(amount);
  const ctHash = await cofhe.encrypt(contractAddress, Number(value));
  return {
    ctHash,
    securityZone: 0,
    utype: 6,
    signature: "0x"
  };
}

function toBytes32(bn) {
  let hex = bn.toString(16);
  while (hex.length < 64) hex = "0" + hex;
  return "0x" + hex;
}
const DUMMY_SIG_65 = "0x" + "00".repeat(65);

describe("Security Zone Isolation Rigor Test", function () {
  let contract, mockUSDC;
  let owner, userA, userB;
  let domain;

  before(async function () {
    [owner, userA, userB] = await ethers.getSigners();
    
    // Deploy Mock tokens & Oracle
    const MockERC20 = await ethers.getContractFactory("MockERC20WithDecimals");
    mockUSDC = await MockERC20.deploy("Mock USDC", "USDC", 6);
    await mockUSDC.waitForDeployment();
    
    const MockAggregator = await ethers.getContractFactory("MockChainlinkAggregator");
    const mockAgg = await MockAggregator.deploy(8, 1_00000000n);
    await mockAgg.waitForDeployment();

    const WalnutPriceOracle = await ethers.getContractFactory("WalnutPriceOracle");
    const oracle = await WalnutPriceOracle.deploy();
    await oracle.waitForDeployment();
    await oracle.setPriceFeed(await mockUSDC.getAddress(), await mockAgg.getAddress());

    const WalnutFHERC20 = await ethers.getContractFactory("WalnutFHERC20");
    const cUSDC = await WalnutFHERC20.deploy();
    await cUSDC.waitForDeployment();

    const WalnutLendingV2 = await ethers.getContractFactory("WalnutLendingV2");
    contract = await WalnutLendingV2.deploy(await cUSDC.getAddress(), await oracle.getAddress(), owner.address);
    await contract.waitForDeployment();

    await cUSDC.connect(owner).setMinter(await contract.getAddress());
    
    await mockUSDC.mint(userA.address, 1000000n);
    await mockUSDC.mint(userB.address, 1000000n);

    domain = {
      name: "WalnutLending",
      version: "2",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await contract.getAddress()
    };
  });

  async function deposit(user, amount) {
    const encryptedAmount = await encrypt(amount, contract.target);
    await mockUSDC.connect(user).approve(contract.target, amount);
    const tx = await contract.connect(user).deposit(await mockUSDC.getAddress(), encryptedAmount);
    const receipt = await tx.wait();
    const reqLog = receipt.logs.find(l => { try { return contract.interface.parseLog(l).name === "DepositSyncRequested"; } catch { return false; } });
    if (reqLog) {
      const requestId = contract.interface.parseLog(reqLog).args.requestId;
      await contract.syncDepositTransfer(toBytes32(requestId), amount, DUMMY_SIG_65);
    }
  }

  async function linkWalletSign(primaryAddr, secondarySigner) {
    const nonce = await contract.nonces(secondarySigner.address);
    const types = {
      LinkWallet: [
        { name: "primary", type: "address" },
        { name: "secondary", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "consentMessage", type: "string" }
      ]
    };
    const consent = "I authorize aggregation and acknowledge that all liquidation surplus accrues exclusively to the primary wallet.";
    const value = { primary: primaryAddr, secondary: secondarySigner.address, nonce: nonce, consentMessage: consent };
    return await secondarySigner.signTypedData(domain, types, value);
  }

  it("Same-wallet: Adding two ciphertexts originating from the same wallet", async function () {
    // We will do two deposits for userA. The deposit function does FHE.add on the current collateral + new collateral.
    // NOTE: We did NOT apply the getTaskManager bypass in this file!
    await deposit(userA, 1000n);
    
    // Second deposit will trigger FHE.add on the same wallet's data
    await deposit(userA, 500n);

    // Call getAggregatedCollateralCtHash (which will only return the balance, no FHE.add since no linked wallets)
    const ctHash = await contract.getAggregatedCollateralCtHash(userA.address);
    expect(ctHash).to.not.equal(0n);
  });

  it("Cross-wallet: Adding two ciphertexts originating from different wallets", async function () {
    // Deposit for userB
    await deposit(userB, 200n);

    // Link userB to userA
    const sig = await linkWalletSign(userA.address, userB);
    await contract.connect(userA).linkWallet(userB.address, sig);

    // This will now iterate and call FHE.add(userA_collateral, userB_collateral)
    // We expect this to fail with InvalidSecurityZone if our hypothesis is correct.
    let failed = false;
    try {
      await contract.getAggregatedCollateralCtHash(userA.address);
    } catch (e) {
      if (e.message.includes("InvalidSecurityZone") || e.message.includes("reverted")) {
        failed = true;
      } else {
        throw e;
      }
    }
    expect(failed).to.be.true;
  });
});
