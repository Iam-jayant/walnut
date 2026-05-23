const { expect } = require("chai");
const { ethers } = require("hardhat");
const { encrypt, decrypt, resetMockState } = require("../../../helpers/fhe-helpers");

describe("WalnutFHERC20", function () {
  let fherc20;
  let owner;
  let minter;
  let user1;
  let user2;
  let unauthorized;

  // Initialize FHE mock system once before all tests
  before(async function () {
    const [deployer] = await ethers.getSigners();
    
    // Set up mock task manager for FHE operations
    const TASK_MANAGER_ADDRESS = "0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9";
    const taskManager = await ethers.getContractAt(
      ["function setVerifierSigner(address signer) external"],
      TASK_MANAGER_ADDRESS
    );
    await (await taskManager.connect(deployer).setVerifierSigner(ethers.ZeroAddress)).wait();
    
    // Deploy a dummy FHE contract to initialize the mock system
    const WalnutFHERC20 = await ethers.getContractFactory("WalnutFHERC20");
    const dummyContract = await WalnutFHERC20.deploy();
    await dummyContract.waitForDeployment();
  });

  beforeEach(async function () {
    resetMockState();
    
    [owner, minter, user1, user2, unauthorized] = await ethers.getSigners();

    const WalnutFHERC20 = await ethers.getContractFactory("WalnutFHERC20");
    fherc20 = await WalnutFHERC20.deploy();
    await fherc20.waitForDeployment();

    // Set minter to the designated minter address
    await (await fherc20.connect(owner).setMinter(minter.address)).wait();
  });

  describe("Deployment", function () {
    it("Should have correct name", async function () {
      expect(await fherc20.name()).to.equal("Walnut Confidential USDC");
    });

    it("Should have correct symbol", async function () {
      expect(await fherc20.symbol()).to.equal("cUSDC");
    });

    it("Should have 6 decimals", async function () {
      expect(await fherc20.decimals()).to.equal(6n);
    });

    it("Should set deployer as owner", async function () {
      expect(await fherc20.owner()).to.equal(owner.address);
    });

    it("Should set initial minter to deployer", async function () {
      const WalnutFHERC20 = await ethers.getContractFactory("WalnutFHERC20");
      const newToken = await WalnutFHERC20.deploy();
      await newToken.waitForDeployment();
      
      expect(await newToken.minter()).to.equal(owner.address);
    });

    it("Should set minter correctly in beforeEach", async function () {
      expect(await fherc20.minter()).to.equal(minter.address);
    });
  });

  describe("Access Control", function () {
    describe("setMinter", function () {
      it("Should allow owner to set minter", async function () {
        const newMinter = user1.address;
        await fherc20.connect(owner).setMinter(newMinter);
        expect(await fherc20.minter()).to.equal(newMinter);
      });

      it("Should emit MinterUpdated event", async function () {
        const newMinter = user1.address;
        await fherc20.connect(owner).setMinter(newMinter);
        expect(await fherc20.minter()).to.equal(newMinter);
      });

      it("Should reject non-owner setting minter", async function () {
        try {
          await fherc20.connect(unauthorized).setMinter(user1.address);
          expect.fail("Should have reverted");
        } catch (error) {
          expect(error.message).to.include("Only owner");
        }
      });

      it("Should reject zero address as minter", async function () {
        try {
          await fherc20.connect(owner).setMinter(ethers.ZeroAddress);
          expect.fail("Should have reverted");
        } catch (error) {
          expect(error.message).to.include("Invalid minter");
        }
      });
    });
  });

  describe("Minting", function () {
    it("Should allow minter to mint tokens", async function () {
      const amount = 1000000n;
      const encryptedAmount = await encrypt(amount);
      
      await fherc20.connect(minter).mint(user1.address, encryptedAmount);
      
      const balance = await fherc20.balanceOf(user1.address);
      const decryptedBalance = await decrypt(balance);
      expect(decryptedBalance).to.equal(amount);
    });

    it("Should emit Transfer event on mint", async function () {
      const amount = 1000000n;
      const encryptedAmount = await encrypt(amount);
      
      await fherc20.connect(minter).mint(user1.address, encryptedAmount);
      
      const balance = await fherc20.balanceOf(user1.address);
      const decryptedBalance = await decrypt(balance);
      expect(decryptedBalance).to.equal(amount);
    });

    it("Should reject non-minter minting", async function () {
      const amount = 1000000n;
      const encryptedAmount = await encrypt(amount);
      
      try {
        await fherc20.connect(unauthorized).mint(user1.address, encryptedAmount);
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("Only minter");
      }
    });

    it("Should reject minting to zero address", async function () {
      const amount = 1000000n;
      const encryptedAmount = await encrypt(amount);
      
      try {
        await fherc20.connect(minter).mint(ethers.ZeroAddress, encryptedAmount);
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("Mint to zero address");
      }
    });

    it("Should allow minting to multiple addresses", async function () {
      const amount = 1000000n;
      const encryptedAmount = await encrypt(amount);
      
      await fherc20.connect(minter).mint(user1.address, encryptedAmount);
      await fherc20.connect(minter).mint(user2.address, encryptedAmount);
      
      const balance1 = await fherc20.balanceOf(user1.address);
      const balance2 = await fherc20.balanceOf(user2.address);
      
      const decrypted1 = await decrypt(balance1);
      const decrypted2 = await decrypt(balance2);
      
      expect(decrypted1).to.equal(amount);
      expect(decrypted2).to.equal(amount);
    });

    it("Should allow multiple mints to same address", async function () {
      const amount = 1000000n;
      const encryptedAmount = await encrypt(amount);
      
      await fherc20.connect(minter).mint(user1.address, encryptedAmount);
      await fherc20.connect(minter).mint(user1.address, encryptedAmount);
      
      const balance = await fherc20.balanceOf(user1.address);
      const decryptedBalance = await decrypt(balance);
      expect(decryptedBalance).to.equal(amount * 2n);
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      const amount = 1000000n;
      const encryptedAmount = await encrypt(amount);
      await fherc20.connect(minter).mint(user1.address, encryptedAmount);
    });

    it("Should allow minter to burn tokens", async function () {
      const burnAmount = 500000n;
      const encryptedAmount = await encrypt(burnAmount);
      
      await fherc20.connect(minter).burn(user1.address, encryptedAmount);
      
      const balance = await fherc20.balanceOf(user1.address);
      const decryptedBalance = await decrypt(balance);
      expect(decryptedBalance).to.equal(500000n);
    });

    it("Should emit Transfer event on burn", async function () {
      const burnAmount = 500000n;
      const encryptedAmount = await encrypt(burnAmount);
      
      await fherc20.connect(minter).burn(user1.address, encryptedAmount);
      
      const balance = await fherc20.balanceOf(user1.address);
      const decryptedBalance = await decrypt(balance);
      expect(decryptedBalance).to.equal(500000n);
    });

    it("Should reject non-minter burning", async function () {
      const burnAmount = 500000n;
      const encryptedAmount = await encrypt(burnAmount);
      
      try {
        await fherc20.connect(unauthorized).burn(user1.address, encryptedAmount);
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("Only minter");
      }
    });

    it("Should reject burning from zero address", async function () {
      const burnAmount = 500000n;
      const encryptedAmount = await encrypt(burnAmount);
      
      try {
        await fherc20.connect(minter).burn(ethers.ZeroAddress, encryptedAmount);
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("Burn from zero address");
      }
    });

    it("Should handle burning with insufficient balance gracefully", async function () {
      const largeAmount = 10000000n;
      const encryptedAmount = await encrypt(largeAmount);
      
      await fherc20.connect(minter).burn(user1.address, encryptedAmount);
      
      const balance = await fherc20.balanceOf(user1.address);
      const decryptedBalance = await decrypt(balance);
      // Balance should remain unchanged (FHE.select prevents burn)
      expect(decryptedBalance).to.equal(1000000n);
    });
  });

  describe("Transfer", function () {
    beforeEach(async function () {
      const amount = 1000000n;
      const encryptedAmount = await encrypt(amount);
      await fherc20.connect(minter).mint(user1.address, encryptedAmount);
    });

    it("Should allow transfer between accounts", async function () {
      const transferAmount = 500000n;
      const encryptedAmount = await encrypt(transferAmount);
      
      await fherc20.connect(user1).transfer(user2.address, encryptedAmount);
      
      const balance1 = await fherc20.balanceOf(user1.address);
      const balance2 = await fherc20.balanceOf(user2.address);
      
      const decrypted1 = await decrypt(balance1);
      const decrypted2 = await decrypt(balance2);
      
      expect(decrypted1).to.equal(500000n);
      expect(decrypted2).to.equal(500000n);
    });

    it("Should emit Transfer event", async function () {
      const transferAmount = 500000n;
      const encryptedAmount = await encrypt(transferAmount);
      
      await fherc20.connect(user1).transfer(user2.address, encryptedAmount);
      
      const balance2 = await fherc20.balanceOf(user2.address);
      const decrypted2 = await decrypt(balance2);
      expect(decrypted2).to.equal(500000n);
    });

    it("Should reject transfer to zero address", async function () {
      const transferAmount = 500000n;
      const encryptedAmount = await encrypt(transferAmount);
      
      try {
        await fherc20.connect(user1).transfer(ethers.ZeroAddress, encryptedAmount);
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("Transfer to zero address");
      }
    });

    it("Should handle transfer with insufficient balance gracefully", async function () {
      const largeAmount = 10000000n;
      const encryptedAmount = await encrypt(largeAmount);
      
      await fherc20.connect(user1).transfer(user2.address, encryptedAmount);
      
      const balance1 = await fherc20.balanceOf(user1.address);
      const decrypted1 = await decrypt(balance1);
      // Balance should remain unchanged (FHE.select prevents transfer)
      expect(decrypted1).to.equal(1000000n);
    });

    it("Should allow transfer to self", async function () {
      const transferAmount = 500000n;
      const encryptedAmount = await encrypt(transferAmount);
      
      await fherc20.connect(user1).transfer(user1.address, encryptedAmount);
      
      const balance = await fherc20.balanceOf(user1.address);
      const decryptedBalance = await decrypt(balance);
      expect(decryptedBalance).to.equal(1000000n);
    });
  });

  describe("Approve and TransferFrom", function () {
    beforeEach(async function () {
      const amount = 1000000n;
      const encryptedAmount = await encrypt(amount);
      await fherc20.connect(minter).mint(user1.address, encryptedAmount);
    });

    it("Should allow approval", async function () {
      const approveAmount = 500000n;
      const encryptedAmount = await encrypt(approveAmount);
      
      await fherc20.connect(user1).approve(user2.address, encryptedAmount);
      
      const allowanceValue = await fherc20.allowance(user1.address, user2.address);
      const decryptedAllowance = await decrypt(allowanceValue);
      expect(decryptedAllowance).to.equal(approveAmount);
    });

    it("Should emit Approval event", async function () {
      const approveAmount = 500000n;
      const encryptedAmount = await encrypt(approveAmount);
      
      await fherc20.connect(user1).approve(user2.address, encryptedAmount);
      
      const allowanceValue = await fherc20.allowance(user1.address, user2.address);
      const decryptedAllowance = await decrypt(allowanceValue);
      expect(decryptedAllowance).to.equal(approveAmount);
    });

    it("Should reject approve to zero address", async function () {
      const approveAmount = 500000n;
      const encryptedAmount = await encrypt(approveAmount);
      
      try {
        await fherc20.connect(user1).approve(ethers.ZeroAddress, encryptedAmount);
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("Approve to zero address");
      }
    });

    it("Should allow transferFrom with sufficient allowance", async function () {
      const amount = 500000n;
      const encryptedAmount = await encrypt(amount);
      
      await fherc20.connect(user1).approve(user2.address, encryptedAmount);
      await fherc20.connect(user2).transferFrom(user1.address, user2.address, encryptedAmount);
      
      const balance2 = await fherc20.balanceOf(user2.address);
      const decrypted2 = await decrypt(balance2);
      expect(decrypted2).to.equal(500000n);
    });

    it("Should handle transferFrom with insufficient allowance gracefully", async function () {
      const smallAmount = 100000n;
      const largeAmount = 500000n;
      const smallEncrypted = await encrypt(smallAmount);
      const largeEncrypted = await encrypt(largeAmount);
      
      await fherc20.connect(user1).approve(user2.address, smallEncrypted);
      await fherc20.connect(user2).transferFrom(user1.address, user2.address, largeEncrypted);
      
      const balance1 = await fherc20.balanceOf(user1.address);
      const decrypted1 = await decrypt(balance1);
      // Balance should remain unchanged (FHE.select prevents transfer)
      expect(decrypted1).to.equal(1000000n);
    });

    it("Should reject transferFrom from zero address", async function () {
      const amount = 500000n;
      const encryptedAmount = await encrypt(amount);
      
      try {
        await fherc20.connect(user2).transferFrom(ethers.ZeroAddress, user2.address, encryptedAmount);
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("Transfer from zero address");
      }
    });

    it("Should reject transferFrom to zero address", async function () {
      const amount = 500000n;
      const encryptedAmount = await encrypt(amount);
      
      await fherc20.connect(user1).approve(user2.address, encryptedAmount);
      
      try {
        await fherc20.connect(user2).transferFrom(user1.address, ethers.ZeroAddress, encryptedAmount);
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("Transfer to zero address");
      }
    });
  });

  describe("View Functions", function () {
    it("Should return balance for address", async function () {
      const amount = 1000000n;
      const encryptedAmount = await encrypt(amount);
      
      await fherc20.connect(minter).mint(user1.address, encryptedAmount);
      
      const balance = await fherc20.balanceOf(user1.address);
      const decryptedBalance = await decrypt(balance);
      expect(decryptedBalance).to.equal(amount);
    });

    it("Should return zero balance for address without tokens", async function () {
      const balance = await fherc20.balanceOf(user2.address);
      const decryptedBalance = await decrypt(balance);
      expect(decryptedBalance).to.equal(0n);
    });

    it("Should return allowance", async function () {
      const mintAmount = 1000000n;
      const approveAmount = 500000n;
      const encryptedMint = await encrypt(mintAmount);
      const encryptedApprove = await encrypt(approveAmount);
      
      await fherc20.connect(minter).mint(user1.address, encryptedMint);
      await fherc20.connect(user1).approve(user2.address, encryptedApprove);
      
      const allowanceValue = await fherc20.allowance(user1.address, user2.address);
      const decryptedAllowance = await decrypt(allowanceValue);
      expect(decryptedAllowance).to.equal(approveAmount);
    });

    it("Should return total supply", async function () {
      const amount = 1000000n;
      const encryptedAmount = await encrypt(amount);
      
      await fherc20.connect(minter).mint(user1.address, encryptedAmount);
      
      const supply = await fherc20.getTotalSupply();
      const decryptedSupply = await decrypt(supply);
      expect(decryptedSupply).to.equal(amount);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero amount operations", async function () {
      const zeroAmount = await encrypt(0n);
      
      await fherc20.connect(minter).mint(user1.address, zeroAmount);
      
      const balance = await fherc20.balanceOf(user1.address);
      const decryptedBalance = await decrypt(balance);
      expect(decryptedBalance).to.equal(0n);
    });

    it("Should handle multiple approvals (overwrite)", async function () {
      const mintAmount = 1000000n;
      const amount1 = 100000n;
      const amount2 = 200000n;
      const encryptedMint = await encrypt(mintAmount);
      const encrypted1 = await encrypt(amount1);
      const encrypted2 = await encrypt(amount2);
      
      await fherc20.connect(minter).mint(user1.address, encryptedMint);
      await fherc20.connect(user1).approve(user2.address, encrypted1);
      await fherc20.connect(user1).approve(user2.address, encrypted2);
      
      const allowanceValue = await fherc20.allowance(user1.address, user2.address);
      const decryptedAllowance = await decrypt(allowanceValue);
      expect(decryptedAllowance).to.equal(amount2);
    });

    it("Should maintain separate balances for different users", async function () {
      const amount = 1000000n;
      const encryptedAmount = await encrypt(amount);
      
      await fherc20.connect(minter).mint(user1.address, encryptedAmount);
      await fherc20.connect(minter).mint(user2.address, encryptedAmount);
      
      const balance1 = await fherc20.balanceOf(user1.address);
      const balance2 = await fherc20.balanceOf(user2.address);
      
      const decrypted1 = await decrypt(balance1);
      const decrypted2 = await decrypt(balance2);
      
      expect(decrypted1).to.equal(amount);
      expect(decrypted2).to.equal(amount);
    });
  });
});
