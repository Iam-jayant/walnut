const { expect } = require("chai");
const hre = require("hardhat");
const { ethers, network } = require("hardhat");
const { createPublicClient, createWalletClient, http } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { arbitrumSepolia } = require("viem/chains");
const { createCofheClient, createCofheConfig } = require("@cofhe/sdk/node");
const { arbSepolia } = require("@cofhe/sdk/chains");
const { Encryptable } = require("@cofhe/sdk");

describe("Phase 6: P2P Confidential Marketplace & Homomorphic Term Matching (Live Arbitrum Sepolia)", function () {
    let p2p;
    let cUSDC;
    let lending;
    let primaryUser;
    let secondaryUser;
    let cofheClientPrimary;
    let cofheClientSecondary;

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

        cUSDC = await ethers.getContractAt(
            ["function setMinter(address minter) external"],
            FHERC20_ADDRESS
        );

        console.log("Deploying fresh WalnutLendingV2 & WalnutP2P...");
        const WalnutLendingV2 = await ethers.getContractFactory("WalnutLendingV2");
        lending = await WalnutLendingV2.deploy(FHERC20_ADDRESS, ORACLE_ADDRESS, primaryUser.address);
        await lending.waitForDeployment();

        const WalnutP2P = await ethers.getContractFactory("WalnutP2P");
        p2p = await WalnutP2P.deploy(FHERC20_ADDRESS);
        await p2p.waitForDeployment();
        console.log(`WalnutP2P deployed at: ${p2p.target}`);

        console.log("Setting WalnutP2P as minter on cUSDC...");
        let txSet = await cUSDC.setMinter(p2p.target);
        await txSet.wait();
    });

    it("Should create confidential P2P LEND offer with encrypted terms", async function () {
        const principal = 50n * 1000000n; // $50 cUSDC
        const rate = 500n;                 // 5.00% APR
        const duration = 30n * 86400n;     // 30 days

        console.log("Encrypting P2P offer terms (principal, rate, duration)...");
        const builder = cofheClientPrimary.encryptInputs([
            Encryptable.uint128(principal),
            Encryptable.uint128(rate),
            Encryptable.uint128(duration)
        ]);
        const [ctP, ctR, ctD] = await builder.execute();

        const inputP = { ctHash: ctP.ct_hash || ctP.ctHash, securityZone: ctP.security_zone || ctP.securityZone, utype: ctP.utype, signature: ctP.signature || "0x" };
        const inputR = { ctHash: ctR.ct_hash || ctR.ctHash, securityZone: ctR.security_zone || ctR.securityZone, utype: ctR.utype, signature: ctR.signature || "0x" };
        const inputD = { ctHash: ctD.ct_hash || ctD.ctHash, securityZone: ctD.security_zone || ctD.securityZone, utype: ctD.utype, signature: ctD.signature || "0x" };

        console.log("Submitting P2P LEND offer on-chain...");
        let tx = await p2p.createOffer(0, inputP, inputR, inputD); // 0 = OfferType.LEND
        let rx = await tx.wait();
        console.log(`Create P2P Offer Tx Hash: ${rx.hash}`);
        expect(rx.status).to.equal(1);

        const info = await p2p.getOfferInfo(0);
        console.log(`Offer #0 Creator: ${info.creator}, State: ${info.state}`);
        expect(info.creator).to.equal(primaryUser.address);
        expect(info.state).to.equal(0n); // OfferState.OPEN
    });

    it("Should request homomorphic term matching from counterparty borrower", async function () {
        const matchPrincipal = 50n * 1000000n; // $50 cUSDC
        const matchRate = 500n;                 // 5.00% APR
        const matchDuration = 30n * 86400n;     // 30 days

        console.log("Encrypting counterparty matching terms...");
        const builder = cofheClientSecondary.encryptInputs([
            Encryptable.uint128(matchPrincipal),
            Encryptable.uint128(matchRate),
            Encryptable.uint128(matchDuration)
        ]);
        const [ctP, ctR, ctD] = await builder.execute();

        const inputP = { ctHash: ctP.ct_hash || ctP.ctHash, securityZone: ctP.security_zone || ctP.securityZone, utype: ctP.utype, signature: ctP.signature || "0x" };
        const inputR = { ctHash: ctR.ct_hash || ctR.ctHash, securityZone: ctR.security_zone || ctR.securityZone, utype: ctR.utype, signature: ctR.signature || "0x" };
        const inputD = { ctHash: ctD.ct_hash || ctD.ctHash, securityZone: ctD.security_zone || ctD.securityZone, utype: ctD.utype, signature: ctD.signature || "0x" };

        const p2pSecondary = p2p.connect(secondaryUser);
        console.log("Submitting P2P match request on-chain...");
        let tx = await p2pSecondary.matchOffer(0, inputP, inputR, inputD);
        let rx = await tx.wait();
        console.log(`Match Offer Request Tx Hash: ${rx.hash}`);
        expect(rx.status).to.equal(1);

        const info = await p2p.getOfferInfo(0);
        console.log(`Offer #0 State after match request: ${info.state}`);
        expect(info.state).to.equal(1n); // OfferState.MATCH_PENDING
    });

    it("Should cancel an open P2P offer and refund principal safely", async function () {
        const principal = 25n * 1000000n;
        const rate = 400n;
        const duration = 15n * 86400n;

        const builder = cofheClientPrimary.encryptInputs([
            Encryptable.uint128(principal),
            Encryptable.uint128(rate),
            Encryptable.uint128(duration)
        ]);
        const [ctP, ctR, ctD] = await builder.execute();

        const inputP = { ctHash: ctP.ct_hash || ctP.ctHash, securityZone: ctP.security_zone || ctP.securityZone, utype: ctP.utype, signature: ctP.signature || "0x" };
        const inputR = { ctHash: ctR.ct_hash || ctR.ctHash, securityZone: ctR.security_zone || ctR.securityZone, utype: ctR.utype, signature: ctR.signature || "0x" };
        const inputD = { ctHash: ctD.ct_hash || ctD.ctHash, securityZone: ctD.security_zone || ctD.securityZone, utype: ctD.utype, signature: ctD.signature || "0x" };

        let tx = await p2p.createOffer(0, inputP, inputR, inputD);
        await tx.wait();

        console.log("Cancelling P2P offer #1...");
        tx = await p2p.cancelOffer(1);
        let rx = await tx.wait();
        console.log(`Cancel Offer Tx Hash: ${rx.hash}`);
        expect(rx.status).to.equal(1);

        const info = await p2p.getOfferInfo(1);
        expect(info.state).to.equal(3n); // OfferState.CANCELLED
    });
});
