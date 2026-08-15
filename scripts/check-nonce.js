const { ethers } = require("ethers");
require("dotenv").config({ path: ".env.local" });

async function main() {
  const LENDING_ADDRESS = "0xdF921cF29Aae0fBf524139a4cae9289478893fDf";
  const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc");
  const secondary = "0xd499EF431dBDD87bB0a3a7820254d76a9D198056"; 
  
  const iface = new ethers.Interface(["function nonces(address) view returns (uint256)"]);
  const data = iface.encodeFunctionData("nonces", [secondary]);
  
  const result = await provider.call({
    to: LENDING_ADDRESS,
    data: data
  });
  
  console.log("Nonce for secondary on-chain is:", BigInt(result).toString());
}

main().catch(console.error);
