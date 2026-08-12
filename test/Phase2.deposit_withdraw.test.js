const { expect } = require("chai");
const hre = require("hardhat");
const { ethers, network } = require("hardhat");
const { createPublicClient, createWalletClient, http } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { arbitrumSepolia } = require("viem/chains");
const { createCofheClient, createCofheConfig } = require("@cofhe/sdk/node");
const { arbSepolia } = require("@cofhe/sdk/chains");
const { Encryptable } = require("@cofhe/sdk");

describe("Phase 2: Deposit and Withdraw (Live Arbitrum Sepolia)", function () {
    let mockUSDC;
    let wrapper;
    let lending;
    let user;
    let cofheClient;

    const MOCK_USDC_ADDRESS = "0x6341A12D08EE6F6fA071CF94C7C4a878ee5AF3ef";
    const WRAPPER_ADDRESS = "0x8684d325BE9B635BD72bFC2bB10bB6f354f5Cd61"; // Deployed in Phase 1
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
            ["function mint(address to, uint256 amount) external", "function approve(address spender, uint256 amount) external returns (bool)", "function balanceOf(address account) external view returns (uint256)"],
            MOCK_USDC_ADDRESS
        );

        wrapper = await ethers.getContractAt(
            ["function shield(address to, uint256 amount) external returns (uint256)", "function setOperator(address operator, uint48 until) external", "function confidentialBalanceOf(address) external view returns (uint256)"],
            WRAPPER_ADDRESS
        );

        // Deploy fresh WalnutLendingV2
        console.log("Deploying fresh WalnutLendingV2...");
        const WalnutLendingV2 = await ethers.getContractFactory("WalnutLendingV2");
        lending = await WalnutLendingV2.deploy(FHERC20_ADDRESS, ORACLE_ADDRESS, user.address);
        await lending.waitForDeployment();
        console.log(`WalnutLendingV2 deployed at: ${lending.target}`);

        // Set wUSDC address
        console.log("Setting wUSDC address...");
        const txSet = await lending.setWUSDCAddress(wrapper.target);
        await txSet.wait();
    });

    it("Should deposit wUSDC as collateral (Raw Units)", async function () {
        const amountPlaintext = 100n * 1000000n; // 100 USDC

        // 1. Mint & Approve MockUSDC
        console.log("Minting MockUSDC...");
        let tx = await mockUSDC.mint(user.address, amountPlaintext);
        await tx.wait();
        
        console.log("Approving wrapper...");
        tx = await mockUSDC.approve(wrapper.target, amountPlaintext);
        await tx.wait();

        // 2. Shield MockUSDC into wUSDC
        console.log("Shielding MockUSDC into wUSDC...");
        tx = await wrapper.shield(user.address, amountPlaintext);
        await tx.wait();

        // 3. Set Lending contract as Operator on wUSDC
        console.log("Setting WalnutLendingV2 as operator on wUSDC...");
        tx = await wrapper.setOperator(lending.target, 0xffffffff); // max uint48 is enough
        await tx.wait();

        // 4. Deposit into WalnutLendingV2
        console.log("Encrypting deposit amount...");
        const builderA = cofheClient.encryptInputs([Encryptable.uint64(amountPlaintext)]);
        const [ctA] = await builderA.execute();
        const inputA = {
            ctHash: ctA.ct_hash || ctA.ctHash,
            securityZone: ctA.security_zone || ctA.securityZone,
            utype: ctA.utype,
            signature: ctA.signature || "0x"
        };

        console.log("Depositing wUSDC to WalnutLendingV2...");
        try {
            tx = await lending.deposit(wrapper.target, inputA);
            const receipt = await tx.wait();
            console.log(`Deposit Transaction Hash: ${receipt.hash}`);
            expect(receipt.status).to.equal(1);
        } catch (error) {
            console.log("DEPOSIT ERROR DATA:", error.data || (error.error && error.error.data) || (error.info && error.info.error && error.info.error.data));
            console.log("DEPOSIT ERROR:", error);
            throw error;
        }
    });

    it("Should withdraw wUSDC collateral (Raw Units)", async function () {
        const withdrawAmountPlaintext = 100n * 1000000n; // 100 USDC
        
        console.log("Encrypting withdraw amount...");
        const builderW = cofheClient.encryptInputs([Encryptable.uint128(withdrawAmountPlaintext)]);
        const [ctW] = await builderW.execute();
        const inputW = {
            ctHash: ctW.ct_hash || ctW.ctHash,
            securityZone: ctW.security_zone || ctW.securityZone,
            utype: ctW.utype,
            signature: ctW.signature || "0x"
        };

        console.log("Withdrawing wUSDC from WalnutLendingV2...");
        const tx = await lending.withdraw(wrapper.target, inputW);
        const receipt = await tx.wait();
        
        console.log(`Withdraw Transaction Hash: ${receipt.hash}`);
        expect(receipt.status).to.equal(1);
    });
});
