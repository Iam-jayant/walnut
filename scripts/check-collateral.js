const { ethers } = require("ethers");
const provider = new ethers.JsonRpcProvider("https://sepolia-rollup.arbitrum.io/rpc");

async function main() {
  const addr = "0x7Bf93fdf3bb94B93eCB035A033E941642BDE8962";
  const abi = [
    "function getEncryptedCollateral(address) view returns (bytes32)",
  ];
  const contract = new ethers.Contract(addr, abi, provider);
  
  const secondary = "0x05951ec62b4cb45032Fbb7F4194689AF4bdC77C8";
  
  try {
    const ctHash = await contract.getEncryptedCollateral(secondary);
    console.log("ctHash:", ctHash);
  } catch(e) {
    console.log("getEncryptedCollateral failed:", e.message);
  }
}

main().catch(console.error);
