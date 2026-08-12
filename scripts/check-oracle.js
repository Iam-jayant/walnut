const { ethers } = require("hardhat");

async function main() {
    const o = await ethers.getContractAt('WalnutPriceOracle', '0x82E7caF958B329c47F10778E10A89B2319D67A14');
    try {
        const val = await o.getUSDValue('0x6341A12D08EE6F6fA071CF94C7C4a878ee5AF3ef', 1000000);
        console.log('USD Value for 0x6341...:', val.toString());
    } catch(e) {
        console.log('Oracle error for 0x6341...:', e.message);
    }
}
main().catch(console.error);
