#!/usr/bin/env node

/**
 * Diagnostic script to check CoFHE permit status
 * Run this in the browser console after connecting wallet
 */

console.log("=== CoFHE Permit Diagnostic ===\n");

// Check localStorage for permits
const permitKeys = Object.keys(localStorage).filter(key => 
  key.includes('cofhe') || key.includes('permit')
);

console.log("1. LocalStorage Keys Related to CoFHE/Permits:");
if (permitKeys.length === 0) {
  console.log("   ❌ No permit-related keys found in localStorage");
} else {
  permitKeys.forEach(key => {
    const value = localStorage.getItem(key);
    console.log(`   - ${key}:`);
    try {
      const parsed = JSON.parse(value);
      console.log(`     ${JSON.stringify(parsed, null, 2)}`);
    } catch {
      console.log(`     ${value}`);
    }
  });
}

// Check for the specific permit key format used by CoFHE SDK
const chainId = 421614; // Arbitrum Sepolia
const address = window.ethereum?.selectedAddress;

if (address) {
  console.log(`\n2. Checking for permit with chainId=${chainId}, address=${address}`);
  
  const possibleKeys = [
    `cofhesdk-permits`,
    `cofhe-permits-${chainId}`,
    `cofhe-permits-${chainId}-${address.toLowerCase()}`,
    `walnut_active_permit_hash_${chainId}_${address.toLowerCase()}`,
  ];
  
  possibleKeys.forEach(key => {
    const value = localStorage.getItem(key);
    if (value) {
      console.log(`   ✅ Found: ${key}`);
      try {
        const parsed = JSON.parse(value);
        console.log(`      ${JSON.stringify(parsed, null, 2)}`);
      } catch {
        console.log(`      ${value}`);
      }
    } else {
      console.log(`   ❌ Not found: ${key}`);
    }
  });
} else {
  console.log("\n2. ❌ No wallet connected (window.ethereum.selectedAddress is undefined)");
}

console.log("\n3. Instructions:");
console.log("   - Copy this entire script");
console.log("   - Open browser DevTools (F12)");
console.log("   - Go to Console tab");
console.log("   - Paste and press Enter");
console.log("   - Share the output to diagnose permit issues");
