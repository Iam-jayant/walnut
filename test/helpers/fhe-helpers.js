/**
 * FHE Helper Functions for WalnutV1 Testing
 * 
 * This module provides encryption and decryption utilities for testing
 * the WalnutV1 contract with the cofhe hardhat mock coprocessor.
 * 
 * These helpers abstract the cofhe API to provide simple encrypt/decrypt
 * functions that can be used throughout the test suite.
 */

const { cofhe, ethers } = require("hardhat");

const TASK_MANAGER_ADDRESS = "0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9";
const TASK_MANAGER_ABI = [
  "function verifyInput((uint256 ctHash,uint8 securityZone,uint8 utype,bytes signature) input,address sender) returns (uint256)",
  "function MOCK_setInEuintKey(uint256 ctHash,uint256 value)",
];

let taskManager;
let mockCipherCounter = 1n;

async function getTaskManager() {
  if (!taskManager) {
    taskManager = await ethers.getContractAt(TASK_MANAGER_ABI, TASK_MANAGER_ADDRESS);
  }

  return taskManager;
}

/**
 * Encrypt a uint128 value for use in contract function calls
 * 
 * @param {number|bigint|string} amount - The amount to encrypt
 * @returns {Promise<Object>} Encrypted InEuint128 struct with ctHash, securityZone, utype, signature
 * 
 * @example
 * const encryptedAmount = await encrypt(1000);
 * await contract.deposit(encryptedAmount);
 */
async function encrypt(amount) {
  // Convert to BigInt if needed
  const value = typeof amount === 'bigint' ? amount : BigInt(amount);

  const manager = await getTaskManager();
  const preCtHash = mockCipherCounter << 24n;
  mockCipherCounter += 1n;

  const encryptedInput = {
    ctHash: preCtHash,
    securityZone: 0,
    utype: 6,
    signature: "0x",
  };

  const [defaultSigner] = await ethers.getSigners();
  const appendedHash = await manager.verifyInput.staticCall(encryptedInput, defaultSigner.address);
  await manager.MOCK_setInEuintKey(appendedHash, value);

  return encryptedInput;
}

/**
 * Decrypt an encrypted uint128 value from the contract
 * 
 * @param {Object} encryptedValue - The encrypted value struct from contract (with ctHash property)
 * @returns {Promise<bigint>} Decrypted plaintext value as BigInt
 * 
 * @example
 * const encryptedCollateral = await contract.getEncryptedCollateral(userAddress);
 * const plaintext = await decrypt(encryptedCollateral);
 * console.log(`Collateral: ${plaintext}`);
 */
async function decrypt(encryptedValue) {
  // Extract ctHash from the encrypted value struct
  const ctHash = BigInt(encryptedValue.ctHash || encryptedValue);

  // For hardhat mock tests, plaintext is available from the mock task manager.
  return await cofhe.mocks.getPlaintext(ctHash);
}

/**
 * Decrypt collateral for a specific user
 * 
 * @param {Object} contract - The WalnutWave2 contract instance
 * @param {string} userAddress - The user's address
 * @returns {Promise<bigint>} Decrypted collateral value
 * 
 * @example
 * const collateral = await decryptCollateral(contract, user1.address);
 * expect(collateral).to.equal(1000n);
 */
async function decryptCollateral(contract, userAddress) {
  const encryptedValue = await contract.getEncryptedCollateral(userAddress);
  return await decrypt(encryptedValue);
}

/**
 * Decrypt debt for a specific user
 * 
 * @param {Object} contract - The WalnutWave2 contract instance
 * @param {string} userAddress - The user's address
 * @returns {Promise<bigint>} Decrypted debt value
 * 
 * @example
 * const debt = await decryptDebt(contract, user1.address);
 * expect(debt).to.equal(800n);
 */
async function decryptDebt(contract, userAddress) {
  const encryptedValue = await contract.getEncryptedDebt(userAddress);
  return await decrypt(encryptedValue);
}

/**
 * Decrypt health factor for a specific user
 * 
 * @param {Object} contract - The WalnutWave2 contract instance
 * @param {string} userAddress - The user's address
 * @returns {Promise<bigint>} Decrypted health factor value (scaled by 10000)
 * 
 * @example
 * const healthFactor = await decryptHealthFactor(contract, user1.address);
 * // healthFactor = 12500 means 1.25 (collateral / debt ratio)
 * expect(healthFactor).to.be.greaterThan(10500n); // Above liquidation threshold
 */
async function decryptHealthFactor(contract, userAddress) {
  const healthFactorCt = await contract.getHealthFactor.staticCall(userAddress);
  return await decrypt(healthFactorCt);
}

/**
 * Decrypt aggregated collateral for a primary wallet
 *
 * @param {Object} contract - The Walnut contract instance
 * @param {string} primaryWallet - The primary wallet address
 * @returns {Promise<bigint>} Decrypted aggregated collateral value
 */
async function decryptAggregatedCollateral(contract, primaryWallet) {
  // In mock mode, static calls don't persist intermediate operation outputs.
  // Send one transaction to materialize the computed aggregate ctHash in storage.
  const tx = await contract.getAggregatedCollateral(primaryWallet);
  await tx.wait();

  const aggregatedCt = await contract.getAggregatedCollateral.staticCall(primaryWallet);
  return await decrypt(aggregatedCt);
}

/**
 * Setup and deposit collateral for a user (test helper)
 * 
 * @param {Object} contract - The WalnutV1 contract instance
 * @param {Object} signer - The ethers signer for the user
 * @param {bigint} amount - The collateral amount to deposit
 * @returns {Promise<void>}
 * 
 * @example
 * await setupCollateral(contract, user1, 1000n);
 * const collateral = await decryptCollateral(contract, user1.address);
 * expect(collateral).to.equal(1000n);
 */
async function setupCollateral(contract, signer, amount) {
  const encryptedAmount = await encrypt(amount);
  const tx = await contract.connect(signer).deposit(encryptedAmount);
  await tx.wait();
}

/**
 * Setup collateral and borrow debt for a user (test helper)
 * 
 * @param {Object} contract - The WalnutV1 contract instance
 * @param {Object} signer - The ethers signer for the user
 * @param {bigint} collateralAmount - The collateral amount to deposit
 * @param {bigint} borrowAmount - The debt amount to borrow
 * @returns {Promise<void>}
 * 
 * @example
 * // Setup position with 1000 collateral and 800 debt (80% LTV)
 * await setupPosition(contract, user1, 1000n, 800n);
 * const debt = await decryptDebt(contract, user1.address);
 * expect(debt).to.equal(800n);
 */
async function setupPosition(contract, signer, collateralAmount, borrowAmount) {
  // First deposit collateral
  await setupCollateral(contract, signer, collateralAmount);
  
  // Then borrow against it
  const encryptedBorrow = await encrypt(borrowAmount);
  const tx = await contract.connect(signer).borrow(encryptedBorrow);
  await tx.wait();
}

/**
 * Decrypt repayment count for a specific user
 *
 * @param {Object} contract - The WalnutV1 contract instance
 * @param {string} userAddress - The user's address
 * @returns {Promise<bigint>} Decrypted repayment count
 */
async function decryptRepaymentCount(contract, userAddress) {
  const encryptedValue = await contract.getEncryptedRepaymentCount(userAddress);
  return await decrypt(encryptedValue);
}

/**
 * Decrypt default count for a specific user
 *
 * @param {Object} contract - The WalnutV1 contract instance
 * @param {string} userAddress - The user's address
 * @returns {Promise<bigint>} Decrypted default count
 */
async function decryptDefaultCount(contract, userAddress) {
  const encryptedValue = await contract.getEncryptedDefaultCount(userAddress);
  return await decrypt(encryptedValue);
}

/**
 * Decrypt total pool collateral
 *
 * @param {Object} contract - The WalnutV1 contract instance
 * @returns {Promise<bigint>} Decrypted total pool collateral
 */
async function decryptTotalPoolCollateral(contract) {
  const encryptedValue = await contract.getEncryptedTotalPoolCollateral();
  return await decrypt(encryptedValue);
}

/**
 * Decrypt total pool debt
 *
 * @param {Object} contract - The WalnutV1 contract instance
 * @returns {Promise<bigint>} Decrypted total pool debt
 */
async function decryptTotalPoolDebt(contract) {
  const encryptedValue = await contract.getEncryptedTotalPoolDebt();
  return await decrypt(encryptedValue);
}

module.exports = {
  encrypt,
  decrypt,
  decryptCollateral,
  decryptDebt,
  decryptHealthFactor,
  decryptAggregatedCollateral,
  decryptRepaymentCount,
  decryptDefaultCount,
  decryptTotalPoolCollateral,
  decryptTotalPoolDebt,
  setupCollateral,
  setupPosition,
};
