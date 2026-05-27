const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WalnutPriceOracle", function () {
  let oracle;
  let mockAggregator;
  let mockToken;
  let owner;
  let addr1;
  let addr2;

  // Deploy a mock Chainlink aggregator for testing
  async function deployMockAggregator(decimals, initialPrice) {
    const MockAggregator = await ethers.getContractFactory("MockChainlinkAggregator");
    const aggregator = await MockAggregator.deploy(decimals, initialPrice);
    await aggregator.waitForDeployment();
    return aggregator;
  }

  // Deploy a mock ERC20 token with configurable decimals
  async function deployMockToken(decimals) {
    const MockToken = await ethers.getContractFactory("MockERC20WithDecimals");
    const token = await MockToken.deploy("Mock Token", "MTK", decimals);
    await token.waitForDeployment();
    return token;
  }

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy WalnutPriceOracle
    const WalnutPriceOracle = await ethers.getContractFactory("WalnutPriceOracle");
    oracle = await WalnutPriceOracle.deploy();
    await oracle.waitForDeployment();

    // Deploy mock aggregator (8 decimals, $2000 price)
    mockAggregator = await deployMockAggregator(8, 2000_00000000n); // $2000 with 8 decimals

    // Deploy mock token (18 decimals like WETH)
    mockToken = await deployMockToken(18);
  });

  describe("Deployment", function () {
    it("Should set the deployer as owner", async function () {
      expect(await oracle.owner()).to.equal(owner.address);
    });

    it("Should have correct staleness threshold", async function () {
      expect(await oracle.STALENESS_THRESHOLD()).to.equal(3600n); // 1 hour
    });

    it("Should have correct USD decimals", async function () {
      expect(await oracle.USD_DECIMALS()).to.equal(6n);
    });
  });

  describe("setPriceFeed", function () {
    it("Should allow owner to set price feed", async function () {
      await oracle.setPriceFeed(await mockToken.getAddress(), await mockAggregator.getAddress());
      
      expect(await oracle.priceFeeds(await mockToken.getAddress())).to.equal(
        await mockAggregator.getAddress()
      );
    });

    it("Should emit PriceFeedSet event", async function () {
      const tokenAddress = await mockToken.getAddress();
      const aggregatorAddress = await mockAggregator.getAddress();
      
      const tx = await oracle.setPriceFeed(tokenAddress, aggregatorAddress);
      const receipt = await tx.wait();
      
      // Verify the price feed was set
      expect(await oracle.priceFeeds(tokenAddress)).to.equal(aggregatorAddress);
    });

    it("Should allow updating existing price feed", async function () {
      const tokenAddress = await mockToken.getAddress();
      const aggregator1Address = await mockAggregator.getAddress();
      
      // Set initial feed
      await oracle.setPriceFeed(tokenAddress, aggregator1Address);
      
      // Deploy new aggregator
      const mockAggregator2 = await deployMockAggregator(8, 3000_00000000n);
      const aggregator2Address = await mockAggregator2.getAddress();
      
      // Update feed
      await oracle.setPriceFeed(tokenAddress, aggregator2Address);
      
      expect(await oracle.priceFeeds(tokenAddress)).to.equal(aggregator2Address);
    });

    it("Should revert if non-owner tries to set price feed", async function () {
      try {
        await oracle.connect(addr1).setPriceFeed(
          await mockToken.getAddress(),
          await mockAggregator.getAddress()
        );
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("Only owner");
      }
    });

    it("Should revert if token address is zero", async function () {
      try {
        await oracle.setPriceFeed(ethers.ZeroAddress, await mockAggregator.getAddress());
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("Invalid token");
      }
    });

    it("Should revert if feed address is zero", async function () {
      try {
        await oracle.setPriceFeed(await mockToken.getAddress(), ethers.ZeroAddress);
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("Invalid feed");
      }
    });
  });

  describe("getUSDValue", function () {
    beforeEach(async function () {
      // Set up price feed
      await oracle.setPriceFeed(await mockToken.getAddress(), await mockAggregator.getAddress());
    });

    it("Should return correct USD value for 1 token (18 decimals)", async function () {
      // 1 token = 1e18
      // Price = $2000 = 2000e8
      // Expected USD value = 2000e6 (6 decimals)
      const amount = ethers.parseUnits("1", 18);
      const usdValue = await oracle.getUSDValue(await mockToken.getAddress(), amount);
      
      expect(usdValue).to.equal(ethers.parseUnits("2000", 6));
    });

    it("Should return correct USD value for fractional token amount", async function () {
      // 0.5 tokens = 0.5e18
      // Price = $2000 = 2000e8
      // Expected USD value = 1000e6 (6 decimals)
      const amount = ethers.parseUnits("0.5", 18);
      const usdValue = await oracle.getUSDValue(await mockToken.getAddress(), amount);
      
      expect(usdValue).to.equal(ethers.parseUnits("1000", 6));
    });

    it("Should return correct USD value for large token amount", async function () {
      // 100 tokens = 100e18
      // Price = $2000 = 2000e8
      // Expected USD value = 200000e6 (6 decimals)
      const amount = ethers.parseUnits("100", 18);
      const usdValue = await oracle.getUSDValue(await mockToken.getAddress(), amount);
      
      expect(usdValue).to.equal(ethers.parseUnits("200000", 6));
    });

    it("Should return zero for zero amount", async function () {
      const usdValue = await oracle.getUSDValue(await mockToken.getAddress(), 0);
      expect(usdValue).to.equal(0n);
    });

    it("Should handle token with 6 decimals (like USDC)", async function () {
      // Deploy USDC-like token (6 decimals)
      const usdcToken = await deployMockToken(6);
      
      // Deploy aggregator with $1 price (USDC/USD)
      const usdcAggregator = await deployMockAggregator(8, 1_00000000n); // $1 with 8 decimals
      
      // Set price feed
      await oracle.setPriceFeed(await usdcToken.getAddress(), await usdcAggregator.getAddress());
      
      // 1000 USDC = 1000e6
      // Price = $1 = 1e8
      // Expected USD value = 1000e6 (6 decimals)
      const amount = ethers.parseUnits("1000", 6);
      const usdValue = await oracle.getUSDValue(await usdcToken.getAddress(), amount);
      
      expect(usdValue).to.equal(ethers.parseUnits("1000", 6));
    });

    it("Should handle token with 8 decimals", async function () {
      // Deploy token with 8 decimals
      const token8 = await deployMockToken(8);
      
      // Deploy aggregator with $100 price
      const aggregator8 = await deployMockAggregator(8, 100_00000000n); // $100 with 8 decimals
      
      // Set price feed
      await oracle.setPriceFeed(await token8.getAddress(), await aggregator8.getAddress());
      
      // 10 tokens = 10e8
      // Price = $100 = 100e8
      // Expected USD value = 1000e6 (6 decimals)
      const amount = ethers.parseUnits("10", 8);
      const usdValue = await oracle.getUSDValue(await token8.getAddress(), amount);
      
      expect(usdValue).to.equal(ethers.parseUnits("1000", 6));
    });

    it("Should revert if no price feed exists", async function () {
      const unknownToken = await deployMockToken(18);
      
      try {
        await oracle.getUSDValue(await unknownToken.getAddress(), ethers.parseUnits("1", 18));
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("No price feed");
      }
    });

    it("Should revert if price is stale (>1 hour old)", async function () {
      // Update aggregator to return stale price
      await mockAggregator.setStalePrice();
      
      try {
        await oracle.getUSDValue(await mockToken.getAddress(), ethers.parseUnits("1", 18));
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("Stale price");
      }
    });

    it("Should revert if price is zero", async function () {
      // Update aggregator to return zero price
      await mockAggregator.setPrice(0);
      
      try {
        await oracle.getUSDValue(await mockToken.getAddress(), ethers.parseUnits("1", 18));
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("Invalid price");
      }
    });

    it("Should revert if price is negative", async function () {
      // Update aggregator to return negative price
      await mockAggregator.setPrice(-1000_00000000n);
      
      try {
        await oracle.getUSDValue(await mockToken.getAddress(), ethers.parseUnits("1", 18));
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("Invalid price");
      }
    });

    it("Should handle very small token amounts", async function () {
      // 0.000001 tokens = 1e12 (18 decimals)
      // Price = $2000 = 2000e8
      // Expected USD value = 0.002e6 = 2000 (6 decimals)
      const amount = 1000000000000n; // 1e12
      const usdValue = await oracle.getUSDValue(await mockToken.getAddress(), amount);
      
      expect(usdValue).to.equal(2000n);
    });

    it("Should handle high-priced tokens", async function () {
      // Deploy aggregator with $50,000 price (like BTC)
      const btcAggregator = await deployMockAggregator(8, 50000_00000000n);
      const btcToken = await deployMockToken(18);
      
      await oracle.setPriceFeed(await btcToken.getAddress(), await btcAggregator.getAddress());
      
      // 1 BTC = 1e18
      // Price = $50,000 = 50000e8
      // Expected USD value = 50000e6 (6 decimals)
      const amount = ethers.parseUnits("1", 18);
      const usdValue = await oracle.getUSDValue(await btcToken.getAddress(), amount);
      
      expect(usdValue).to.equal(ethers.parseUnits("50000", 6));
    });

    it("Should handle low-priced tokens", async function () {
      // Deploy aggregator with $0.01 price
      const lowPriceAggregator = await deployMockAggregator(8, 1000000n); // $0.01 with 8 decimals
      const lowPriceToken = await deployMockToken(18);
      
      await oracle.setPriceFeed(await lowPriceToken.getAddress(), await lowPriceAggregator.getAddress());
      
      // 1000 tokens = 1000e18
      // Price = $0.01 = 0.01e8
      // Expected USD value = 10e6 (6 decimals)
      const amount = ethers.parseUnits("1000", 18);
      const usdValue = await oracle.getUSDValue(await lowPriceToken.getAddress(), amount);
      
      expect(usdValue).to.equal(ethers.parseUnits("10", 6));
    });
  });

  describe("Decimal Conversion Edge Cases", function () {
    it("Should handle token with 0 decimals", async function () {
      const token0 = await deployMockToken(0);
      const aggregator = await deployMockAggregator(8, 100_00000000n); // $100
      
      await oracle.setPriceFeed(await token0.getAddress(), await aggregator.getAddress());
      
      // 10 tokens (no decimals)
      // Price = $100 = 100e8
      // Expected USD value = 1000e6 (6 decimals)
      const amount = 10n;
      const usdValue = await oracle.getUSDValue(await token0.getAddress(), amount);
      
      expect(usdValue).to.equal(ethers.parseUnits("1000", 6));
    });

    it("Should handle aggregator with different decimals", async function () {
      // Some Chainlink feeds use 18 decimals
      const aggregator18 = await deployMockAggregator(18, ethers.parseUnits("2000", 18));
      
      await oracle.setPriceFeed(await mockToken.getAddress(), await aggregator18.getAddress());
      
      // 1 token = 1e18
      // Price = $2000 = 2000e18
      // Expected USD value = 2000e6 (6 decimals)
      const amount = ethers.parseUnits("1", 18);
      const usdValue = await oracle.getUSDValue(await mockToken.getAddress(), amount);
      
      expect(usdValue).to.equal(ethers.parseUnits("2000", 6));
    });
  });

  describe("Multiple Price Feeds", function () {
    it("Should support multiple tokens with different price feeds", async function () {
      // Token 1: WETH (18 decimals, $2000)
      const weth = await deployMockToken(18);
      const wethAggregator = await deployMockAggregator(8, 2000_00000000n);
      await oracle.setPriceFeed(await weth.getAddress(), await wethAggregator.getAddress());
      
      // Token 2: USDC (6 decimals, $1)
      const usdc = await deployMockToken(6);
      const usdcAggregator = await deployMockAggregator(8, 1_00000000n);
      await oracle.setPriceFeed(await usdc.getAddress(), await usdcAggregator.getAddress());
      
      // Test WETH
      const wethAmount = ethers.parseUnits("1", 18);
      const wethUsdValue = await oracle.getUSDValue(await weth.getAddress(), wethAmount);
      expect(wethUsdValue).to.equal(ethers.parseUnits("2000", 6));
      
      // Test USDC
      const usdcAmount = ethers.parseUnits("1000", 6);
      const usdcUsdValue = await oracle.getUSDValue(await usdc.getAddress(), usdcAmount);
      expect(usdcUsdValue).to.equal(ethers.parseUnits("1000", 6));
    });
  });

  describe("Access Control", function () {
    it("Should only allow owner to set price feeds", async function () {
      try {
        await oracle.connect(addr1).setPriceFeed(
          await mockToken.getAddress(),
          await mockAggregator.getAddress()
        );
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("Only owner");
      }
    });

    it("Should allow anyone to read USD values", async function () {
      await oracle.setPriceFeed(await mockToken.getAddress(), await mockAggregator.getAddress());
      
      // Non-owner can call getUSDValue
      const amount = ethers.parseUnits("1", 18);
      const usdValue = await oracle.connect(addr1).getUSDValue(
        await mockToken.getAddress(),
        amount
      );
      
      expect(usdValue).to.equal(ethers.parseUnits("2000", 6));
    });
  });
});

// Mock Chainlink Aggregator for testing
// This will be deployed as part of the test setup
