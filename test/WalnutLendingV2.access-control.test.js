const { expect } = require("chai");
const { ethers } = require("hardhat");

const TASK_MANAGER_ADDRESS = "0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9";
const EXPECTED_SECURITY_ZONE = 0;

const TASK_MANAGER_ABI = [
  "function verifyInput((uint256 ctHash,uint8 securityZone,uint8 utype,bytes signature) input,address sender) returns (uint256)",
  "function MOCK_setInEuintKey(uint256 ctHash,uint256 value)"
];

let mockCipherCounter = 1000n;

async function encrypt(amount) {
  const value = typeof amount === 'bigint' ? amount : BigInt(amount);
  const manager = await ethers.getContractAt(TASK_MANAGER_ABI, TASK_MANAGER_ADDRESS);
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

describe("WalnutLendingV2 Access Control Regression Check", function () {
  let contract, usdc, oracle;
  let owner, userA, userB;

  beforeEach(async function () {
    [owner, userA, userB] = await ethers.getSigners();
    
    // Fix MockTaskManager setup for encrypt() to work
    const TASK_MANAGER_ABI = [
      "function setVerifierSigner(address signer) external",
      "function setDecryptResultSigner(address signer) external"
    ];
    const manager = await ethers.getContractAt(TASK_MANAGER_ABI, TASK_MANAGER_ADDRESS);
    await (await manager.connect(owner).setVerifierSigner(ethers.ZeroAddress)).wait();
    await (await manager.connect(owner).setDecryptResultSigner(ethers.ZeroAddress)).wait();

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
      await ethers.provider.send("hardhat_setStorageAt", [
        TASK_MANAGER_ADDRESS,
        "0x" + slotFound.toString(16),
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      ]);
    }
    
    // Mock USDC
    const ERC20Mock = await ethers.getContractFactory("MockUSDC");
    usdc = await ERC20Mock.deploy();
    await usdc.waitForDeployment();
    
    // Mock Oracle
    const OracleMock = await ethers.getContractFactory("WalnutPriceOracle");
    oracle = await OracleMock.deploy();
    await oracle.waitForDeployment();
    
    // Deploy protocol
    const WalnutLendingV2 = await ethers.getContractFactory("WalnutLendingV2");
    contract = await WalnutLendingV2.deploy(await usdc.getAddress(), await oracle.getAddress(), owner.address);
    await contract.waitForDeployment();
    
    // Setup balances
    await usdc.mint(userA.address, 1000n * 10n**6n);
    await usdc.connect(userA).approve(await contract.getAddress(), ethers.MaxUint256);
  });

  it("Should correctly enforce FHE.allow access controls and prevent cross-account decryption", async function () {
    const encryptedAmount = await encrypt(500n * 10n**6n);
    
    // 1. User A initiates deposit
    //    Contract executes: FHE.allow(value, msg.sender)
    const tx = await contract.connect(userA).deposit(await usdc.getAddress(), encryptedAmount);
    const receipt = await tx.wait();
    
    // Extract the requestId (which represents the ciphertext handle)
    let requestId;
    for (const log of receipt.logs) {
      try {
        const decoded = contract.interface.parseLog(log);
        if (decoded && decoded.name === "DepositSyncRequested") {
          requestId = decoded.args.requestId;
          break;
        }
      } catch (e) {}
    }
    expect(requestId).to.not.be.undefined;

    // 2. CoFHE Oracle Decryption Simulation
    const { cofhe } = require("hardhat");
    
    // We simulate `withPermit` (no-arg / implicit self permit) for User B trying to decrypt User A's data.
    // The Fhenix Hardhat plugin enforces that the requested account must be in the ACL of the ciphertext.
    let errorCaught = false;
    try {
      // Simulate decryption using User B's credentials
      await cofhe.decryptForView(requestId, userB.address);
    } catch (e) {
      errorCaught = true;
      // The Fhenix mock throws specific unauthorized errors if the ACL does not match
      expect(e.message).to.match(/not allowed|unauthorized|User not found/i);
    }
    
    // If errorCaught is false, it means User B successfully decrypted User A's data!
    expect(errorCaught).to.be.true("CRITICAL: Cross-account decryption succeeded! Access control regression.");
    
    // 3. User A SHOULD be able to decrypt their own data
    let userAErrorCaught = false;
    try {
      await cofhe.decryptForView(requestId, userA.address);
    } catch (e) {
      userAErrorCaught = true;
    }
    expect(userAErrorCaught).to.be.false("User A should be able to decrypt their own data");
  });
});
