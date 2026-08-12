const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("Phase 1: WalnutVaultWrapper (Live Arbitrum Sepolia)", function () {
    let mockUSDC;
    let wrapper;
    let user;

    const MOCK_USDC_ADDRESS = "0x6341A12D08EE6F6fA071CF94C7C4a878ee5AF3ef";
    // Using the recently deployed wrapper address
    const WRAPPER_ADDRESS = "0x8684d325BE9B635BD72bFC2bB10bB6f354f5Cd61";

    before(async function () {
        if (network.name !== "arbitrumSepolia") {
            this.skip();
        }

        [user] = await ethers.getSigners();

        mockUSDC = await ethers.getContractAt(
            ["function mint(address to, uint256 amount) external", "function approve(address spender, uint256 amount) external returns (bool)", "function balanceOf(address account) external view returns (uint256)"],
            MOCK_USDC_ADDRESS
        );

        wrapper = await ethers.getContractAt("WalnutVaultWrapper", WRAPPER_ADDRESS);
    });

    it("Should mint MockUSDC to user", async function () {
        const amountToMint = 100n * 1000000n; // 100 USDC (6 decimals)
        console.log("Minting MockUSDC...");
        const tx = await mockUSDC.mint(user.address, amountToMint);
        await tx.wait();

        const balance = await mockUSDC.balanceOf(user.address);
        expect(balance).to.be.gte(amountToMint);
        console.log(`MockUSDC Balance: ${balance.toString()}`);
    });

    it("Should shield MockUSDC into wUSDC", async function () {
        const amountToShield = 50n * 1000000n; // 50 USDC

        console.log("Approving wrapper...");
        const approveTx = await mockUSDC.approve(wrapper.target, amountToShield);
        await approveTx.wait();

        console.log("Shielding MockUSDC into wUSDC...");
        const shieldTx = await wrapper.shield(user.address, amountToShield);
        const receipt = await shieldTx.wait();
        
        console.log(`Shield Transaction Hash: ${receipt.hash}`);
        expect(receipt.status).to.equal(1);
    });
});
