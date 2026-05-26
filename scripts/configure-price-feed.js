const { ethers } = require('ethers');
require('dotenv').config();

async function configurePriceFeed() {
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_SEPOLIA_RPC_URL);
  const privateKey = process.env.PRIVATE_KEY.startsWith('0x') ? process.env.PRIVATE_KEY : '0x' + process.env.PRIVATE_KEY;
  const wallet = new ethers.Wallet(privateKey, provider);
  
  // Get the actual oracle from WalnutLending contract
  const WALNUT_LENDING = process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS;
  const walnutAbi = ['function oracle() view returns (address)'];
  const walnut = new ethers.Contract(WALNUT_LENDING, walnutAbi, provider);
  const ORACLE_ADDRESS = await walnut.oracle();
  
  const MOCK_USDC_ADDRESS = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS;
  const MOCK_USDC_PRICE_FEED = process.env.NEXT_PUBLIC_MOCK_USDC_PRICE_FEED_ADDRESS;
  
  console.log('WalnutLending Address:', WALNUT_LENDING);
  console.log('Oracle Address (from contract):', ORACLE_ADDRESS);
  console.log('USDC Address:', MOCK_USDC_ADDRESS);
  console.log('USDC Price Feed:', MOCK_USDC_PRICE_FEED);
  console.log('Wallet Address:', wallet.address);
  
  const oracleAbi = [
    'function setPriceFeed(address token, address feed) external',
    'function priceFeeds(address) view returns (address)',
    'function owner() view returns (address)'
  ];
  
  const oracle = new ethers.Contract(ORACLE_ADDRESS, oracleAbi, wallet);
  
  // Check current owner
  try {
    const owner = await oracle.owner();
    console.log('Oracle Owner:', owner);
    console.log('Is wallet owner?', owner.toLowerCase() === wallet.address.toLowerCase());
  } catch (err) {
    console.log('Could not check owner:', err.message);
  }
  
  // Check current price feed
  const currentFeed = await oracle.priceFeeds(MOCK_USDC_ADDRESS);
  console.log('Current USDC Price Feed:', currentFeed);
  
  if (currentFeed === ethers.ZeroAddress || currentFeed === '0x0000000000000000000000000000000000000000') {
    console.log('\nSetting USDC price feed...');
    const tx = await oracle.setPriceFeed(MOCK_USDC_ADDRESS, MOCK_USDC_PRICE_FEED);
    console.log('Transaction hash:', tx.hash);
    console.log('Waiting for confirmation...');
    await tx.wait();
    console.log('✅ Price feed configured successfully!');
  } else {
    console.log('✅ Price feed already configured');
  }
}

configurePriceFeed().catch(console.error);
