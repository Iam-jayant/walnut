// Inspect transaction 0x876ad6e93721595724bfc0f9a60ddd54ec643a948f919770a9cc2664cc10b1e4
const { createPublicClient, http } = require('viem');
const { arbitrumSepolia } = require('viem/chains');

const TX_HASH = '0x17c9f6767089699a25d7c7fcad73dd75f7c4ae5ccbcbb8b5ccbf4acc4136fe87';

const client = createPublicClient({
  chain: arbitrumSepolia,
  transport: http('https://sepolia-rollup.arbitrum.io/rpc'),
});

async function main() {
  console.log('=== INSPECTING FAILED TRANSACTION ===\n');
  const tx = await client.getTransaction({ hash: TX_HASH });
  console.log('Tx to:', tx.to);
  console.log('Tx input calldata:', tx.input);
  console.log('Tx value:', tx.value.toString());

  const receipt = await client.getTransactionReceipt({ hash: TX_HASH });
  console.log('Receipt status:', receipt.status);
  console.log('Block number:', receipt.blockNumber.toString());

  // Simulate call to get exact revert reason
  try {
    await client.call({
      account: tx.from,
      to: tx.to,
      data: tx.input,
      value: tx.value,
      blockNumber: receipt.blockNumber - 1n,
    });
    console.log('Simulation did not revert at block - 1!');
  } catch (e) {
    console.log('\nRevert reason from simulation:');
    console.log(e.message || e);
  }
}

main().catch(console.error);
