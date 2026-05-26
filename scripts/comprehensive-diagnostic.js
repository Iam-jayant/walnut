const { ethers } = require('ethers');
require('dotenv').config();

async function runDiagnostics() {
  console.log('\n=== WALNUT PROTOCOL COMPREHENSIVE DIAGNOSTIC ===\n');
  
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_SEPOLIA_RPC_URL);
  const privateKey = process.env.PRIVATE_KEY.startsWith('0x') ? process.env.PRIVATE_KEY : '0x' + process.env.PRIVATE_KEY;
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log('User Address:', wallet.address);
  console.log('');
  
  // Contract addresses
  const WALNUT_LENDING = process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS;
  const MOCK_USDC = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS;
  const ORACLE_ADDRESS_ENV = process.env.NEXT_PUBLIC_ORACLE_ADDRESS;
  
  console.log('=== CONTRACT ADDRESSES ===');
  console.log('WalnutLending (from .env):', WALNUT_LENDING);
  console.log('MockUSDC:', MOCK_USDC);
  console.log('Oracle (from .env):', ORACLE_ADDRESS_ENV);
  console.log('');
  
  // Check WalnutLending configuration
  console.log('=== WALNUT LENDING CONFIGURATION ===');
  const walnutAbi = [
    'function oracle() view returns (address)',
    'function stablecoin() view returns (address)',
    'function owner() view returns (address)',
    'function paused() view returns (bool)',
    'function creditTier(address) view returns (uint8)',
    'function tierLTVs(uint256) view returns (uint16)',
    'function borrowTimestamp(address) view returns (uint256)',
    'function getEncryptedDebt(address) view returns (tuple(uint256 ctHash, uint8 utype))'
  ];
  
  const walnut = new ethers.Contract(WALNUT_LENDING, walnutAbi, provider);
  
  try {
    const [oracle, stablecoin, owner, paused] = await Promise.all([
      walnut.oracle(),
      walnut.stablecoin(),
      walnut.owner(),
      walnut.paused()
    ]);
    
    console.log('Oracle (actual):', oracle);
    console.log('Stablecoin:', stablecoin);
    console.log('Owner:', owner);
    console.log('Paused:', paused);
    console.log('Oracle Match:', oracle.toLowerCase() === ORACLE_ADDRESS_ENV?.toLowerCase() ? '✅' : '❌ MISMATCH!');
    console.log('');
    
    // Check user's credit status
    console.log('=== USER CREDIT STATUS ===');
    const creditTier = await walnut.creditTier(wallet.address);
    const tierLTV = await walnut.tierLTVs(creditTier);
    const borrowTimestamp = await walnut.borrowTimestamp(wallet.address);
    
    let encryptedDebtStr = 'Unknown';
    try {
      const encryptedDebt = await walnut.getEncryptedDebt(wallet.address);
      encryptedDebtStr = `Encrypted (ctHash: ${encryptedDebt[0].toString()})`;
    } catch (err) {
      encryptedDebtStr = 'Encrypted (Private)';
    }
    
    console.log('Credit Tier:', creditTier.toString());
    console.log('Tier LTV (bps):', tierLTV.toString(), `(${Number(tierLTV) / 100}%)`);
    console.log('Principal Debt:', encryptedDebtStr);
    console.log('Borrow Timestamp:', borrowTimestamp.toString());
    console.log('Has Active Loan:', borrowTimestamp > 0n ? 'YES' : 'NO');
    console.log('');
    
    // Check oracle price feed
    console.log('=== ORACLE PRICE FEED ===');
    const oracleAbi = [
      'function priceFeeds(address) view returns (address)',
      'function getUSDValue(address, uint256) view returns (uint256)'
    ];
    
    const oracleContract = new ethers.Contract(oracle, oracleAbi, provider);
    const priceFeed = await oracleContract.priceFeeds(MOCK_USDC);
    console.log('USDC Price Feed:', priceFeed);
    console.log('Price Feed Configured:', priceFeed !== ethers.ZeroAddress ? '✅' : '❌ NOT CONFIGURED!');
    
    if (priceFeed !== ethers.ZeroAddress) {
      try {
        const usdValue = await oracleContract.getUSDValue(MOCK_USDC, ethers.parseUnits('100', 6));
        console.log('100 USDC = $', ethers.formatUnits(usdValue, 6));
      } catch (err) {
        console.log('Price Feed Error:', err.message);
      }
    }
    console.log('');
    
    // Check USDC balance and allowance
    console.log('=== USDC STATUS ===');
    const usdcAbi = [
      'function balanceOf(address) view returns (uint256)',
      'function allowance(address, address) view returns (uint256)'
    ];
    const usdc = new ethers.Contract(MOCK_USDC, usdcAbi, provider);
    
    const balance = await usdc.balanceOf(wallet.address);
    const allowance = await usdc.allowance(wallet.address, WALNUT_LENDING);
    
    console.log('USDC Balance:', ethers.formatUnits(balance, 6));
    console.log('USDC Allowance:', ethers.formatUnits(allowance, 6));
    console.log('');
    
    // Check vault holdings (plaintext)
    console.log('=== VAULT HOLDINGS (PLAINTEXT) ===');
    const vaultAbi = [
      'function getVaults(address) view returns (tuple(address token, uint256 amount)[])'
    ];
    const vaultContract = new ethers.Contract(WALNUT_LENDING, vaultAbi, provider);
    
    let vaults = [];
    try {
      vaults = await vaultContract.getVaults(wallet.address);
      console.log('Number of vault holdings:', vaults.length);
      
      if (vaults.length === 0) {
        console.log('❌ NO VAULT HOLDINGS FOUND');
        console.log('This means either:');
        console.log('  1. No deposits have been made to this contract');
        console.log('  2. Deposits were made to a different contract address');
      } else {
        for (const vault of vaults) {
          const tokenSymbol = vault.token.toLowerCase() === MOCK_USDC.toLowerCase() ? 'USDC' : 'Unknown';
          console.log(`  ${tokenSymbol}:`, ethers.formatUnits(vault.amount, 6));
        }
      }
    } catch (err) {
      console.log('Error reading vaults:', err.message);
    }
    console.log('');
    
    // Test borrow eligibility
    console.log('=== BORROW ELIGIBILITY ===');
    if (borrowTimestamp > 0n) {
      console.log('❌ Cannot borrow: Active loan exists');
      console.log('   You must repay your existing loan before borrowing again');
    } else {
      console.log('✅ No active loan');
      
      // Try to estimate gas for a small borrow
      try {
        const borrowAbi = ['function borrow(tuple(bytes data) encryptedAmount) external'];
        const borrowContract = new ethers.Contract(WALNUT_LENDING, borrowAbi, wallet);
        
        // Create a dummy encrypted input (this won't work but will show if function exists)
        const dummyEncrypted = { data: '0x' + '00'.repeat(32) };
        
        console.log('Testing borrow function...');
        const gasEstimate = await borrowContract.borrow.estimateGas(dummyEncrypted);
        console.log('✅ Borrow function is callable');
      } catch (err) {
        if (err.message.includes('active loan exists')) {
          console.log('❌ Contract says: active loan exists');
        } else if (err.message.includes('No price feed')) {
          console.log('❌ Oracle price feed not configured');
        } else {
          console.log('Borrow test error:', err.message.substring(0, 200));
        }
      }
    }
    console.log('');
    
    // Summary
    console.log('=== DIAGNOSTIC SUMMARY ===');
    const issues = [];
    
    if (oracle.toLowerCase() !== ORACLE_ADDRESS_ENV?.toLowerCase()) {
      issues.push('❌ Oracle address mismatch between contract and .env');
    }
    
    if (priceFeed === ethers.ZeroAddress) {
      issues.push('❌ USDC price feed not configured in oracle');
    }
    
    if (vaults && vaults.length === 0) {
      issues.push('❌ No vault holdings found - deposits may be on wrong contract');
    }
    
    if (borrowTimestamp > 0n) {
      issues.push('⚠️  Active loan exists - must repay before borrowing again');
    }
    
    if (issues.length === 0) {
      console.log('✅ All checks passed!');
    } else {
      console.log('Issues found:');
      issues.forEach(issue => console.log('  ' + issue));
    }
    
  } catch (error) {
    console.error('Diagnostic error:', error);
  }
}

runDiagnostics().catch(console.error);
