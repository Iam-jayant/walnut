const { expect } = require("chai");
const hre = require("hardhat");
const { ethers, network } = require("hardhat");
const { createPublicClient, createWalletClient, http } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { arbitrumSepolia } = require("viem/chains");
const { createCofheClient, createCofheConfig } = require("@cofhe/sdk/node");
const { arbSepolia } = require("@cofhe/sdk/chains");
const { Encryptable } = require("@cofhe/sdk");

describe("Phase 5: ENS Multi-Wallet Aggregation & Confidential Health Unlinking (Live Arbitrum Sepolia)", function () {
    let mockUSDC;
    let wrapper;
    let lending;
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

        console.log("Deploying fresh WalnutLendingV2 for Phase 5 ENS Aggregation...");
        const WalnutLendingV2 = await ethers.getContractFactory("WalnutLendingV2");
        lending = await WalnutLendingV2.deploy(FHERC20_ADDRESS, ORACLE_ADDRESS, primaryUser.address);
        await lending.waitForDeployment();
        console.log(`WalnutLendingV2 deployed at: ${lending.target}`);

        console.log("Setting wUSDC address...");
        let txSet = await lending.setWUSDCAddress(wrapper.target);
        await txSet.wait();

        console.log("Setting WalnutLendingV2 as minter on cUSDC...");
        txSet = await cUSDC.setMinter(lending.target);
        await txSet.wait();
    });

    it("Should link secondary wallet via EIP-712 signature and aggregate collateral homomorphically", async function () {
        const depositPrimary = 100n * 1000000n;   // $100 wUSDC
        const depositSecondary = 50n * 1000000n;  // $50 wUSDC

        // 1. EIP-712 Sign link authorization from secondary user
        const networkObj = await ethers.provider.getNetwork();
        const chainId = networkObj.chainId;

        const domain = {
            name: "WalnutLending",
            version: "2",
            chainId: chainId,
            verifyingContract: lending.target
        };

        const types = {
            LinkWallet: [
                { name: "primary", type: "address" },
                { name: "secondary", type: "address" },
                { name: "nonce", type: "uint256" },
                { name: "consentMessage", type: "string" }
            ]
        };

        const nonce = await lending.nonces(secondaryUser.address);
        const value = {
            primary: primaryUser.address,
            secondary: secondaryUser.address,
            nonce: nonce,
            consentMessage: "I authorize aggregation and acknowledge that all liquidation surplus accrues exclusively to the primary wallet."
        };

        console.log("Signing EIP-712 link wallet authorization...");
        const signature = await secondaryUser.signTypedData(domain, types, value);

        console.log("Linking secondary wallet on-chain...");
        let tx = await lending.linkWallet(secondaryUser.address, signature);
        let rx = await tx.wait();
        console.log(`Link Wallet Tx Hash: ${rx.hash}`);
        expect(rx.status).to.equal(1);

        const storedPrimary = await lending.primaryWalletOf(secondaryUser.address);
        console.log(`Primary wallet of secondary (${secondaryUser.address}): ${storedPrimary}`);
        expect(storedPrimary).to.equal(primaryUser.address);

        // 2. Primary deposits $100 wUSDC
        console.log("Minting & shielding $100 wUSDC for primary...");
        tx = await mockUSDC.mint(primaryUser.address, depositPrimary);
        await tx.wait();
        tx = await mockUSDC.approve(wrapper.target, depositPrimary);
        await tx.wait();
        tx = await wrapper.shield(primaryUser.address, depositPrimary);
        await tx.wait();
        tx = await wrapper.setOperator(lending.target, 0xffffffff);
        await tx.wait();

        const builderP = cofheClientPrimary.encryptInputs([Encryptable.uint64(depositPrimary)]);
        const [ctP] = await builderP.execute();
        const inputP = {
            ctHash: ctP.ct_hash || ctP.ctHash,
            securityZone: ctP.security_zone || ctP.securityZone,
            utype: ctP.utype,
            signature: ctP.signature || "0x"
        };
        tx = await lending.deposit(wrapper.target, inputP);
        rx = await tx.wait();
        console.log(`Primary Deposit $100 wUSDC Tx Hash: ${rx.hash}`);

        // 3. Secondary deposits $50 wUSDC
        console.log("Minting & shielding $50 wUSDC for secondary...");
        tx = await mockUSDC.mint(secondaryUser.address, depositSecondary);
        await tx.wait();
        
        const mockUSDCSecondary = mockUSDC.connect(secondaryUser);
        const wrapperSecondary = wrapper.connect(secondaryUser);
        const lendingSecondary = lending.connect(secondaryUser);

        tx = await mockUSDCSecondary.approve(wrapperSecondary.target, depositSecondary);
        await tx.wait();
        tx = await wrapperSecondary.shield(secondaryUser.address, depositSecondary);
        await tx.wait();
        tx = await wrapperSecondary.setOperator(lendingSecondary.target, 0xffffffff);
        await tx.wait();

        const builderS = cofheClientSecondary.encryptInputs([Encryptable.uint64(depositSecondary)]);
        const [ctS] = await builderS.execute();
        const inputS = {
            ctHash: ctS.ct_hash || ctS.ctHash,
            securityZone: ctS.security_zone || ctS.securityZone,
            utype: ctS.utype,
            signature: ctS.signature || "0x"
        };
        tx = await lendingSecondary.deposit(wrapperSecondary.target, inputS);
        rx = await tx.wait();
        console.log(`Secondary Deposit $50 wUSDC Tx Hash: ${rx.hash}`);

        // 4. Verify aggregated collateral handle (sums $100 + $50 = $150)
        const aggregatedHandle = await lending.getAggregatedCollateralCtHash(primaryUser.address);
        console.log(`Aggregated Collateral Handle: ${aggregatedHandle}`);
        expect(aggregatedHandle).to.not.equal(0n);

        // 5. Test requestUnlink
        console.log("Requesting unlink for secondary wallet...");
        tx = await lending.requestUnlink(secondaryUser.address);
        rx = await tx.wait();
        console.log(`Request Unlink Tx Hash: ${rx.hash}`);
        expect(rx.status).to.equal(1);
    });
});
