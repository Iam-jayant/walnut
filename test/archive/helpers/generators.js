/**
 * Property Test Generators for WalnutV1
 * 
 * This module provides random data generators for property-based testing.
 * Generators create constrained random values that are valid for the
 * WalnutV1 contract's input space.
 * 
 * All generators are designed to produce values within the euint128 range
 * and respect the contract's business logic constraints (LTV limits, etc.).
 */

/**
 * Maximum value for euint128 (2^128 - 1)
 * In practice, we use a smaller max to avoid overflow in calculations
 */
const MAX_UINT128 = BigInt("340282366920938463463374607431768211455");

/**
 * Practical maximum for test values (avoids overflow in mul/div operations)
 * Using 2^64 as a safe upper bound for test amounts
 */
const PRACTICAL_MAX = BigInt("18446744073709551615"); // 2^64 - 1

/**
 * Generate a random uint128 value within a specified range
 * 
 * @param {bigint} min - Minimum value (inclusive), defaults to 0
 * @param {bigint} max - Maximum value (inclusive), defaults to PRACTICAL_MAX
 * @returns {bigint} Random value between min and max
 * 
 * @example
 * const amount = randomUint128();
 * const smallAmount = randomUint128(1n, 1000n);
 * const largeAmount = randomUint128(1000000n, 10000000n);
 */
function randomUint128(min = 0n, max = PRACTICAL_MAX) {
  // Ensure min and max are BigInts
  const minBig = typeof min === 'bigint' ? min : BigInt(min);
  const maxBig = typeof max === 'bigint' ? max : BigInt(max);
  
  // Validate range
  if (minBig < 0n) {
    throw new Error("Minimum value cannot be negative");
  }
  if (maxBig > MAX_UINT128) {
    throw new Error(`Maximum value cannot exceed MAX_UINT128 (${MAX_UINT128})`);
  }
  if (minBig > maxBig) {
    throw new Error("Minimum value cannot be greater than maximum value");
  }
  
  // Calculate range
  const range = maxBig - minBig + 1n;
  
  // Generate random value in range
  // Use crypto.getRandomValues for better randomness
  const randomBytes = new Uint8Array(16); // 128 bits
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    // Fallback for Node.js environment
    const nodeCrypto = require('crypto');
    nodeCrypto.randomFillSync(randomBytes);
  }
  
  // Convert bytes to BigInt
  let randomValue = 0n;
  for (let i = 0; i < randomBytes.length; i++) {
    randomValue = (randomValue << 8n) | BigInt(randomBytes[i]);
  }
  
  // Map to range using modulo
  return minBig + (randomValue % range);
}

/**
 * Generate a random collateral amount suitable for testing
 * Collateral amounts are typically larger values (1000 - 1000000)
 * 
 * @returns {bigint} Random collateral amount
 * 
 * @example
 * const collateral = randomCollateral();
 * await contract.deposit(await encrypt(collateral));
 */
function randomCollateral() {
  return randomUint128(1000n, 1000000n);
}

/**
 * Generate a random debt amount that respects a supplied LTV limit
 * 
 * @param {bigint} collateral - The collateral amount
 * @param {number} ltvBps - LTV in basis points, defaults to tier 0 (7000)
 * @returns {bigint} Random debt amount within LTV limit
 * 
 * @example
 * const collateral = 1000n;
 * const debt = randomDebtWithinLTV(collateral); // Will be <= 800
 * const maxDebt = randomDebtWithinLTV(collateral, 80); // Will be exactly at 80% LTV
 */
function randomDebtWithinLTV(collateral, ltvBps = 7000) {
  const bps = BigInt(ltvBps);
  if (bps < 1n || bps > 10000n) {
    throw new Error("ltvBps must be between 1 and 10000");
  }

  // Calculate max debt at this LTV in basis points
  const maxDebt = (collateral * bps) / 10000n;
  
  // Return random value between 1 and maxDebt
  return randomUint128(1n, maxDebt);
}

/**
 * Generate a random debt amount that exceeds a supplied LTV limit
 * Used for testing LTV enforcement (borrow should fail)
 * 
 * @param {bigint} collateral - The collateral amount
 * @returns {bigint} Random debt amount exceeding 80% LTV
 * 
 * @example
 * const collateral = 1000n;
 * const excessiveDebt = randomDebtExceedingLTV(collateral); // Will be > 800
 */
function randomDebtExceedingLTV(collateral, ltvBps = 7000) {
  const bps = BigInt(ltvBps);
  if (bps < 1n || bps > 9999n) {
    throw new Error("ltvBps must be between 1 and 9999");
  }

  // Calculate LTV threshold from basis points
  const ltvLimit = (collateral * bps) / 10000n;
  
  // Return random value between ltvLimit + 1 and collateral
  return randomUint128(ltvLimit + 1n, collateral);
}

/**
 * Generate a random repayment amount
 * 
 * @param {bigint} debt - Current debt amount
 * @param {boolean} allowOverpayment - If true, may generate amount > debt
 * @returns {bigint} Random repayment amount
 * 
 * @example
 * const debt = 800n;
 * const repayAmount = randomRepayment(debt); // Will be <= 800
 * const overpayAmount = randomRepayment(debt, true); // May be > 800
 */
function randomRepayment(debt, allowOverpayment = false) {
  if (debt === 0n) {
    return 0n;
  }
  
  if (allowOverpayment) {
    // Generate amount between 1 and debt * 2
    return randomUint128(1n, debt * 2n);
  } else {
    // Generate amount between 1 and debt
    return randomUint128(1n, debt);
  }
}

/**
 * Generate a random withdrawal amount
 * 
 * @param {bigint} collateral - Current collateral amount
 * @param {bigint} debt - Current debt amount
 * @param {boolean} allowExcessive - If true, may generate amount > available
 * @returns {bigint} Random withdrawal amount
 * 
 * @example
 * const collateral = 1000n;
 * const debt = 800n;
 * const withdrawAmount = randomWithdrawal(collateral, debt); // Will be <= 200
 * const excessiveAmount = randomWithdrawal(collateral, debt, true); // May be > 200
 */
function randomWithdrawal(collateral, debt, allowExcessive = false) {
  const available = collateral > debt ? collateral - debt : 0n;
  
  if (available === 0n) {
    return 0n;
  }
  
  if (allowExcessive) {
    // Generate amount between 1 and collateral
    return randomUint128(1n, collateral);
  } else {
    // Generate amount between 1 and available
    return randomUint128(1n, available);
  }
}

/**
 * Generate a random health factor value (scaled by 10000)
 * 
 * @param {string} zone - Risk zone: 'safe' (>1.5), 'at-risk' (1.05-1.5), 'liquidatable' (<1.05)
 * @returns {bigint} Random health factor in the specified zone
 * 
 * @example
 * const safeHF = randomHealthFactor('safe'); // Will be > 15000
 * const riskHF = randomHealthFactor('at-risk'); // Will be 10500-15000
 * const liquidatableHF = randomHealthFactor('liquidatable'); // Will be < 10500
 */
function randomHealthFactor(zone = 'safe') {
  switch (zone) {
    case 'safe':
      // Health factor > 1.5 (15000)
      return randomUint128(15001n, 50000n);
    
    case 'at-risk':
      // Health factor between 1.05 and 1.5 (10500-15000)
      return randomUint128(10500n, 15000n);
    
    case 'liquidatable':
      // Health factor < 1.05 (10500)
      return randomUint128(1000n, 10499n);
    
    default:
      throw new Error(`Unknown zone: ${zone}. Use 'safe', 'at-risk', or 'liquidatable'`);
  }
}

/**
 * Generate a random position (collateral + debt) with specified health factor zone
 * 
 * @param {string} zone - Risk zone: 'safe', 'at-risk', or 'liquidatable'
 * @returns {Object} Object with collateral and debt properties
 * 
 * @example
 * const { collateral, debt } = randomPosition('safe');
 * // Health factor will be > 1.5
 * await setupPosition(contract, user, collateral, debt);
 */
function randomPosition(zone = 'safe') {
  const collateral = randomCollateral();
  const targetHealthFactor = randomHealthFactor(zone);
  
  // Calculate debt from: healthFactor = (collateral * 10000) / debt
  // Therefore: debt = (collateral * 10000) / healthFactor
  const debt = (collateral * 10000n) / targetHealthFactor;
  
  // Ensure debt is at least 1 and doesn't exceed collateral
  const finalDebt = debt < 1n ? 1n : (debt > collateral ? collateral : debt);
  
  return {
    collateral,
    debt: finalDebt,
  };
}

/**
 * Generate an array of random uint128 values
 * Useful for running multiple property test iterations
 * 
 * @param {number} count - Number of values to generate
 * @param {bigint} min - Minimum value (inclusive)
 * @param {bigint} max - Maximum value (inclusive)
 * @returns {bigint[]} Array of random values
 * 
 * @example
 * const amounts = randomUint128Array(100); // 100 random amounts
 * for (const amount of amounts) {
 *   // Test with each amount
 * }
 */
function randomUint128Array(count, min = 0n, max = PRACTICAL_MAX) {
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(randomUint128(min, max));
  }
  return result;
}

module.exports = {
  // Core generator
  randomUint128,
  
  // Domain-specific generators
  randomCollateral,
  randomDebtWithinLTV,
  randomDebtExceedingLTV,
  randomRepayment,
  randomWithdrawal,
  randomHealthFactor,
  randomPosition,
  
  // Batch generator
  randomUint128Array,
  
  // Constants
  MAX_UINT128,
  PRACTICAL_MAX,
};
