const { ethers } = require("ethers");
const provider = new ethers.JsonRpcProvider("https://sepolia-rollup.arbitrum.io/rpc");

async function main() {
  const addr = "0x7Bf93fdf3bb94B93eCB035A033E941642BDE8962";
  const abi = [
    "function nonces(address) view returns (uint256)",
    "function linkedWallets(address, uint256) view returns (address)"
  ];
  const contract = new ethers.Contract(addr, abi, provider);
  
  try {
    const n = await contract.nonces("0x65c3768E98eE211a7589fe94c753e11cB8895069");
    console.log("nonces:", n.toString());
  } catch(e) {
    console.log("nonces failed:", e.message);
  }

  try {
    const l = await contract.linkedWallets("0x65c3768E98eE211a7589fe94c753e11cB8895069", 0);
    console.log("linkedWallets[0]:", l);
  } catch(e) {
    console.log("linkedWallets failed:", e.message);
  }
}

main().catch(console.error);
