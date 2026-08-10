const { ethers } = require("ethers");
const provider = new ethers.JsonRpcProvider("https://sepolia-rollup.arbitrum.io/rpc");

async function main() {
  const addr = "0x7Bf93fdf3bb94B93eCB035A033E941642BDE8962";
  const code = await provider.getCode(addr);
  
  // function unlinkWallet(address) -> 0x5027dbe2
  const hasUnlink = code.includes("5027dbe2");
  console.log("Has unlinkWallet(address)?", hasUnlink);

  // function linkWallet(address,bytes) -> 0x51c72051
  const hasLink = code.includes("51c72051");
  console.log("Has linkWallet(address,bytes)?", hasLink);
}

main().catch(console.error);
