#!/usr/bin/env node

/**
 * Frontend Diagnostic Script
 * Checks all critical configurations and dependencies
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Walnut Frontend Diagnostics\n');

// Check 1: Environment Variables
console.log('1️⃣ Checking Environment Variables...');
const envPath = path.join(__dirname, '..', '.env');
const envLocalPath = path.join(__dirname, '..', '.env.local');

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const contractAddress = envContent.match(/NEXT_PUBLIC_CONTRACT_ADDRESS=(.+)/)?.[1];
  const chainId = envContent.match(/NEXT_PUBLIC_CHAIN_ID=(.+)/)?.[1];
  const rpcUrl = envContent.match(/NEXT_PUBLIC_RPC_URL_PRIMARY=(.+)/)?.[1];
  
  console.log(`   ✅ Contract Address: ${contractAddress}`);
  console.log(`   ✅ Chain ID: ${chainId}`);
  console.log(`   ✅ RPC URL: ${rpcUrl}`);
} else {
  console.log('   ❌ .env file not found');
}

// Check 2: Contract ABI
console.log('\n2️⃣ Checking Contract ABI...');
const abiPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'WalnutV1.sol', 'WalnutV1.json');

if (fs.existsSync(abiPath)) {
  const abi = JSON.parse(fs.readFileSync(abiPath, 'utf-8'));
  const functions = abi.abi.filter(item => item.type === 'function').map(item => item.name);
  
  const requiredFunctions = [
    'deposit',
    'borrow',
    'repay',
    'withdraw',
    'requestCreditTierUpdate',
    'requestLiquidationCheck',
    'getEncryptedCollateral',
    'getEncryptedDebt',
    'getHealthFactor'
  ];
  
  console.log(`   ✅ ABI found with ${functions.length} functions`);
  
  const missing = requiredFunctions.filter(fn => !functions.includes(fn));
  if (missing.length > 0) {
    console.log(`   ❌ Missing functions: ${missing.join(', ')}`);
  } else {
    console.log(`   ✅ All required functions present`);
  }
} else {
  console.log('   ❌ ABI file not found - run: npx hardhat compile');
}

// Check 3: Package Dependencies
console.log('\n3️⃣ Checking Dependencies...');
const packageJsonPath = path.join(__dirname, '..', 'package.json');

if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  const criticalDeps = {
    '@cofhe/react': deps['@cofhe/react'],
    '@cofhe/sdk': deps['@cofhe/sdk'],
    'wagmi': deps['wagmi'],
    'viem': deps['viem'],
  };
  
  Object.entries(criticalDeps).forEach(([name, version]) => {
    if (version) {
      console.log(`   ✅ ${name}: ${version}`);
    } else {
      console.log(`   ❌ ${name}: NOT INSTALLED`);
    }
  });
} else {
  console.log('   ❌ package.json not found');
}

// Check 4: Build Status
console.log('\n4️⃣ Checking Build Artifacts...');
const nextBuildPath = path.join(__dirname, '..', '.next');

if (fs.existsSync(nextBuildPath)) {
  console.log('   ✅ Next.js build artifacts found');
} else {
  console.log('   ⚠️  No build artifacts - run: npm run build');
}

// Check 5: Test Files
console.log('\n5️⃣ Checking Test Files...');
const testPath = path.join(__dirname, '..', 'test');

if (fs.existsSync(testPath)) {
  const testFiles = fs.readdirSync(testPath).filter(f => f.endsWith('.test.ts') || f.endsWith('.test.js'));
  console.log(`   ✅ Found ${testFiles.length} test files`);
  testFiles.forEach(file => console.log(`      - ${file}`));
} else {
  console.log('   ⚠️  No test directory found');
}

console.log('\n✅ Diagnostics Complete\n');
