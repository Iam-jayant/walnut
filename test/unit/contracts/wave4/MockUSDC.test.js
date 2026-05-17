const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockUSDC", function () {
  let mockUSDC;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should have correct name", async function () {
      expect(await mockUSDC.name()).to.equal("Mock USDC");
    });

    it("Should have correct symbol", async function () {
      expect(await mockUSDC.symbol()).to.equal("USDC");
    });

    it("Should have 6 decimals", async function () {
      expect(await mockUSDC.decimals()).to.equal(6n);
    });

    it("Should start with zero total supply", async function () {
      expect(await mockUSDC.totalSupply()).to.equal(0n);
    });
  });

  describe("Minting", function () {
    it("Should mint tokens correctly", async function () {
      const mintAmount = ethers.parseUnits("1000", 6); // 1000 USDC
      
      await mockUSDC.mint(addr1.address, mintAmount);
      
      expect(await mockUSDC.balanceOf(addr1.address)).to.equal(mintAmount);
      expect(await mockUSDC.totalSupply()).to.equal(mintAmount);
    });

    it("Should allow anyone to mint (no access control)", async function () {
      const mintAmount = ethers.parseUnits("500", 6); // 500 USDC
      
      // addr1 mints to addr2 (not owner)
      await mockUSDC.connect(addr1).mint(addr2.address, mintAmount);
      
      expect(await mockUSDC.balanceOf(addr2.address)).to.equal(mintAmount);
    });

    it("Should mint to multiple addresses", async function () {
      const amount1 = ethers.parseUnits("100", 6);
      const amount2 = ethers.parseUnits("200", 6);
      
      await mockUSDC.mint(addr1.address, amount1);
      await mockUSDC.mint(addr2.address, amount2);
      
      expect(await mockUSDC.balanceOf(addr1.address)).to.equal(amount1);
      expect(await mockUSDC.balanceOf(addr2.address)).to.equal(amount2);
      expect(await mockUSDC.totalSupply()).to.equal(amount1 + amount2);
    });

    it("Should mint zero tokens without error", async function () {
      await mockUSDC.mint(addr1.address, 0);
      expect(await mockUSDC.balanceOf(addr1.address)).to.equal(0n);
    });

    it("Should handle large mint amounts", async function () {
      const largeAmount = ethers.parseUnits("1000000000", 6); // 1 billion USDC
      
      await mockUSDC.mint(addr1.address, largeAmount);
      
      expect(await mockUSDC.balanceOf(addr1.address)).to.equal(largeAmount);
    });
  });

  describe("ERC20 Standard Operations", function () {
    beforeEach(async function () {
      // Mint tokens to addr1 for testing transfers
      const mintAmount = ethers.parseUnits("1000", 6);
      await mockUSDC.mint(addr1.address, mintAmount);
    });

    describe("Transfer", function () {
      it("Should transfer tokens between accounts", async function () {
        const transferAmount = ethers.parseUnits("100", 6);
        
        await mockUSDC.connect(addr1).transfer(addr2.address, transferAmount);
        
        expect(await mockUSDC.balanceOf(addr1.address)).to.equal(
          ethers.parseUnits("900", 6)
        );
        expect(await mockUSDC.balanceOf(addr2.address)).to.equal(transferAmount);
      });

      it("Should fail when sender has insufficient balance", async function () {
        const transferAmount = ethers.parseUnits("2000", 6); // More than balance
        
        try {
          await mockUSDC.connect(addr1).transfer(addr2.address, transferAmount);
          expect.fail("Should have reverted");
        } catch (error) {
          expect(error.message).to.include("ERC20InsufficientBalance");
        }
      });

      it("Should emit Transfer event", async function () {
        const transferAmount = ethers.parseUnits("100", 6);
        
        const tx = await mockUSDC.connect(addr1).transfer(addr2.address, transferAmount);
        const receipt = await tx.wait();
        
        // Verify transfer occurred
        expect(await mockUSDC.balanceOf(addr2.address)).to.equal(transferAmount);
      });

      it("Should transfer zero tokens", async function () {
        await mockUSDC.connect(addr1).transfer(addr2.address, 0);
        expect(await mockUSDC.balanceOf(addr2.address)).to.equal(0n);
      });
    });

    describe("Approve and TransferFrom", function () {
      it("Should approve tokens for spending", async function () {
        const approveAmount = ethers.parseUnits("500", 6);
        
        await mockUSDC.connect(addr1).approve(addr2.address, approveAmount);
        
        expect(await mockUSDC.allowance(addr1.address, addr2.address)).to.equal(
          approveAmount
        );
      });

      it("Should emit Approval event", async function () {
        const approveAmount = ethers.parseUnits("500", 6);
        
        const tx = await mockUSDC.connect(addr1).approve(addr2.address, approveAmount);
        const receipt = await tx.wait();
        
        // Verify approval occurred
        expect(await mockUSDC.allowance(addr1.address, addr2.address)).to.equal(approveAmount);
      });

      it("Should allow transferFrom with sufficient allowance", async function () {
        const approveAmount = ethers.parseUnits("500", 6);
        const transferAmount = ethers.parseUnits("300", 6);
        
        await mockUSDC.connect(addr1).approve(addr2.address, approveAmount);
        await mockUSDC
          .connect(addr2)
          .transferFrom(addr1.address, addr2.address, transferAmount);
        
        expect(await mockUSDC.balanceOf(addr1.address)).to.equal(
          ethers.parseUnits("700", 6)
        );
        expect(await mockUSDC.balanceOf(addr2.address)).to.equal(transferAmount);
        expect(await mockUSDC.allowance(addr1.address, addr2.address)).to.equal(
          ethers.parseUnits("200", 6)
        );
      });

      it("Should fail transferFrom with insufficient allowance", async function () {
        const approveAmount = ethers.parseUnits("100", 6);
        const transferAmount = ethers.parseUnits("200", 6);
        
        await mockUSDC.connect(addr1).approve(addr2.address, approveAmount);
        
        try {
          await mockUSDC
            .connect(addr2)
            .transferFrom(addr1.address, addr2.address, transferAmount);
          expect.fail("Should have reverted");
        } catch (error) {
          expect(error.message).to.include("ERC20InsufficientAllowance");
        }
      });

      it("Should fail transferFrom with insufficient balance", async function () {
        const approveAmount = ethers.parseUnits("2000", 6);
        const transferAmount = ethers.parseUnits("2000", 6);
        
        await mockUSDC.connect(addr1).approve(addr2.address, approveAmount);
        
        try {
          await mockUSDC
            .connect(addr2)
            .transferFrom(addr1.address, addr2.address, transferAmount);
          expect.fail("Should have reverted");
        } catch (error) {
          expect(error.message).to.include("ERC20InsufficientBalance");
        }
      });

      it("Should update allowance correctly after transferFrom", async function () {
        const approveAmount = ethers.parseUnits("500", 6);
        const transferAmount = ethers.parseUnits("500", 6);
        
        await mockUSDC.connect(addr1).approve(addr2.address, approveAmount);
        await mockUSDC
          .connect(addr2)
          .transferFrom(addr1.address, addr2.address, transferAmount);
        
        expect(await mockUSDC.allowance(addr1.address, addr2.address)).to.equal(0n);
      });
    });

    describe("Balance Queries", function () {
      it("Should return correct balance for address with tokens", async function () {
        expect(await mockUSDC.balanceOf(addr1.address)).to.equal(
          ethers.parseUnits("1000", 6)
        );
      });

      it("Should return zero balance for address without tokens", async function () {
        expect(await mockUSDC.balanceOf(addr2.address)).to.equal(0n);
      });

      it("Should return correct total supply", async function () {
        expect(await mockUSDC.totalSupply()).to.equal(
          ethers.parseUnits("1000", 6)
        );
      });
    });
  });

  describe("Edge Cases", function () {
    it("Should handle multiple mints to same address", async function () {
      const amount1 = ethers.parseUnits("100", 6);
      const amount2 = ethers.parseUnits("200", 6);
      
      await mockUSDC.mint(addr1.address, amount1);
      await mockUSDC.mint(addr1.address, amount2);
      
      expect(await mockUSDC.balanceOf(addr1.address)).to.equal(amount1 + amount2);
    });

    it("Should handle transfer to self", async function () {
      const mintAmount = ethers.parseUnits("1000", 6);
      await mockUSDC.mint(addr1.address, mintAmount);
      
      await mockUSDC.connect(addr1).transfer(addr1.address, mintAmount);
      
      expect(await mockUSDC.balanceOf(addr1.address)).to.equal(mintAmount);
    });

    it("Should handle approve with zero amount", async function () {
      await mockUSDC.connect(addr1).approve(addr2.address, 0);
      expect(await mockUSDC.allowance(addr1.address, addr2.address)).to.equal(0n);
    });

    it("Should handle multiple approvals (overwrite)", async function () {
      const amount1 = ethers.parseUnits("100", 6);
      const amount2 = ethers.parseUnits("200", 6);
      
      await mockUSDC.connect(addr1).approve(addr2.address, amount1);
      await mockUSDC.connect(addr1).approve(addr2.address, amount2);
      
      expect(await mockUSDC.allowance(addr1.address, addr2.address)).to.equal(
        amount2
      );
    });
  });

  describe("Decimal Precision", function () {
    it("Should handle amounts with 6 decimal precision", async function () {
      // 1.5 USDC = 1500000 (6 decimals)
      const amount = 1500000n;
      
      await mockUSDC.mint(addr1.address, amount);
      
      expect(await mockUSDC.balanceOf(addr1.address)).to.equal(amount);
    });

    it("Should handle fractional amounts correctly", async function () {
      // 0.000001 USDC (smallest unit)
      const smallestUnit = 1n;
      
      await mockUSDC.mint(addr1.address, smallestUnit);
      
      expect(await mockUSDC.balanceOf(addr1.address)).to.equal(smallestUnit);
    });

    it("Should handle large amounts with 6 decimals", async function () {
      // 1 million USDC
      const largeAmount = ethers.parseUnits("1000000", 6);
      
      await mockUSDC.mint(addr1.address, largeAmount);
      
      expect(await mockUSDC.balanceOf(addr1.address)).to.equal(largeAmount);
    });
  });
});
