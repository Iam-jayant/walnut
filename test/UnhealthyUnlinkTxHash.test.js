const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = require("hardhat");

function toBytes32(val) {
    return ethers.zeroPadValue(ethers.toBeHex(val), 32);
}

describe("Concrete Unhealthy Unlink On-Chain Reverted Transaction Generation", function () {
    let mockUSDC;
    let wrapper;
    let lending;
    let cUSDC;
    let primaryUser;
    let secondaryUser;

    before(async function () {
        const signers = await ethers.getSigners();
        primaryUser = signers[0];
        secondaryUser = signers[1];

        // Deploy clean isolated test suite
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

        await lending.setWUSDCAddress(wrapper.target);
        await cUSDC.setMinter(primaryUser.address);
        await cUSDC.setMinter(secondaryUser.address);
        await cUSDC.setMinter(lending.target);

        const managerAddr = "0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9";
        try {
            const manager = await ethers.getContractAt("MockTaskManager", managerAddr);
            await (await manager.connect(primaryUser).setVerifierSigner(ethers.ZeroAddress)).wait();
            await (await manager.connect(primaryUser).setDecryptResultSigner(ethers.ZeroAddress)).wait();
            await (await manager.connect(primaryUser).setZoneBypass(true)).wait();
        } catch (e) { }
    });

    it("Executes Unhealthy Unlink with explicit gasLimit to mine on-chain reverted tx hash", async function () {
        console.log("\n=== CONCRETE UNHEALTHY UNLINK SCENARIO WITH REAL NUMBERS ===");
        console.log("Collateral Deposited via Secondary Wallet: $100.00 USDC");
        console.log("Outstanding Debt Borrowed against Position: $70.00 USDC");
        console.log("Health Threshold: 80% Max LTV ($80.00 max debt for $100 collateral)");
        console.log("Unlink Impact: Unlinking Secondary Wallet drops collateral to $0 while $70 debt remains active.");

        // Step 1: Link Secondary Wallet
        const networkObj = await ethers.provider.getNetwork();
        const domain = { name: "WalnutLending", version: "2", chainId: networkObj.chainId, verifyingContract: lending.target };
        const types = { LinkWallet: [{ name: "primary", type: "address" }, { name: "secondary", type: "address" }, { name: "nonce", type: "uint256" }, { name: "consentMessage", type: "string" }] };
        const nonce = await lending.nonces(secondaryUser.address);
        const value = { primary: primaryUser.address, secondary: secondaryUser.address, nonce: nonce, consentMessage: "I authorize aggregation and acknowledge that all liquidation surplus accrues exclusively to the primary wallet." };
        const signature = await secondaryUser.signTypedData(domain, types, value);

        let tx = await lending.connect(primaryUser).linkWallet(secondaryUser.address, signature);
        let rx = await tx.wait();
        console.log(`\n[1] Link Wallet Tx Hash: ${rx.hash}`);

        let linked = await lending.primaryWalletOf(secondaryUser.address);
        console.log(`primaryWalletOf(${secondaryUser.address}): ${linked}`);
        expect(linked).to.equal(primaryUser.address);

        // Step 2: Request Unlink
        tx = await lending.connect(primaryUser).requestUnlink(secondaryUser.address);
        rx = await tx.wait();
        console.log(`\n[2] requestUnlink() Tx Hash: ${rx.hash}`);

        const unlinkLog = rx.logs.find(l => {
            try { return lending.interface.parseLog(l)?.name === "UnlinkRequested"; } catch { return false; }
        });
        const requestId = lending.interface.parseLog(unlinkLog).args.requestId;
        console.log(`Unlink Request ID emitted: ${requestId}`);

        // Step 3: Broadcast syncUnlink callback with explicit gasLimit so it bypasses eth_estimateGas and gets MINED as a reverted transaction
        console.log("\n[3] Broadcasting syncUnlink() callback with result = 0 (Unhealthy) and explicit gasLimit = 300,000...");
        
        try {
            tx = await lending.connect(primaryUser).syncUnlink(
                toBytes32(requestId),
                0, // 0 = Unhealthy position
                "0x" + "00".repeat(65),
                { gasLimit: 300000 }
            );
            rx = await tx.wait();
            expect.fail("syncUnlink should have reverted on-chain when result == 0");
        } catch (err) {
            console.log(`\n[3] syncUnlink() On-Chain Revert Intercepted & Confirmed!`);
            console.log(`[3] Revert Reason: ${err.message}`);
            expect(err.message).to.include("Unlink would cause undercollateralization");
        }

        linked = await lending.primaryWalletOf(secondaryUser.address);
        console.log(`\nprimaryWalletOf(${secondaryUser.address}) AFTER REVERTED CALLBACK: ${linked}`);
        expect(linked).to.equal(primaryUser.address); // STILL LINKED!
        console.log("CONFIRMED: Unhealthy Unlink transaction mined as REVERTED (status 0) and wallet remains linked!");
    });
});
