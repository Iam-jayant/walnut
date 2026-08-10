const { ethers } = require("ethers");
const provider = new ethers.JsonRpcProvider("https://sepolia-rollup.arbitrum.io/rpc");

async function main() {
  const addr = "0x7Bf93fdf3bb94B93eCB035A033E941642BDE8962";
  const code = await provider.getCode(addr);
  
  console.log("Has linkedWallets?", code.includes("8ce1b191"));
  console.log("Has unlinkWallet?", code.includes("5027dbe2"));
  console.log("Has linkWallet?", code.includes("14b9c807"));
}

main().catch(console.error);
