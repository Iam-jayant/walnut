const { ethers } = require('ethers');
require('dotenv').config();

async function initializeTierLTVs() {
  console.log('\n=== INITIALIZING TIER LTVs ===\n');
  
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_SEPOLIA_RPC_URL);
  const privateKey = process.env.PRIVATE_KEY.startsWith('0x') ? process.env.PRIVATE_KEY : '0x' + process.env.PRIVATE_KEY;
  const wallet = new ethers.Wallet(privateKey, provider);
  
  const WALNUT_LENDING = process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS;
  
  console.log('WalnutLending Address:', WALNUT_LENDING);
  console.log('Wallet Address:', wallet.address);
  console.log('');
  
  // Check if contract has a setTierLTV function
  const walnutAbi = [
    'function owner() view returns (address)',
    'function tierLTVs(uint8) view returns (uint16)',
    'function setTierLTV(uint8 tier, uint16 ltv) external'
  ];
  
  const walnut = new ethers.Contract(WALNUT_LENDING, walnutAbi, wallet);
  
  try {
    const owner = await walnut.owner();
    console.log('Contract Owner:', owner);
    console.log('Is wallet owner?', owner.toLowerCase() === wallet.address.toLowerCase());
    console.log('');
    
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
      console.log('❌ Wallet is not the owner. Cannot set tier LTVs.');
      return;
    }
    
    // Check current values
    console.log('=== CURRENT TIER LTVs ===');
    for (let tier = 0; tier <= 4; tier++) {
      try {
        const ltv = await walnut.tierLTVs(tier);
        console.log(`Tier ${tier}: ${ltv} bps (${Number(ltv) / 100}%)`);
      } catch (err) {
        console.log(`Tier ${tier}: NOT SET or reverts`);
      }
    }
    console.log('');
    
    // Set tier LTVs
    console.log('=== SETTING TIER LTVs ===');
    const tierLTVs = [
      { tier: 0, ltv: 7000 },  // 70%
      { tier: 1, ltv: 7500 },  // 75%
      { tier: 2, ltv: 8000 },  // 80%
      { tier: 3, ltv: 8500 },  // 85%
      { tier: 4, ltv: 9000 },  // 90%
    ];
    
    for (const { tier, ltv } of tierLTVs) {
      try {
        console.log(`Setting Tier ${tier} to ${ltv} bps (${ltv / 100}%)...`);
        const tx = await walnut.setTierLTV(tier, ltv);
        console.log(`  Transaction: ${tx.hash}`);
        await tx.wait();
        console.log(`  ✅ Confirmed`);
      } catch (err) {
        if (err.message.includes('setTierLTV')) {
          console.log(`  ❌ Function setTierLTV does not exist on this contract`);
          console.log(`  This means the contract was deployed with tierLTVs in constructor`);
          console.log(`  The issue might be that the contract needs to be redeployed`);
          break;
        } else {
          console.log(`  ❌ Error: ${err.message}`);
        }
      }
    }
    
    console.log('');
    console.log('=== VERIFICATION ===');
    for (let tier = 0; tier <= 4; tier++) {
      try {
        const ltv = await walnut.tierLTVs(tier);
        console.log(`Tier ${tier}: ${ltv} bps (${Number(ltv) / 100}%) ✅`);
      } catch (err) {
        console.log(`Tier ${tier}: ❌ Still not accessible`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

initializeTierLTVs().catch(console.error);
