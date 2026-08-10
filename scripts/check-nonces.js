const { ethers } = require("ethers");
async function main() {
  const rpcUrl = "https://sepolia-rollup.arbitrum.io/rpc";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const abi = ["function nonces(address) view returns (uint256)"];
  const addr1 = "0x4A94562d83a183461A42F56E0316083b3C33cb25"; // .env.local
  const addr2 = "0x7Bf93fdf3bb94B93eCB035A033E941642BDE8962"; // .env
  
  try {
    const c1 = new ethers.Contract(addr1, abi, provider);
    const n1 = await c1.nonces("0x05951ec62b4cb45032Fbb7F4194689AF4bdC77C8");
    console.log("Addr 1 (4A94...) SUCCESS: nonce =", n1.toString());
  } catch(e) {
    console.log("Addr 1 (4A94...) FAILED:", e.message);
  }
  
  try {
    const c2 = new ethers.Contract(addr2, abi, provider);
    const n2 = await c2.nonces("0x05951ec62b4cb45032Fbb7F4194689AF4bdC77C8");
    console.log("Addr 2 (7Bf9...) SUCCESS: nonce =", n2.toString());
  } catch(e) {
    console.log("Addr 2 (7Bf9...) FAILED:", e.message);
  }
}
main();
