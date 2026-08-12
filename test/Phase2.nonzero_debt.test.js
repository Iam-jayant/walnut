const { expect } = require("chai");
const hre = require("hardhat");
const { ethers, network } = require("hardhat");
const { createPublicClient, createWalletClient, http } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { arbitrumSepolia } = require("viem/chains");
const { createCofheClient, createCofheConfig } = require("@cofhe/sdk/node");
const { arbSepolia } = require("@cofhe/sdk/chains");
const { Encryptable } = require("@cofhe/sdk");

describe("Phase 2: Nonzero Debt Health Factor Unit Scaling Vector (Arbitrum Sepolia)", function () {
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

        console.log("Deploying fresh WalnutLendingV2 for Nonzero Debt Vector...");
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

    it("Should execute Nonzero Debt Health Factor Scaling Vector", async function () {
        const depositAmount = 100n * 1000000n; // $100 wUSDC collateral (80% LTV = $80 max borrow)

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

        // 3. Borrow $79 cUSDC (Healthy: $79 <= $80 max limit at 80% LTV)
        console.log("Borrowing $79 cUSDC (Healthy: $79 <= $80 max limit)...");
        const borrow79Amount = 79n * 1000000n;
        const builderB79 = cofheClient.encryptInputs([Encryptable.uint128(borrow79Amount)]);
        const [ctB79] = await builderB79.execute();
        const inputB79 = {
            ctHash: ctB79.ct_hash || ctB79.ctHash,
            securityZone: ctB79.security_zone || ctB79.securityZone,
            utype: ctB79.utype,
            signature: ctB79.signature || "0x"
        };
        tx = await lending.borrow(inputB79);
        rx = await tx.wait();
        console.log(`Borrow $79 cUSDC (Healthy) Tx Hash: ${rx.hash}`);
        expect(rx.status).to.equal(1);

        // 4. Attempt to withdraw $25 wUSDC collateral while holding $79 debt
        // Remaining Collateral would be $75 -> Max Allowed Debt = $60.
        // Current Debt = $79 > $60 -> Unhealthy! Capped amount = 0, no collateral transferred.
        console.log("Attempting withdraw $25 wUSDC collateral with $79 debt (Unhealthy: remaining $75 col -> max debt $60)...");
        const withdraw25Amount = 25n * 1000000n;
        const builderW25 = cofheClient.encryptInputs([Encryptable.uint128(withdraw25Amount)]);
        const [ctW25] = await builderW25.execute();
        const inputW25 = {
            ctHash: ctW25.ct_hash || ctW25.ctHash,
            securityZone: ctW25.security_zone || ctW25.securityZone,
            utype: ctW25.utype,
            signature: ctW25.signature || "0x"
        };
        tx = await lending.withdraw(wrapper.target, inputW25);
        rx = await tx.wait();
        console.log(`Withdraw $25 Collateral Attempt Tx Hash: ${rx.hash}`);
        expect(rx.status).to.equal(1);

        // 5. Attempt to withdraw $1.00 wUSDC collateral while holding $79 debt
        // Remaining Collateral = $99.00 -> Max Allowed Debt = $99.00 * 0.8 = $79.20.
        // Current Debt = $79.00 <= $79.20 -> Healthy! Withdrawal of $1.00 wUSDC succeeds!
        console.log("Attempting withdraw $1.00 wUSDC collateral with $79 debt (Healthy: remaining $99 col -> max debt $79.20)...");
        const withdraw1Amount = 1n * 1000000n;
        const builderW1 = cofheClient.encryptInputs([Encryptable.uint128(withdraw1Amount)]);
        const [ctW1] = await builderW1.execute();
        const inputW1 = {
            ctHash: ctW1.ct_hash || ctW1.ctHash,
            securityZone: ctW1.security_zone || ctW1.securityZone,
            utype: ctW1.utype,
            signature: ctW1.signature || "0x"
        };
        tx = await lending.withdraw(wrapper.target, inputW1);
        rx = await tx.wait();
        console.log(`Withdraw $1.00 Collateral (Healthy) Tx Hash: ${rx.hash}`);
        expect(rx.status).to.equal(1);
    });
});
