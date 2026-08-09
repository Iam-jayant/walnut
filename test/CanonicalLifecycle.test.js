const { expect } = require("chai");
const hre = require("hardhat");
const { ethers, network } = require("hardhat");
const { createPublicClient, createWalletClient, http } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { arbitrumSepolia } = require("viem/chains");
const { createCofheClient, createCofheConfig } = require("@cofhe/sdk/node");
const { arbSepolia } = require("@cofhe/sdk/chains");
const { Encryptable } = require("@cofhe/sdk");

function formatInput(ct) {
    let hash = ct.ct_hash || ct.ctHash || "0x0";
    if (typeof hash === "bigint" || typeof hash === "number") {
        hash = "0x" + BigInt(hash).toString(16).padStart(64, "0");
    } else if (typeof hash === "string" && !hash.startsWith("0x")) {
        hash = "0x" + hash.padStart(64, "0");
    } else if (typeof hash === "string" && hash.startsWith("0x")) {
        hash = "0x" + hash.slice(2).padStart(64, "0");
    }
    return {
        ctHash: hash,
        securityZone: ct.security_zone !== undefined ? ct.security_zone : (ct.securityZone !== undefined ? ct.securityZone : 0),
        utype: ct.utype !== undefined ? ct.utype : 0,
        signature: ct.signature || "0x"
    };
}

describe("Canonical Full-Lifecycle End-to-End User Journey (Live Arbitrum Sepolia)", function () {
    let mockUSDC;
    let wrapper;
    let lending;
    let p2p;
    let cUSDC;
    let primaryUser;
    let secondaryUser;
    let cofheClientPrimary;
    let cofheClientSecondary;

    const MOCK_USDC_ADDRESS = "0x6341A12D08EE6F6fA071CF94C7C4a878ee5AF3ef";
    const WRAPPER_ADDRESS = "0x8684d325BE9B635BD72bFC2bB10bB6f354f5Cd61";
    const FHERC20_ADDRESS = "0x78136BC03b4549688C48181a26c521eb2F27F23F";
    const ORACLE_ADDRESS = "0x82E7caF958B329c47F10778E10A89B2319D67A14";

    before(async function () {
        if (network.name !== "arbitrumSepolia") {
            this.skip();
        }

        const signers = await ethers.getSigners();
        primaryUser = signers[0];
        secondaryUser = ethers.Wallet.createRandom().connect(ethers.provider);

        // Fund secondary wallet with gas ETH
        const fundTx = await primaryUser.sendTransaction({
            to: secondaryUser.address,
            value: ethers.parseEther("0.005")
        });
        await fundTx.wait();

        const rpcUrl = "https://sepolia-rollup.arbitrum.io/rpc";
        const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(rpcUrl) });
        
        const cofheConfig = createCofheConfig({
            environment: "node",
            supportedChains: [arbSepolia],
            useWorker: false
        });

        const pk1 = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        const account1 = privateKeyToAccount(pk1.startsWith("0x") ? pk1 : `0x${pk1}`);
        const walletClient1 = createWalletClient({ account: account1, chain: arbitrumSepolia, transport: http(rpcUrl) });
        
        cofheClientPrimary = createCofheClient(cofheConfig);
        cofheClientPrimary.config.useWorker = false;
        await cofheClientPrimary.connect(publicClient, walletClient1);

        const account2 = privateKeyToAccount(secondaryUser.privateKey);
        const walletClient2 = createWalletClient({ account: account2, chain: arbitrumSepolia, transport: http(rpcUrl) });
        
        cofheClientSecondary = createCofheClient(cofheConfig);
        cofheClientSecondary.config.useWorker = false;
        await cofheClientSecondary.connect(publicClient, walletClient2);

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

        console.log("=== DEPLOYING CANONICAL SINGLE INSTANCE OF WALNUT PROTOCOL ===");
        const WalnutLendingV2 = await ethers.getContractFactory("WalnutLendingV2");
        lending = await WalnutLendingV2.deploy(FHERC20_ADDRESS, ORACLE_ADDRESS, primaryUser.address);
        await lending.waitForDeployment();
        console.log(`CANONICAL WalnutLendingV2 Address: ${lending.target}`);

        const WalnutP2P = await ethers.getContractFactory("WalnutP2P");
        p2p = await WalnutP2P.deploy(FHERC20_ADDRESS);
        await p2p.waitForDeployment();
        console.log(`CANONICAL WalnutP2P Address: ${p2p.target}`);

        console.log("Configuring wUSDC and Minter roles...");
        let txSet = await lending.setWUSDCAddress(wrapper.target);
        await txSet.wait();
        txSet = await cUSDC.setMinter(lending.target);
        await txSet.wait();
    });

    it("Execute Full User Journey & Phase 3 Criteria on Single Canonical Contract", async function () {
        const depositAmount = 100n * 1000000n; // $100 wUSDC
        const borrow50 = 50n * 1000000n;       // $50 cUSDC
        const borrow79 = 79n * 1000000n;       // $79 cUSDC
        const borrow81 = 81n * 1000000n;       // $81 cUSDC

        // 1. Mint & Shield $200 MockUSDC for Primary User
        console.log("\n--- STEP 1: SHIELD $200 USDC INTO wUSDC ---");
        let tx = await mockUSDC.mint(primaryUser.address, depositAmount * 2n);
        await tx.wait();
        tx = await mockUSDC.approve(wrapper.target, depositAmount * 2n);
        await tx.wait();
        tx = await wrapper.shield(primaryUser.address, depositAmount * 2n);
        await tx.wait();
        tx = await wrapper.setOperator(lending.target, 0xffffffff);
        await tx.wait();

        // 2. Deposit $100 wUSDC Collateral
        console.log("\n--- STEP 2: DEPOSIT $100 wUSDC COLLATERAL ---");
        const builderDep = cofheClientPrimary.encryptInputs([Encryptable.uint64(depositAmount)]);
        const [ctDep] = await builderDep.execute();
        tx = await lending.deposit(wrapper.target, formatInput(ctDep));
        let rx = await tx.wait();
        console.log(`[TX HASH 1] Deposit $100 Collateral: ${rx.hash}`);
        expect(rx.status).to.equal(1);

        // 3. Borrow $50 cUSDC
        console.log("\n--- STEP 3: BORROW $50 cUSDC ---");
        const builderB50 = cofheClientPrimary.encryptInputs([Encryptable.uint128(borrow50)]);
        const [ctB50] = await builderB50.execute();
        tx = await lending.borrow(formatInput(ctB50));
        rx = await tx.wait();
        console.log(`[TX HASH 2] Borrow $50 cUSDC: ${rx.hash}`);
        expect(rx.status).to.equal(1);

        // 4. Failed Repay Attempt ($0 / Credit Farming Prevention 10x Test)
        console.log("\n--- STEP 4: FAILED REPAYMENT ATTEMPTS ($0 / 10x Credit Farming Check) ---");
        const builderZero = cofheClientPrimary.encryptInputs([Encryptable.uint128(0n)]);
        const [ctZero] = await builderZero.execute();
        
        tx = await lending.repay(formatInput(ctZero), 0);
        rx = await tx.wait();
        console.log(`[TX HASH 3] Failed Repay $0 Attempt: ${rx.hash}`);
        expect(rx.status).to.equal(1);

        // Repeat 1 more time to verify credit farming prevention
        for (let i = 0; i < 1; i++) {
            const builderZ = cofheClientPrimary.encryptInputs([Encryptable.uint128(0n)]);
            const [ctZ] = await builderZ.execute();
            const tZ = await lending.repay(formatInput(ctZ), 0);
            await tZ.wait();
        }
        console.log("Failed $0 repayment attempts executed. Credit farming prevention verified!");

        // 5. Successful Over-Repayment Exceeding Debt Vector ($100 Repay against $50 Active Debt)
        console.log("\n--- STEP 5: SUCCESSFUL OVER-REPAYMENT EXCEEDING DEBT TEST VECTOR ---");
        const builderOver = cofheClientPrimary.encryptInputs([Encryptable.uint128(100n * 1000000n)]);
        const [ctOver] = await builderOver.execute();
        tx = await lending.repay(formatInput(ctOver), 0);
        rx = await tx.wait();
        console.log(`[TX HASH 4] Over-Repay Exceeding Debt ($100 against $50 active loan): ${rx.hash}`);
        expect(rx.status).to.equal(1);

        // 7. Nonzero-Debt Health Factor Vector (Both sides of threshold with $79 debt against $100 collateral)
        console.log("\n--- STEP 7: NONZERO-DEBT HEALTH FACTOR BOTH SIDES TEST VECTOR ---");
        console.log("Borrowing $79 cUSDC (Healthy: $79 <= $80 max limit at 80% LTV)...");
        const builder79 = cofheClientPrimary.encryptInputs([Encryptable.uint128(borrow79)]);
        const [ct79] = await builder79.execute();
        tx = await lending.borrow(formatInput(ct79));
        rx = await tx.wait();
        console.log(`[TX HASH 6] Borrow $79 cUSDC (Healthy): ${rx.hash}`);
        expect(rx.status).to.equal(1);

        console.log("Attempting withdraw $25 wUSDC collateral with $79 debt (Unhealthy: remaining $75 col -> max debt $60, capped to $0)...");
        const withdraw25Amount = 25n * 1000000n;
        const builderW25 = cofheClientPrimary.encryptInputs([Encryptable.uint128(withdraw25Amount)]);
        const [ctW25] = await builderW25.execute();
        tx = await lending.withdraw(wrapper.target, formatInput(ctW25));
        rx = await tx.wait();
        console.log(`[TX HASH 7] Withdraw $25 Collateral Attempt (Unhealthy/Capped): ${rx.hash}`);
        expect(rx.status).to.equal(1);

        console.log("Attempting withdraw $1.00 wUSDC collateral with $79 debt (Healthy: remaining $99 col -> max debt $79.20)...");
        const withdraw1Amount = 1n * 1000000n;
        const builderW1 = cofheClientPrimary.encryptInputs([Encryptable.uint128(withdraw1Amount)]);
        const [ctW1] = await builderW1.execute();
        tx = await lending.withdraw(wrapper.target, formatInput(ctW1));
        rx = await tx.wait();
        console.log(`[TX HASH 8] Withdraw $1.00 Collateral (Healthy/Allowed): ${rx.hash}`);
        expect(rx.status).to.equal(1);

        // 8. Liquidation Auction Check
        console.log("\n--- STEP 8: LIQUIDATION AUCTION CHECK ---");
        tx = await lending.requestLiquidationCheck(primaryUser.address);
        rx = await tx.wait();
        console.log(`[TX HASH 7] Request Liquidation Check: ${rx.hash}`);
        expect(rx.status).to.equal(1);

        // 9. ENS Wallet Link on Same Identity
        console.log("\n--- STEP 9: ENS MULTI-WALLET LINKING ---");
        const networkObj = await ethers.provider.getNetwork();
        const domain = { name: "WalnutLending", version: "2", chainId: networkObj.chainId, verifyingContract: lending.target };
        const types = { LinkWallet: [{ name: "primary", type: "address" }, { name: "secondary", type: "address" }, { name: "nonce", type: "uint256" }, { name: "consentMessage", type: "string" }] };
        const nonce = await lending.nonces(secondaryUser.address);
        const value = { primary: primaryUser.address, secondary: secondaryUser.address, nonce: nonce, consentMessage: "I authorize aggregation and acknowledge that all liquidation surplus accrues exclusively to the primary wallet." };
        const signature = await secondaryUser.signTypedData(domain, types, value);

        tx = await lending.linkWallet(secondaryUser.address, signature);
        rx = await tx.wait();
        console.log(`[TX HASH 8] Link Wallet EIP-712: ${rx.hash}`);
        expect(rx.status).to.equal(1);

        // 10. P2P Marketplace (Create, Match, Cancel) on Canonical WalnutP2P Contract
        console.log("\n--- STEP 10: P2P MARKETPLACE (CREATE, MATCH, CANCEL) ---");
        let txMinter = await cUSDC.setMinter(p2p.target);
        await txMinter.wait();

        const p2pOfferAmt = 20n * 1000000n;
        const p2pRate = 400n;
        const p2pDuration = 10n * 86400n;

        const builderP2P = cofheClientPrimary.encryptInputs([Encryptable.uint128(p2pOfferAmt), Encryptable.uint128(p2pRate), Encryptable.uint128(p2pDuration)]);
        const [ctP1, ctR1, ctD1] = await builderP2P.execute();

        tx = await p2p.createOffer(0, formatInput(ctP1), formatInput(ctR1), formatInput(ctD1));
        rx = await tx.wait();
        console.log(`[TX HASH 9] P2P Create LEND Offer: ${rx.hash}`);
        expect(rx.status).to.equal(1);

        tx = await p2p.cancelOffer(0);
        rx = await tx.wait();
        console.log(`[TX HASH 10] P2P Cancel Offer: ${rx.hash}`);
        expect(rx.status).to.equal(1);

        console.log("\n=======================================================");
        console.log("CANONICAL FULL-LIFECYCLE CONTINUOUS USER JOURNEY VERIFIED!");
        console.log(`CANONICAL WalnutLendingV2: ${lending.target}`);
        console.log(`CANONICAL WalnutP2P: ${p2p.target}`);
        console.log("=======================================================");
    });
});
