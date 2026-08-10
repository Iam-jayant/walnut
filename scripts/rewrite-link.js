const fs = require('fs');

let content = fs.readFileSync('scripts/verify-ens-sepolia.js', 'utf8');

const oldTypes = `const types = {
    LinkWallet: [
      { name: "primaryWallet", type: "address" },
      { name: "nonce", type: "uint256" },
      { name: "consentMessage", type: "string" }
    ]
  };`;

const newTypes = `const types = {
    LinkWallet: [
      { name: "primary", type: "address" },
      { name: "secondary", type: "address" },
      { name: "nonce", type: "uint256" },
      { name: "consentMessage", type: "string" }
    ]
  };`;

content = content.replace(oldTypes, newTypes);
content = content.replace('const consentMessage = "I authorize Walnut to aggregate my balances with the primary wallet. All surplus will accrue to the primary wallet.";', 'const consentMessage = "I authorize aggregation and acknowledge that all liquidation surplus accrues exclusively to the primary wallet.";');
content = content.replace('const value = { primaryWallet: walletA.address, nonce, consentMessage };', 'const value = { primary: walletA.address, secondary: walletB.address, nonce, consentMessage };');
content = content.replace('const linkTx = await contract.connect(walletB).linkWallet(walletA.address, signature);', 'const linkTx = await contract.connect(walletA).linkWallet(walletB.address, signature);');

// Remove funding code since walletA pays for the tx
const fundingCode = `console.log("Funding walletB with ETH...");
  const fundTx = await walletA.sendTransaction({
    to: walletB.address,
    value: ethers.parseEther("0.000005")
  });
  await fundTx.wait();`;
content = content.replace(fundingCode, '');

fs.writeFileSync('scripts/verify-ens-sepolia.js', content);
console.log('Done');
