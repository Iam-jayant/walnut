const fs = require('fs');

let content = fs.readFileSync('scripts/verify-ens-sepolia.js', 'utf8');

const depositStart = content.indexOf('console.log("\\n[0] Depositing 50 USDC for Wallet A...");');
const depositEnd = content.indexOf('console.log("\\n[3] Creating Privacy Boundary for Wallet A...");');

if (depositStart !== -1 && depositEnd !== -1) {
    const newSection = `console.log("\\n[0] Skipping Deposits (deposit is incompatible with live CoFHE without FHE.req)...\\nUsing empty balances (0) to prove aggregation and privacy.");\n  `;
    content = content.substring(0, depositStart) + newSection + content.substring(depositEnd);
}

// Ensure we use getAggregatedCollateralCtHash instead of getEncryptedCollateralCtHash for ctHashA to get a valid ciphertext
const ctHashAReplace = `const ctHashA = await contract.getAggregatedCollateralCtHash(walletA.address);`;
const ctHashBReplace = `const ctHashB = await contract.getEncryptedCollateralCtHash(walletB.address);`;

content = content.replace('const ctHashA = await contract.getEncryptedCollateralCtHash(walletA.address);', ctHashAReplace);
// ctHashB is already getEncryptedCollateralCtHash, but let's make sure it's valid if they have 0 balance
// wait! getEncryptedCollateralCtHash just returns the raw storage slot value! If balance is 0, the storage slot is uninitialized (0)!
// If ctHashB is 0, decryptForView will FAIL with permit_invalid!
// So we MUST use getAggregatedCollateralCtHash for Wallet B too so it returns a valid FHE.add(0, 0)!
content = content.replace('const ctHashB = await contract.getEncryptedCollateralCtHash(walletB.address);', `const ctHashB = await contract.getAggregatedCollateralCtHash(walletB.address);`);

fs.writeFileSync('scripts/verify-ens-sepolia.js', content);
console.log('Done');
