const fs = require('fs');
const path = require('path');

const ARTIFACT_PATH = path.join(__dirname, '../artifacts/contracts/WalnutLendingV2.sol/WalnutLendingV2.json');
const OUTPUT_DIR = path.join(__dirname, '../abis');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'WalnutLending.deployed.json');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Load compiled V2 artifact
if (!fs.existsSync(ARTIFACT_PATH)) {
  console.error(`Artifact not found at: ${ARTIFACT_PATH}. Run 'npx hardhat compile' first.`);
  process.exit(1);
}

const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8'));
const abi = artifact.abi;

// Save clean ABI directly to output path
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(abi, null, 2), 'utf8');
console.log(`✅ Deployed ABI successfully generated from WalnutLendingV2 artifact at: ${OUTPUT_PATH}`);
