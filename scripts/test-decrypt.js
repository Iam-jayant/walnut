const { ethers } = require('ethers');
require('dotenv').config();

const provider = new ethers.JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
const TM = '0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9';
const LENDING = process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS;

// Try calling each TaskManager function individually to find what works
const iface = new ethers.Interface([
  'function createTask(uint8 returnType, uint8 funcId, uint256[] encryptedInputs, uint256[] extraInputs) external returns (uint256)',
  'function createDecryptTask(uint256 ctHash, address requestor) external',
  'function allow(uint256 ctHash, address account) external',
  'function isAllowed(uint256 ctHash, address account) external returns (bool)',
  'function allowGlobal(uint256 ctHash) external',
]);

// Test with the collateral handle - it's already allowed for LENDING
const collHandle = '81997297882548224520809904813072308697562977900227189029537605457455558100480';

async function tryCall(fnName, args, from) {
  try {
    const data = iface.encodeFunctionData(fnName, args);
    const result = await provider.call({ to: TM, data, from });
    console.log(fnName + ' SUCCEEDED from=' + (from || 'default') + ':', result.substring(0, 30));
    return { success: true, result };
  } catch(e) {
    const rd = e.data || e.info?.error?.data;
    console.log(fnName + ' FAILED from=' + (from || 'default') + ': revert_data=' + (rd || 'none'));
    return { success: false, error: e };
  }
}

async function main() {
  console.log('=== TaskManager Function Tests ===');
  console.log('TM:', TM);
  console.log('Lending:', LENDING);
  console.log('collHandle:', collHandle.substring(0, 20) + '...');
  console.log('');
  
  // Test 1: isAllowed (view function - works via eth_call)
  await tryCall('isAllowed', [BigInt(collHandle), LENDING], LENDING);
  
  // Test 2: allow (should be called by contract, but let's see from outside)
  await tryCall('allow', [BigInt(collHandle), '0x0000000000000000000000000000000000000001'], LENDING);
  
  // Test 3: allowGlobal
  await tryCall('allowGlobal', [BigInt(collHandle)], LENDING);
  
  // Test 4: createDecryptTask with collHandle that IS allowed
  await tryCall('createDecryptTask', [BigInt(collHandle), LENDING], LENDING);
  
  // Test 5: Try a trivialEncrypt task (to get a fresh handle we know will be allowed)
  // createTask(returnType=6 for uint128, funcId=26 for trivialEncrypt, inputs=[], extra=[value, type, zone])
  const trivialEncryptFuncId = 26; // trivialEncrypt
  const uint128Type = 6;
  const extra = [BigInt(12345), BigInt(uint128Type), BigInt(0)]; // value=12345, type=uint128, zone=0
  const taskResult = await tryCall('createTask', [uint128Type, trivialEncryptFuncId, [], extra.map(BigInt)], LENDING);
  
  if (taskResult.success) {
    const newHandle = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], taskResult.result)[0];
    console.log('New handle from trivialEncrypt:', newHandle.toString());
    
    // Now try to allowGlobal on the new handle
    await tryCall('allowGlobal', [newHandle], LENDING);
    
    // Now try createDecryptTask on the new handle
    await tryCall('createDecryptTask', [newHandle, LENDING], LENDING);
  }
}
main().catch(console.error);
