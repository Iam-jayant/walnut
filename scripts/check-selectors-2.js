const { ethers } = require("ethers");
const provider = new ethers.JsonRpcProvider("https://sepolia-rollup.arbitrum.io/rpc");

async function main() {
  const addr = "0x7Bf93fdf3bb94B93eCB035A033E941642BDE8962";
  const code = await provider.getCode(addr);
  
  // function linkedWallets(address,uint256) -> 0xb655b31f
  const hasLinked = code.includes("b655b31f");
  console.log("Has linkedWallets?", hasLinked);
}

main().catch(console.error);
