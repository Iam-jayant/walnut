#!/usr/bin/env node

/**
 * Walnut Wave 3 - Deployment Verification Script
 * 
 * This script verifies that all configuration is correct for the deployed WalnutV1 contract
 * on Arbitrum Sepolia.
 */

const fs = require('fs');
const path = require('path');

const EXPECTED_CONTRACT = '0x04c998DD105E444570ba1eCACB3F5524D5695aA0';
const EXPECTED_CHAIN_ID = '421614';
const EXPECTED_RPC = 'https://sepolia-rollup.arbitrum.io/rpc';

console.log('🔍 Walnut Wave 3 - Deployment Verification\n');
console.log('Expected Configuration:');
console.log(`  Contract: ${EXPECTED_CONTRACT}`);
console.log(`  Chain ID: ${EXPECTED_CHAIN_ID} (Arbitrum Sepolia)`);
console.log(`  RPC: ${EXPECTED_RPC}\n`);

let errors = [];
let warnings = [];

// Check .env file
console.log('📄 Checking .env file...');
try {
  const envContent = fs.readFileSync('.env', 'utf8');
  const envLines = envContent.split('\n');
  
  const contractLine = envLines.find(line => line.startsWith('NEXT_PUBLIC_CONTRACT_ADDRESS='));
  const chainIdLine = envLines.find(line => line.startsWith('NEXT_PUBLIC_CHAIN_ID='));
  const rpcLine = envLines.find(line => line.startsWith('NEXT_PUBLIC_RPC_URL_PRIMARY='));
  
  if (contractLine) {
    const contract = contractLine.split('=')[1].trim();
    if (contract === EXPECTED_CONTRACT) {
      console.log('  ✅ Contract address correct');
    } else {
      errors.push(`.env: Contract address is ${contract}, expected ${EXPECTED_CONTRACT}`);
    }
  } else {
    errors.push('.env: NEXT_PUBLIC_CONTRACT_ADDRESS not found');
  }
  
  if (chainIdLine) {
    const chainId = chainIdLine.split('=')[1].trim();
    if (chainId === EXPECTED_CHAIN_ID) {
      console.log('  ✅ Chain ID correct');
    } else {
      errors.push(`.env: Chain ID is ${chainId}, expected ${EXPECTED_CHAIN_ID}`);
    }
  } else {
    errors.push('.env: NEXT_PUBLIC_CHAIN_ID not found');
  }
  
  if (rpcLine) {
    const rpc = rpcLine.split('=')[1].trim();
    if (rpc === EXPECTED_RPC) {
      console.log('  ✅ RPC URL correct');
    } else {
      warnings.push(`.env: RPC URL is ${rpc}, expected ${EXPECTED_RPC}`);
    }
  } else {
    errors.push('.env: NEXT_PUBLIC_RPC_URL_PRIMARY not found');
  }
} catch (error) {
  errors.push('.env file not found or not readable');
}

// Check .env.local file
console.log('\n📄 Checking .env.local file...');
try {
  const envLocalContent = fs.readFileSync('.env.local', 'utf8');
  const envLocalLines = envLocalContent.split('\n');
  
  const contractLine = envLocalLines.find(line => line.startsWith('NEXT_PUBLIC_CONTRACT_ADDRESS='));
  
  if (contractLine) {
    const contract = contractLine.split('=')[1].trim();
    if (contract === EXPECTED_CONTRACT) {
      console.log('  ✅ Contract address correct');
    } else {
      errors.push(`.env.local: Contract address is ${contract}, expected ${EXPECTED_CONTRACT}`);
    }
  } else {
    warnings.push('.env.local: NEXT_PUBLIC_CONTRACT_ADDRESS not found (will use .env)');
  }
} catch (error) {
  warnings.push('.env.local file not found (will use .env)');
}

// Check package.json for SDK versions
console.log('\n📦 Checking package.json...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  if (packageJson.dependencies['@cofhe/sdk']) {
    console.log(`  ✅ @cofhe/sdk: ${packageJson.dependencies['@cofhe/sdk']}`);
  } else {
    errors.push('package.json: @cofhe/sdk not found');
  }
  
  if (packageJson.dependencies['@cofhe/react']) {
    console.log(`  ✅ @cofhe/react: ${packageJson.dependencies['@cofhe/react']}`);
  } else {
    errors.push('package.json: @cofhe/react not found');
  }
  
  if (packageJson.dependencies['@cofhe/abi']) {
    console.log(`  ✅ @cofhe/abi: ${packageJson.dependencies['@cofhe/abi']}`);
  } else {
    errors.push('package.json: @cofhe/abi not found');
  }
  
  if (packageJson.dependencies['@reineira-os/sdk']) {
    console.log(`  ⏳ @reineira-os/sdk: ${packageJson.dependencies['@reineira-os/sdk']} (Wave 4)`);
  }
} catch (error) {
  errors.push('package.json not found or not readable');
}

// Check lib/walnut-contract.ts
console.log('\n📄 Checking lib/walnut-contract.ts...');
try {
  const contractTsContent = fs.readFileSync('lib/walnut-contract.ts', 'utf8');
  
  if (contractTsContent.includes('NEXT_PUBLIC_CONTRACT_ADDRESS')) {
    console.log('  ✅ Uses NEXT_PUBLIC_CONTRACT_ADDRESS');
  } else {
    errors.push('lib/walnut-contract.ts: Does not use NEXT_PUBLIC_CONTRACT_ADDRESS');
  }
  
  if (contractTsContent.includes('walnutV1Abi')) {
    console.log('  ✅ Uses walnutV1Abi');
  } else {
    errors.push('lib/walnut-contract.ts: Does not use walnutV1Abi');
  }
} catch (error) {
  errors.push('lib/walnut-contract.ts not found or not readable');
}

// Check lib/web3-config.ts
console.log('\n📄 Checking lib/web3-config.ts...');
try {
  const web3ConfigContent = fs.readFileSync('lib/web3-config.ts', 'utf8');
  
  if (web3ConfigContent.includes('arbitrumSepolia')) {
    console.log('  ✅ Uses arbitrumSepolia chain');
  } else {
    errors.push('lib/web3-config.ts: Does not use arbitrumSepolia chain');
  }
} catch (error) {
  errors.push('lib/web3-config.ts not found or not readable');
}

// Check lib/cofhe-client.ts
console.log('\n📄 Checking lib/cofhe-client.ts...');
try {
  const cofheClientContent = fs.readFileSync('lib/cofhe-client.ts', 'utf8');
  
  if (cofheClientContent.includes('arbSepolia')) {
    console.log('  ✅ Uses arbSepolia chain');
  } else {
    errors.push('lib/cofhe-client.ts: Does not use arbSepolia chain');
  }
} catch (error) {
  errors.push('lib/cofhe-client.ts not found or not readable');
}

// Check for old Ethereum Sepolia references
console.log('\n🔍 Checking for old Ethereum Sepolia references...');
const filesToCheck = [
  'lib/walnut-contract.ts',
  'lib/web3-config.ts',
  'lib/cofhe-client.ts',
  'hooks/use-walnut-protocol.ts'
];

let foundOldReferences = false;
for (const file of filesToCheck) {
  try {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('11155111') || content.includes('eth-sepolia') || content.includes('etherscan.io/tx')) {
      errors.push(`${file}: Contains old Ethereum Sepolia references`);
      foundOldReferences = true;
    }
  } catch (error) {
    // File not found, skip
  }
}

if (!foundOldReferences) {
  console.log('  ✅ No old Ethereum Sepolia references found');
}

// Check WalnutV1 contract artifact
console.log('\n📄 Checking WalnutV1 contract artifact...');
try {
  const artifactPath = 'artifacts/contracts/WalnutV1.sol/WalnutV1.json';
  if (fs.existsSync(artifactPath)) {
    console.log('  ✅ WalnutV1.json artifact exists');
  } else {
    warnings.push('WalnutV1.json artifact not found (run: npx hardhat compile)');
  }
} catch (error) {
  warnings.push('Could not check WalnutV1 artifact');
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Verification Summary\n');

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ All checks passed! System is ready for testing.\n');
  console.log('Next steps:');
  console.log('  1. Verify contract on Arbiscan:');
  console.log(`     https://sepolia.arbiscan.io/address/${EXPECTED_CONTRACT}`);
  console.log('  2. Run: npm run dev');
  console.log('  3. Connect wallet to Arbitrum Sepolia');
  console.log('  4. Test all flows (deposit, borrow, repay, withdraw, liquidation, P2P, ENS)');
  process.exit(0);
} else {
  if (errors.length > 0) {
    console.log(`❌ ${errors.length} error(s) found:\n`);
    errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
    console.log('');
  }
  
  if (warnings.length > 0) {
    console.log(`⚠️  ${warnings.length} warning(s):\n`);
    warnings.forEach((warning, index) => {
      console.log(`  ${index + 1}. ${warning}`);
    });
    console.log('');
  }
  
  if (errors.length > 0) {
    console.log('Please fix the errors above before testing.');
    process.exit(1);
  } else {
    console.log('Warnings can be ignored, but should be addressed.');
    process.exit(0);
  }
}
