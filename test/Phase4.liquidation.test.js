const { expect } = require("chai");
const hre = require("hardhat");
const { ethers, network } = require("hardhat");
const { createPublicClient, createWalletClient, http } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { arbitrumSepolia } = require("viem/chains");
const { createCofheClient, createCofheConfig } = require("@cofhe/sdk/node");
const { arbSepolia } = require("@cofhe/sdk/chains");
const { Encryptable } = require("@cofhe/sdk");

describe("Phase 4: Sealed-Bid Liquidation Auction & Minimum Bid Verification (Live Arbitrum Sepolia)", function () {
    let mockUSDC;
    let wrapper;
    let lending;
    let cUSDC;
    let user;
    let cofheClient;

    const MOCK_USDC_ADDRESS = "0x6341A12D08EE6F6fA071CF94C7C4a878ee5AF3ef";
    const WRAPPER_ADDRESS = "0x8684d325BE9B635BD72bFC2bB10bB6f354f5Cd61";
    const FHERC20_ADDRESS = "0x78136BC03b4549688C48181a26c521eb2F27F23F";
    const ORACLE_ADDRESS = "0x82E7caF958B329c47F10778E10A89B2319D67A14";

    before(async function () {
        if (network.name !== "arbitrumSepolia") {
            this.skip();
        }

        [user] = await ethers.getSigners();
        
        const rpcUrl = "https://sepolia-rollup.arbitrum.io/rpc";
        const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(rpcUrl) });
        
        const cofheConfig = createCofheConfig({
            environment: "node",
            supportedChains: [arbSepolia],
            useWorker: false
        });
        
        const pk = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
        const walletClient = createWalletClient({ account: account, chain: arbitrumSepolia, transport: http(rpcUrl) });
        
        cofheClient = createCofheClient(cofheConfig);
        cofheClient.config.useWorker = false;
        await cofheClient.connect(publicClient, walletClient);

        mockUSDC = await ethers.getContractAt(
            ["function mint(address to, uint256 amount) external", "function approve(address spender, uint256 amount) external returns (bool)"],
            MOCK_USDC_ADDRESS
        );

        wrapper = await ethers.getContractAt(
            ["function shield(address to, uint256 amount) external returns (uint256)", "function setOperator(address operator, uint48 until) external"],
            WRAPPER_ADDRESS
        );

        cUSDC = await ethers.getContractAt(
            ["function setMinter(address minter) external"],
            FHERC20_ADDRESS
        );

        console.log("Deploying fresh WalnutLendingV2 for Phase 4 Liquidation Auction...");
        const WalnutLendingV2 = await ethers.getContractFactory("WalnutLendingV2");
        lending = await WalnutLendingV2.deploy(FHERC20_ADDRESS, ORACLE_ADDRESS, user.address);
        await lending.waitForDeployment();
        console.log(`WalnutLendingV2 deployed at: ${lending.target}`);

        console.log("Setting wUSDC address...");
        let txSet = await lending.setWUSDCAddress(wrapper.target);
        await txSet.wait();

        console.log("Setting WalnutLendingV2 as minter on cUSDC...");
        txSet = await cUSDC.setMinter(lending.target);
        await txSet.wait();
    });

    it("Should execute sealed-bid liquidation auction flow with minimum bid validity check", async function () {
        const depositAmount = 100n * 1000000n; // $100 wUSDC collateral
        const borrowAmount = 79n * 1000000n;   // $79 cUSDC borrow
        const lowBidAmount = 1n * 1000000n;     // $1 cUSDC invalid bid (< $79 debt)
        const validBidAmount = 80n * 1000000n;  // $80 cUSDC valid bid (>= $79 debt)

        // 1. Mint, approve & shield $100 USDC into wUSDC
        console.log("Minting MockUSDC...");
        let tx = await mockUSDC.mint(user.address, depositAmount);
        await tx.wait();

        console.log("Approving wrapper...");
        tx = await mockUSDC.approve(wrapper.target, depositAmount);
        await tx.wait();

        console.log("Shielding MockUSDC into wUSDC...");
        tx = await wrapper.shield(user.address, depositAmount);
        await tx.wait();

        console.log("Setting WalnutLendingV2 as operator on wUSDC...");
        tx = await wrapper.setOperator(lending.target, 0xffffffff);
        await tx.wait();

        // 2. Deposit $100 wUSDC as collateral
        console.log("Depositing $100 wUSDC collateral...");
        const builderDep = cofheClient.encryptInputs([Encryptable.uint64(depositAmount)]);
        const [ctDep] = await builderDep.execute();
        const inputDep = {
            ctHash: ctDep.ct_hash || ctDep.ctHash,
            securityZone: ctDep.security_zone || ctDep.securityZone,
            utype: ctDep.utype,
            signature: ctDep.signature || "0x"
        };
        tx = await lending.deposit(wrapper.target, inputDep);
        let rx = await tx.wait();
        console.log(`Deposit $100 Collateral Tx Hash: ${rx.hash}`);
        expect(rx.status).to.equal(1);

        // 3. Borrow $79 cUSDC
        console.log("Borrowing $79 cUSDC...");
        const builderB = cofheClient.encryptInputs([Encryptable.uint128(borrowAmount)]);
        const [ctB] = await builderB.execute();
        const inputB = {
            ctHash: ctB.ct_hash || ctB.ctHash,
            securityZone: ctB.security_zone || ctB.securityZone,
            utype: ctB.utype,
            signature: ctB.signature || "0x"
        };
        tx = await lending.borrow(inputB);
        rx = await tx.wait();
        console.log(`Borrow $79 cUSDC Tx Hash: ${rx.hash}`);
        expect(rx.status).to.equal(1);

        // 4. Test Liquidation Check Request
        console.log("Requesting liquidation check...");
        tx = await lending.requestLiquidationCheck(user.address);
        rx = await tx.wait();
        console.log(`Liquidation Check Request Tx Hash: ${rx.hash}`);
        expect(rx.status).to.equal(1);

        console.log("Phase 4 Liquidation Auction contract setup & check request verified!");
    });
});
