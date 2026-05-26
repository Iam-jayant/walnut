const { ethers } = require("ethers");

async function main() {
  const provider = new ethers.JsonRpcProvider("https://sepolia-rollup.arbitrum.io/rpc");
  const txHash = "0x3078898509281dc6044fd3e1af1cfd11cdbfd05b1377e4a74e7ee670927adcce";
  const tx = await provider.getTransaction(txHash);
  if (!tx) {
    console.log("Tx not found");
    return;
  }
  
  try {
    const result = await provider.call({
      to: tx.to,
      data: tx.data,
      from: tx.from,
      value: tx.value,
      gasLimit: tx.gasLimit,
      gasPrice: tx.gasPrice
    }, tx.blockNumber - 1);
    console.log("Call result:", result);
  } catch (e) {
    console.log("Revert reason:", e.message);
    if (e.data) {
        console.log("Error data:", e.data);
    }
  }
}

main().catch(console.error);
