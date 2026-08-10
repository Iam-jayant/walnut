const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC_URL;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  const contractAddress = process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS;
  const abi = [
    "function linkWallet(address secondary, bytes signature) external",
  ];
  
  const contract = new ethers.Contract(contractAddress, abi, provider);
  
  const primary = "0x65c3768E98eE211a7589fe94c753e11cB8895069";
  const secondary = "0x05951ec62b4cb45032Fbb7F4194689AF4bdC77C8";
  
  // Signature from the user's previous attempt in the truncated logs:
  // "args: (0x05951ec62b4cb45032Fbb7F4194689AF4bdC77C8, 0x56a72a2ccf3e857176ea30e00b68220174b05807fc3ec442578f5cd70f8433b13cd544d2497eb8c0809f1b7845c7ca4aaa356bda3c531fa7993be14f9a6c3a651c)"
  const sig = "0x56a72a2ccf3e857176ea30e00b68220174b05807fc3ec442578f5cd70f8433b13cd544d2497eb8c0809f1b7845c7ca4aaa356bda3c531fa7993be14f9a6c3a651c";

  console.log("Simulating linkWallet...");
  try {
    const data = contract.interface.encodeFunctionData("linkWallet", [secondary, sig]);
    const res = await provider.call({
      to: contractAddress,
      from: primary,
      data: data
    });
    console.log("Simulation SUCCESS! Return data:", res);
  } catch(e) {
    console.log("Simulation REVERTED:");
    console.log(e.message);
  }
}

main().catch(console.error);
