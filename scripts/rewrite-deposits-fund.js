const fs = require('fs');
let content = fs.readFileSync('scripts/verify-ens-sepolia.js', 'utf8');
const newCode = `
  console.log('Funding walletB with ETH for deposit...');
  const fundTx = await walletA.sendTransaction({
    to: walletB.address,
    value: ethers.parseEther('0.0005')
  });
  await fundTx.wait();
`;
content = content.replace('// Wallet B Deposit (25 USDC)', newCode + '\n  // Wallet B Deposit (25 USDC)');
fs.writeFileSync('scripts/verify-ens-sepolia.js', content);
console.log('Done');
