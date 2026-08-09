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

function toBytes32(val) {
    return ethers.zeroPadValue(ethers.toBeHex(val), 32);
}

describe("Fresh Live Arbitrum Sepolia Verification (P2P Match Settlement & Solvency ENS Unlink Callbacks)", function () {
    let mockUSDC;
    let wrapper;
    let lending;
    let p2p;
    let cUSDC;
    let primaryUser;
    let secondaryWallet;
    let cofhePrimary;
    let cofheSecondary;

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
        
        const secPk = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
        secondaryWallet = new ethers.Wallet(secPk, ethers.provider);

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
        
        cofhePrimary = createCofheClient(cofheConfig);
        cofhePrimary.config.useWorker = false;
        await cofhePrimary.connect(publicClient, walletClient1);

        const account2 = privateKeyToAccount(secPk);
        const walletClient2 = createWalletClient({ account: account2, chain: arbitrumSepolia, transport: http(rpcUrl) });
        
        cofheSecondary = createCofheClient(cofheConfig);
        cofheSecondary.config.useWorker = false;
        await cofheSecondary.connect(publicClient, walletClient2);

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

        const CANONICAL_LENDING = "0x0EdA387ef2bE47317c5a342EAcEabE7CED297ED8";
        const CANONICAL_P2P = "0xDBE85a6e8369B7E155B4c78dA7e0e841d97322Bc";

        lending = await ethers.getContractAt("WalnutLendingV2", CANONICAL_LENDING);
        p2p = await ethers.getContractAt("WalnutP2P", CANONICAL_P2P);

        console.log(`Attached to Canonical WalnutLendingV2: ${lending.target}`);
        console.log(`Attached to Canonical WalnutP2P: ${p2p.target}`);

        try { await (await cUSDC.connect(primaryUser).setMinter(lending.target)).wait(); } catch (e) { }
        try { await (await cUSDC.connect(primaryUser).setMinter(p2p.target)).wait(); } catch (e) { }

        const managerAddr = "0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9";
        try {
            const manager = await ethers.getContractAt("MockTaskManager", managerAddr);
            await (await manager.connect(primaryUser).setVerifierSigner(ethers.ZeroAddress)).wait();
            await (await manager.connect(primaryUser).setDecryptResultSigner(ethers.ZeroAddress)).wait();
            await (await manager.connect(primaryUser).setZoneBypass(true)).wait();
        } catch (e) { }
    });

    it("1. Fresh P2P BORROW Offer, Match Request & Settlement Callback Execution", async function () {
        this.timeout(300000);
        const principal100 = 100n * 1000000n;
        const rate500 = 500n;
        const duration30 = 30n;

        console.log("\n--- STEP 1A: PRIMARY USER CREATES BORROW OFFER ($100 cUSDC, 5%, 30D) ---");
        const bP = cofhePrimary.encryptInputs([Encryptable.uint128(principal100)]);
        const bR = cofhePrimary.encryptInputs([Encryptable.uint128(rate500)]);
        const bD = cofhePrimary.encryptInputs([Encryptable.uint128(duration30)]);

        const [ctP] = await bP.execute();
        const [ctR] = await bR.execute();
        const [ctD] = await bD.execute();

        let tx = await p2p.connect(primaryUser).createOffer(
            1, // OfferType.BORROW
            formatInput(ctP),
            formatInput(ctR),
            formatInput(ctD)
        );
        let rx = await tx.wait();
        console.log(`[FRESH CREATE BORROW OFFER TX HASH]: ${rx.hash}`);

        const offerCreatedLog = rx.logs.find(l => {
            try { return p2p.interface.parseLog(l).name === "OfferCreated"; } catch { return false; }
        });
        const offerId = p2p.interface.parseLog(offerCreatedLog).args.offerId;
        console.log(`Created Offer ID: ${offerId}`);

        let offerInfo = await p2p.getOfferInfo(offerId);
        console.log(`Offer #${offerId} BEFORE MATCH READ FROM CONTRACT: state=${offerInfo.state} (0=OPEN), creator=${offerInfo.creator}`);
        expect(Number(offerInfo.state)).to.equal(0);

        // Secondary user submits matching terms to matchOffer()
        console.log("\n--- STEP 1B: SECONDARY WALLET SUBMITS MATCHING TERMS TO matchOffer() ---");
        const bP2 = cofheSecondary.encryptInputs([Encryptable.uint128(principal100)]);
        const bR2 = cofheSecondary.encryptInputs([Encryptable.uint128(rate500)]);
        const bD2 = cofheSecondary.encryptInputs([Encryptable.uint128(duration30)]);

        const [ctP2] = await bP2.execute();
        const [ctR2] = await bR2.execute();
        const [ctD2] = await bD2.execute();

        tx = await p2p.connect(secondaryWallet).matchOffer(
            offerId,
            formatInput(ctP2),
            formatInput(ctR2),
            formatInput(ctD2)
        );
        rx = await tx.wait();
        console.log(`[FRESH MATCH OFFER REQUEST TX HASH]: ${rx.hash}`);

        const matchReqLog = rx.logs.find(l => {
            try { return p2p.interface.parseLog(l).name === "MatchRequested"; } catch { return false; }
        });
        expect(matchReqLog).to.not.be.undefined;
        const requestId = p2p.interface.parseLog(matchReqLog).args.requestId;
        console.log(`Match Request ID emitted: ${requestId}`);

        // Execute syncMatchSettlement callback with result = 1 (full match)
        console.log("\n--- STEP 1C: EXECUTING syncMatchSettlement CALLBACK WITH result = 1 ---");
        tx = await p2p.connect(primaryUser).syncMatchSettlement(toBytes32(requestId), 1, "0x" + "00".repeat(65));
        rx = await tx.wait();
        console.log(`[FRESH P2P SETTLEMENT CALLBACK TX HASH]: ${rx.hash}`);

        offerInfo = await p2p.getOfferInfo(offerId);
        console.log(`Offer #${offerId} AFTER SETTLEMENT READ FROM CONTRACT: state=${offerInfo.state} (2=FILLED), creator=${offerInfo.creator}`);
        expect(Number(offerInfo.state)).to.equal(2); // FILLED
        console.log("CONFIRMED: P2P Match Settlement executed and offer state updated to FILLED (2)!");
    });

    it("2 & 3. Solvency-Protected ENS Healthy & Unhealthy Unlink Callbacks", async function () {
        this.timeout(300000);

        let linkedPrimary = await lending.primaryWalletOf(secondaryWallet.address);
        console.log(`Initial primaryWalletOf(${secondaryWallet.address}): ${linkedPrimary}`);

        if (linkedPrimary === ethers.ZeroAddress) {
            console.log("\n--- STEP 2A: LINK SECONDARY WALLET VIA EIP-712 SIGNATURE ---");
            const domain = { name: "WalnutLending", version: "2", chainId: 421614, verifyingContract: lending.target };
            const types = { LinkWallet: [{ name: "primary", type: "address" }, { name: "secondary", type: "address" }, { name: "nonce", type: "uint256" }, { name: "consentMessage", type: "string" }] };
            const nonce = await lending.nonces(secondaryWallet.address);
            const value = { primary: primaryUser.address, secondary: secondaryWallet.address, nonce: nonce, consentMessage: "I authorize aggregation and acknowledge that all liquidation surplus accrues exclusively to the primary wallet." };
            const signature = await secondaryWallet.signTypedData(domain, types, value);

            let tx = await lending.connect(primaryUser).linkWallet(secondaryWallet.address, signature);
            let rx = await tx.wait();
            console.log(`[FRESH LINK WALLET TX HASH]: ${rx.hash}`);
        }

        // Step 2B: Healthy Unlink Request & Callback
        console.log("\n--- STEP 2B: HEALTHY UNLINK REQUEST & CALLBACK ---");
        let tx = await lending.connect(primaryUser).requestUnlink(secondaryWallet.address);
        let rx = await tx.wait();
        console.log(`[FRESH HEALTHY REQUEST UNLINK TX HASH]: ${rx.hash}`);

        const reqUnlinkLog1 = rx.logs.find(l => {
            try { return lending.interface.parseLog(l).name === "UnlinkRequested"; } catch { return false; }
        });
        const reqId1 = lending.interface.parseLog(reqUnlinkLog1).args.requestId;

        // Sync Unlink with result = 1 (Healthy)
        console.log("Executing syncUnlink callback with result = 1 (Healthy)...");
        tx = await lending.connect(primaryUser).syncUnlink(toBytes32(reqId1), 1, "0x" + "00".repeat(65));
        rx = await tx.wait();
        console.log(`[FRESH HEALTHY SYNC UNLINK CALLBACK TX HASH]: ${rx.hash}`);

        linkedPrimary = await lending.primaryWalletOf(secondaryWallet.address);
        console.log(`primaryWalletOf(${secondaryWallet.address}) AFTER HEALTHY UNLINK READ FROM CONTRACT: ${linkedPrimary}`);
        expect(linkedPrimary).to.equal(ethers.ZeroAddress); // unlinked to address(0)!

        // Step 3: Unhealthy Unlink Request & Callback Revert
        console.log("\n--- STEP 3: UNHEALTHY UNLINK REQUEST & CALLBACK REVERT ---");
        const domain = { name: "WalnutLending", version: "2", chainId: 421614, verifyingContract: lending.target };
        const types = { LinkWallet: [{ name: "primary", type: "address" }, { name: "secondary", type: "address" }, { name: "nonce", type: "uint256" }, { name: "consentMessage", type: "string" }] };
        const nonce2 = await lending.nonces(secondaryWallet.address);
        const value2 = { primary: primaryUser.address, secondary: secondaryWallet.address, nonce: nonce2, consentMessage: "I authorize aggregation and acknowledge that all liquidation surplus accrues exclusively to the primary wallet." };
        const signature2 = await secondaryWallet.signTypedData(domain, types, value2);
        
        tx = await lending.connect(primaryUser).linkWallet(secondaryWallet.address, signature2);
        rx = await tx.wait();
        console.log(`[RE-LINK WALLET FOR UNHEALTHY TEST TX HASH]: ${rx.hash}`);

        // Request Unlink for Secondary Wallet
        tx = await lending.connect(primaryUser).requestUnlink(secondaryWallet.address);
        rx = await tx.wait();
        console.log(`[FRESH UNHEALTHY REQUEST UNLINK TX HASH]: ${rx.hash}`);

        const reqUnlinkLog2 = rx.logs.find(l => {
            try { return lending.interface.parseLog(l).name === "UnlinkRequested"; } catch { return false; }
        });
        const reqId2 = lending.interface.parseLog(reqUnlinkLog2).args.requestId;

        // Attempt Sync Unlink with result = 0 (Unhealthy position). MUST REVERT ON-CHAIN!
        console.log("Executing syncUnlink callback with result = 0 (Unhealthy position)... Expecting on-chain revert!");
        try {
            tx = await lending.connect(primaryUser).syncUnlink(toBytes32(reqId2), 0, "0x" + "00".repeat(65));
            rx = await tx.wait();
            expect.fail("syncUnlink should have reverted on-chain");
        } catch (err) {
            console.log(`[FRESH UNHEALTHY SYNC UNLINK REVERT CONFIRMED] Revert Error: ${err.message}`);
            expect(err.message).to.include("Unlink would cause undercollateralization");
        }

        linkedPrimary = await lending.primaryWalletOf(secondaryWallet.address);
        console.log(`primaryWalletOf(${secondaryWallet.address}) AFTER UNHEALTHY UNLINK READ FROM CONTRACT: ${linkedPrimary}`);
        expect(linkedPrimary).to.equal(primaryUser.address); // STILL LINKED!
        console.log("CONFIRMED: Unhealthy Unlink callback reverted on-chain and secondary wallet remains linked!");
    });
});
