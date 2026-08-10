const fs = require('fs');

let lines = fs.readFileSync('scripts/verify-ens-sepolia.js', 'utf8').split('\n');
let newLines = [];
let skip = false;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('const mintTxA = await mockUSDC.connect(walletA).mint(walletA.address')) {
        skip = true;
        newLines.push('  console.log("\\n[0] Skipping Deposits...");');
        // also comment out the "[0] Depositing" line that came before this
        const depositLogIdx = newLines.findIndex(l => l.includes('console.log("\\n[0] Depositing 50 USDC for Wallet A...");'));
        if (depositLogIdx !== -1) {
            newLines[depositLogIdx] = '// ' + newLines[depositLogIdx];
        }
    }
    
    if (line.includes('console.log("\\n[3] Creating Privacy Boundary for Wallet A...");')) {
        skip = false;
    }
    
    if (line.includes('const ctHashA = await contract.getEncryptedCollateralCtHash(walletA.address);')) {
        newLines.push('  const ctHashA = await contract.getAggregatedCollateralCtHash(walletA.address);');
        continue;
    }
    if (line.includes('const ctHashB = await contract.getEncryptedCollateralCtHash(walletB.address);')) {
        newLines.push('  const ctHashB = await contract.getAggregatedCollateralCtHash(walletB.address);');
        continue;
    }
    
    if (!skip) {
        newLines.push(line);
    }
}

fs.writeFileSync('scripts/verify-ens-sepolia.js', newLines.join('\n'));
console.log('Done');
