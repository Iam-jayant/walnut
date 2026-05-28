/**
 * Script to mint mock USDC tokens
 * Run with: node scripts/mint-mock-usdc.js <RECIPIENT_ADDRESS> <AMOUNT>
 */

const { ethers } = require('hardhat');
require('dotenv').config();

const MOCK_USDC_ADDRESS = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS;

// Minimal ABI for MockUSDC
const MOCK_USDC_ABI = [
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'mint',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function mintMockUSDC(recipient, amount) {
  console.log('\n=== Minting Mock USDC ===\n');
  console.log('Mock USDC Address:', MOCK_USDC_ADDRESS);
  console.log('Recipient:', recipient);
  console.log('Amount:', amount, 'USDC\n');

  // Get signer
  const [signer] = await ethers.getSigners();
  console.log('Minting from:', signer.address);

  // Connect to MockUSDC contract
  const mockUSDC = new ethers.Contract(MOCK_USDC_ADDRESS, MOCK_USDC_ABI, signer);

  // Get decimals
  const decimals = await mockUSDC.decimals();
  console.log('USDC Decimals:', decimals);

  // Convert amount to wei (USDC has 6 decimals)
  const amountWei = ethers.parseUnits(amount.toString(), decimals);
  console.log('Amount in wei:', amountWei.toString());

  // Check balance before
  const balanceBefore = await mockUSDC.balanceOf(recipient);
  console.log('\nBalance before:', ethers.formatUnits(balanceBefore, decimals), 'USDC');

  // Mint tokens
  console.log('\nMinting tokens...');
  const tx = await mockUSDC.mint(recipient, amountWei);
  console.log('Transaction hash:', tx.hash);
  console.log('Waiting for confirmation...');

  const receipt = await tx.wait();
  console.log('✅ Transaction confirmed in block:', receipt.blockNumber);

  // Check balance after
  const balanceAfter = await mockUSDC.balanceOf(recipient);
  console.log('\nBalance after:', ethers.formatUnits(balanceAfter, decimals), 'USDC');
  console.log('Minted:', ethers.formatUnits(balanceAfter - balanceBefore, decimals), 'USDC');

  console.log('\n✅ Mock USDC minted successfully!\n');
}

// Get arguments from environment variables, command line, or use defaults
const recipient = process.env.RECIPIENT || process.argv[2] || '0x65c3768E98eE211a7589fe94c753e11cB8895069';
const amount = process.env.AMOUNT || process.argv[3] || '10000'; // Default 10000 USDC

console.log('Arguments:', { recipient, amount });

if (!MOCK_USDC_ADDRESS) {
  console.error('Error: NEXT_PUBLIC_MOCK_USDC_ADDRESS not set in .env');
  process.exit(1);
}

mintMockUSDC(recipient, amount)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  });
