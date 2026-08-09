const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = require("hardhat");

describe("Final Callback Verification: P2P Match Settlement & ENS Solvency Unlink", function () {
    let mockUSDC;
    let wrapper;
    let lending;
    let p2p;
    let cUSDC;
    let manager;
    let primaryUser;
    let secondaryUser;

    function toBytes32(val) {
        return ethers.zeroPadValue(ethers.toBeHex(val), 32);
    }

    before(async function () {
        const signers = await ethers.getSigners();
        primaryUser = signers[0];
        secondaryUser = signers[1];

        // Deploy fresh test environment contracts
        const MockERC20 = await ethers.getContractFactory("MockUSDC");
        mockUSDC = await MockERC20.deploy();
        await mockUSDC.waitForDeployment();

        const WalnutFHERC20 = await ethers.getContractFactory("WalnutFHERC20");
        cUSDC = await WalnutFHERC20.deploy();
        await cUSDC.waitForDeployment();

        const WalnutOracle = await ethers.getContractFactory("WalnutPriceOracle");
        const oracle = await WalnutOracle.deploy();
        await oracle.waitForDeployment();

        const MockFeed = await ethers.getContractFactory("MockUSDCPriceFeed");
        const feed = await MockFeed.deploy();
        await feed.waitForDeployment();
        await oracle.setPriceFeed(mockUSDC.target, feed.target);

        const WalnutWrapper = await ethers.getContractFactory("WalnutVaultWrapper");
        wrapper = await WalnutWrapper.deploy(mockUSDC.target);
        await wrapper.waitForDeployment();

        const WalnutLendingV2 = await ethers.getContractFactory("WalnutLendingV2");
        lending = await WalnutLendingV2.deploy(cUSDC.target, oracle.target, primaryUser.address);
        await lending.waitForDeployment();

        const WalnutP2P = await ethers.getContractFactory("WalnutP2P");
        p2p = await WalnutP2P.deploy(cUSDC.target);
        await p2p.waitForDeployment();

        await lending.setWUSDCAddress(wrapper.target);
        await cUSDC.setMinter(primaryUser.address);
        await cUSDC.setMinter(secondaryUser.address);
        await cUSDC.setMinter(lending.target);
        await cUSDC.setMinter(p2p.target);

        // Configure MockTaskManager to bypass signatures for callback test
        const managerAddr = "0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9";
        try {
            manager = await ethers.getContractAt("MockTaskManager", managerAddr);
            await (await manager.connect(primaryUser).setVerifierSigner(ethers.ZeroAddress)).wait();
            await (await manager.connect(primaryUser).setDecryptResultSigner(ethers.ZeroAddress)).wait();
            await (await manager.connect(primaryUser).setZoneBypass(true)).wait();
        } catch (e) { }
    });

    it("1. Complete P2P Match & Settlement Callback Execution", async function () {
        const principal100 = 100n * 1000000n;
        const rate500 = 500n;
        const duration30 = 30n;

        // Primary user creates BORROW offer
        console.log("\n--- STEP 1A: PRIMARY USER CREATES BORROW OFFER ($100 cUSDC, 5%, 30D) ---");
        let tx = await p2p.connect(primaryUser).createOfferPlaintext(1, principal100, rate500, duration30); // 1 = BORROW
        let rx = await tx.wait();
        console.log(`[P2P CREATE BORROW OFFER TX HASH]: ${rx.hash}`);

        let offerInfo = await p2p.getOfferInfo(0);
        console.log(`Offer #0 BEFORE MATCH READ FROM CONTRACT: state=${offerInfo.state} (0=OPEN), creator=${offerInfo.creator}`);
        expect(Number(offerInfo.state)).to.equal(0);

        // Secondary user (Lender) shields $100 cUSDC into WalnutWrapper
        console.log("\n--- STEP 1B: SECONDARY USER SHIELDS cUSDC AND CALLS matchOffer ---");
        await (await mockUSDC.mint(secondaryUser.address, principal100)).wait();
        await (await mockUSDC.connect(secondaryUser).approve(wrapper.target, principal100)).wait();
        await (await wrapper.connect(secondaryUser).shield(secondaryUser.address, principal100)).wait();

        // Secondary user calls matchOfferPlaintext()
        tx = await p2p.connect(secondaryUser).matchOfferPlaintext(0, principal100, rate500, duration30);
        rx = await tx.wait();
        console.log(`[P2P MATCH OFFER REQUEST TX HASH]: ${rx.hash}`);

        const matchReqLog = rx.logs.find(l => {
            try { return p2p.interface.parseLog(l)?.name === "MatchRequested"; } catch { return false; }
        });
        expect(matchReqLog).to.not.be.undefined;
        const requestId = p2p.interface.parseLog(matchReqLog).args.requestId;
        console.log(`Match Request ID emitted: ${requestId}`);

        // Execute syncMatchSettlement callback with fullMatch = 1
        console.log("\n--- STEP 1C: EXECUTING syncMatchSettlement CALLBACK WITH decrypted result = 1 ---");
        tx = await p2p.connect(primaryUser).syncMatchSettlement(toBytes32(requestId), 1, "0x" + "00".repeat(65));
        rx = await tx.wait();
        console.log(`[P2P SETTLEMENT CALLBACK TX HASH]: ${rx.hash}`);

        offerInfo = await p2p.getOfferInfo(0);
        console.log(`Offer #0 AFTER SETTLEMENT READ FROM CONTRACT: state=${offerInfo.state} (2=FILLED), creator=${offerInfo.creator}`);
        expect(Number(offerInfo.state)).to.equal(2); // FILLED
        console.log("CONFIRMED: P2P Match Settlement finalized and state updated to FILLED!");
    });

    it("2. Solvency-Protected ENS Healthy Unlink Callback", async function () {
        console.log("\n--- STEP 2A: LINK SECONDARY WALLET VIA EIP-712 SIGNATURE ---");
        const networkObj = await ethers.provider.getNetwork();
        const domain = { name: "WalnutLending", version: "2", chainId: networkObj.chainId, verifyingContract: lending.target };
        const types = { LinkWallet: [{ name: "primary", type: "address" }, { name: "secondary", type: "address" }, { name: "nonce", type: "uint256" }, { name: "consentMessage", type: "string" }] };
        const nonce = await lending.nonces(secondaryUser.address);
        const value = { primary: primaryUser.address, secondary: secondaryUser.address, nonce: nonce, consentMessage: "I authorize aggregation and acknowledge that all liquidation surplus accrues exclusively to the primary wallet." };
        const signature = await secondaryUser.signTypedData(domain, types, value);

        let tx = await lending.connect(primaryUser).linkWallet(secondaryUser.address, signature);
        let rx = await tx.wait();
        console.log(`[LINK WALLET EIP-712 TX HASH]: ${rx.hash}`);

        let linkedPrimary = await lending.primaryWalletOf(secondaryUser.address);
        console.log(`primaryWalletOf(${secondaryUser.address}) AFTER LINK: ${linkedPrimary}`);
        expect(linkedPrimary).to.equal(primaryUser.address);

        // Healthy Unlink: Primary wallet calls requestUnlink(secondary)
        console.log("\n--- STEP 2B: HEALTHY REQUEST UNLINK ATTEMPT ---");
        tx = await lending.connect(primaryUser).requestUnlink(secondaryUser.address);
        rx = await tx.wait();
        console.log(`[HEALTHY REQUEST UNLINK TX HASH]: ${rx.hash}`);

        const unlinkLog = rx.logs.find(l => {
            try { return lending.interface.parseLog(l)?.name === "UnlinkRequested"; } catch { return false; }
        });
        expect(unlinkLog).to.not.be.undefined;
        const requestId = lending.interface.parseLog(unlinkLog).args.requestId;
        console.log(`Unlink Request ID emitted: ${requestId}`);

        // Execute syncUnlink callback with result = 1 (Healthy)
        console.log("\n--- STEP 2C: EXECUTING syncUnlink CALLBACK WITH result = 1 (Healthy) ---");
        tx = await lending.connect(primaryUser).syncUnlink(toBytes32(requestId), 1, "0x" + "00".repeat(65));
        rx = await tx.wait();
        console.log(`[HEALTHY SYNC UNLINK CALLBACK TX HASH]: ${rx.hash}`);

        linkedPrimary = await lending.primaryWalletOf(secondaryUser.address);
        console.log(`primaryWalletOf(${secondaryUser.address}) AFTER HEALTHY UNLINK READ FROM CONTRACT: ${linkedPrimary}`);
        expect(linkedPrimary).to.equal(ethers.ZeroAddress);
        console.log("CONFIRMED: Healthy Unlink callback executed and secondary wallet unlinked to address(0)!");
    });

    it("3. Solvency-Protected ENS Unhealthy Unlink Callback Revert", async function () {
        console.log("\n--- STEP 3A: RE-LINK SECONDARY WALLET ---");
        const networkObj = await ethers.provider.getNetwork();
        const domain = { name: "WalnutLending", version: "2", chainId: networkObj.chainId, verifyingContract: lending.target };
        const types = { LinkWallet: [{ name: "primary", type: "address" }, { name: "secondary", type: "address" }, { name: "nonce", type: "uint256" }, { name: "consentMessage", type: "string" }] };
        const nonce = await lending.nonces(secondaryUser.address);
        const value = { primary: primaryUser.address, secondary: secondaryUser.address, nonce: nonce, consentMessage: "I authorize aggregation and acknowledge that all liquidation surplus accrues exclusively to the primary wallet." };
        const signature = await secondaryUser.signTypedData(domain, types, value);

        let tx = await lending.connect(primaryUser).linkWallet(secondaryUser.address, signature);
        let rx = await tx.wait();
        console.log(`[RE-LINK WALLET TX HASH]: ${rx.hash}`);

        // Primary wallet requests unlink for secondary wallet when removing secondary collateral leaves position unhealthy
        console.log("\n--- STEP 3B: UNHEALTHY REQUEST UNLINK ATTEMPT ---");
        tx = await lending.connect(primaryUser).requestUnlink(secondaryUser.address);
        rx = await tx.wait();
        console.log(`[UNHEALTHY REQUEST UNLINK TX HASH]: ${rx.hash}`);

        const unlinkLog = rx.logs.find(l => {
            try { return lending.interface.parseLog(l)?.name === "UnlinkRequested"; } catch { return false; }
        });
        expect(unlinkLog).to.not.be.undefined;
        const requestId = lending.interface.parseLog(unlinkLog).args.requestId;
        console.log(`Unhealthy Unlink Request ID emitted: ${requestId}`);

        // Execute syncUnlink callback with result = 0 (Unhealthy: unlinking drops collateral below threshold). MUST REVERT!
        console.log("\n--- STEP 3C: EXECUTING syncUnlink CALLBACK WITH result = 0 (Unhealthy position) ---");
        try {
            tx = await lending.connect(primaryUser).syncUnlink(toBytes32(requestId), 0, "0x" + "00".repeat(65));
            rx = await tx.wait();
            expect.fail("syncUnlink should have reverted on-chain when result == 0");
        } catch (err) {
            console.log(`[UNHEALTHY SYNC UNLINK REVERT CONFIRMED] Revert Reason: ${err.message}`);
            expect(err.message).to.include("Unlink would cause undercollateralization");
        }

        let linkedPrimary = await lending.primaryWalletOf(secondaryUser.address);
        console.log(`primaryWalletOf(${secondaryUser.address}) AFTER UNHEALTHY UNLINK READ FROM CONTRACT: ${linkedPrimary}`);
        expect(linkedPrimary).to.equal(primaryUser.address); // STILL LINKED!
        console.log("CONFIRMED: Unhealthy Unlink callback reverted on-chain and secondary wallet remains linked!");
    });
});
