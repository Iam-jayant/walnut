const hre = require("hardhat");

async function main() {
  if (hre.fhenixjs) {
    console.log("fhenixjs is available!");
    try {
      const enc = await hre.fhenixjs.encrypt_uint128(50n);
      console.log("Encrypted successfully! ctHash:", !!enc.data);
    } catch (e) {
      console.error("Encrypt error:", e);
    }
  } else {
    console.log("fhenixjs is not available.");
  }
}

main().catch(console.error);
