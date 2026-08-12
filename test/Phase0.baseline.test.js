const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Phase 0 Baseline: Live Arbitrum Sepolia", function () {
    let walnutLending;
    const WALNUT_V2_ADDRESS = "0xF1A3DFbc4c79DEC6e12184FA17Ccd274E58A2B2b";

    before(async function () {
        if (network.name !== "arbitrumSepolia") {
            console.log("Skipping baseline test on non-arbitrumSepolia network");
            this.skip();
        }
        
        walnutLending = await ethers.getContractAt("WalnutLendingV2", WALNUT_V2_ADDRESS);
    });

    it("Should successfully connect and read owner()", async function () {
        const owner = await walnutLending.owner();
        console.log("Owner address:", owner);
        expect(owner).to.not.equal(ethers.ZeroAddress);
    });

    it("Should read the paused() state", async function () {
        const paused = await walnutLending.paused();
        console.log("Is protocol paused?", paused);
        expect(paused).to.be.a('boolean');
    });

    it("Should read totalDeposited", async function () {
        const totalDeposited = await walnutLending.totalDeposited();
        console.log("Total Deposited:", totalDeposited.toString());
        // Simply ensure the call succeeds without reverting
    });
});
