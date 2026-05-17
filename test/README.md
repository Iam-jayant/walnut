# Walnut Protocol Test Suite

This directory contains all tests for the Walnut Protocol, organized by test type and protocol wave.

## Directory Structure

```
test/
├── unit/                           # Unit tests for individual components
│   └── contracts/                  # Smart contract unit tests
│       ├── wave1/                  # Wave 1 (Core FHE Lending) tests
│       │   └── WalnutV1.test.js
│       └── wave4/                  # Wave 4 (Token Economics) tests
│           ├── MockUSDC.test.js
│           ├── WalnutFHERC20.test.js
│           ├── WalnutPriceOracle.test.js
│           └── WalnutV2.test.js
├── integration/                    # Integration tests
│   └── frontend-integration.test.js
├── helpers/                        # Test utilities and helpers
│   ├── fhe-helpers.js             # FHE encryption/decryption helpers
│   └── generators.js              # Test data generators
├── _archive/                       # Archived/deprecated tests
└── README.md                       # This file
```

## Test Categories

### Unit Tests (`test/unit/`)

Unit tests verify individual contract functions and components in isolation.

**Wave 1 Tests** (`test/unit/contracts/wave1/`):
- `WalnutV1.test.js` - Core FHE lending protocol tests
  - Deposit, borrow, repay, withdraw flows
  - Credit tier system
  - Liquidation mechanism
  - P2P lending
  - ENS wallet aggregation

**Wave 4 Tests** (`test/unit/contracts/wave4/`):
- `MockUSDC.test.js` - Testnet ERC20 token tests
  - Minting functionality
  - Standard ERC20 operations
  - Decimal handling (6 decimals)

- `WalnutFHERC20.test.js` - Encrypted stablecoin tests
  - Minter access control
  - Encrypted mint/burn operations
  - FHERC20 standard compliance

- `WalnutPriceOracle.test.js` - Chainlink oracle integration tests
  - Price feed configuration
  - USD value calculation
  - Staleness checks
  - Decimal conversion

- `WalnutV2.test.js` - Token economics protocol tests
  - Real token deposits (USDC, WETH)
  - Encrypted stablecoin borrowing
  - Interest calculation (8% APR)
  - Credit tier LTV enforcement
  - Repay with settlement
  - Withdraw with LTV safety checks

### Integration Tests (`test/integration/`)

Integration tests verify complete user flows across multiple components.

- `frontend-integration.test.js` - End-to-end frontend tests
  - Wallet connection
  - Token approval flows
  - Complete lending cycles
  - UI state management

### Test Helpers (`test/helpers/`)

Reusable utilities for test setup and execution.

- `fhe-helpers.js` - FHE encryption/decryption utilities
  - CoFHE SDK integration
  - Encrypted value generation
  - Permission management

- `generators.js` - Test data generators
  - Random addresses
  - Mock transaction data
  - Test fixtures

## Running Tests

### Run All Tests
```bash
npx hardhat test
```

### Run Specific Test Suite
```bash
# Wave 1 tests
npx hardhat test test/unit/contracts/wave1/WalnutV1.test.js

# Wave 4 tests
npx hardhat test test/unit/contracts/wave4/*.test.js

# Integration tests
npx hardhat test test/integration/*.test.js
```

### Run Tests with Coverage
```bash
npx hardhat coverage
```

### Run Tests with Gas Reporting
```bash
REPORT_GAS=true npx hardhat test
```

## Test Conventions

### File Naming
- Unit tests: `<ContractName>.test.js`
- Integration tests: `<feature>-integration.test.js`
- Helpers: `<utility>-helpers.js`

### Test Structure
```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ContractName", function () {
  let contract;
  let owner, user1, user2;

  beforeEach(async function () {
    // Setup code
    [owner, user1, user2] = await ethers.getSigners();
    const Contract = await ethers.getContractFactory("ContractName");
    contract = await Contract.deploy();
  });

  describe("Function Group", function () {
    it("should do something specific", async function () {
      // Test code
      expect(await contract.someFunction()).to.equal(expectedValue);
    });
  });
});
```

### Assertions
- Use Chai's `expect` syntax for assertions
- Test both success and failure cases
- Verify events are emitted correctly
- Check state changes after transactions

### FHE Testing
- Use `fhe-helpers.js` for encrypted value generation
- Test both encrypted and decrypted states
- Verify FHE permissions are granted correctly
- Test FHE.select conditional logic

## Test Coverage Goals

### Wave 1 (WalnutV1)
- ✅ Core lending operations (deposit, borrow, repay, withdraw)
- ✅ Credit tier system
- ✅ Liquidation mechanism
- ✅ P2P lending
- ✅ ENS aggregation
- ✅ Pause mechanism
- ✅ Access control

### Wave 4 (Token Economics)
- ✅ MockUSDC minting and transfers
- ✅ WalnutFHERC20 encrypted operations
- ✅ WalnutPriceOracle Chainlink integration
- ✅ WalnutV2 deposit flow
- ✅ WalnutV2 borrow flow with LTV
- ✅ WalnutV2 interest calculation
- ✅ WalnutV2 repay flow
- ✅ WalnutV2 withdraw flow
- ⏳ Integration tests (optional)
- ⏳ Gas optimization tests (optional)
- ⏳ Error handling tests (optional)

## Adding New Tests

### 1. Create Test File
Place the test file in the appropriate directory:
- Unit tests → `test/unit/contracts/wave<N>/`
- Integration tests → `test/integration/`

### 2. Follow Naming Convention
- Use descriptive names: `<ContractName>.test.js`
- Group related tests in `describe` blocks
- Use clear `it` descriptions

### 3. Use Test Helpers
- Import helpers from `test/helpers/`
- Reuse common setup code
- Share test fixtures

### 4. Document Test Purpose
- Add comments explaining complex test logic
- Document expected behavior
- Note any assumptions or prerequisites

## Continuous Integration

Tests are automatically run on:
- Pull requests
- Commits to main branch
- Pre-deployment checks

## Troubleshooting

### Common Issues

**Issue**: Tests fail with "CoFHE not available"
**Solution**: Ensure CoFHE mock is properly initialized in test setup

**Issue**: Gas estimation errors
**Solution**: Increase gas limit in hardhat.config.ts

**Issue**: Timeout errors
**Solution**: Increase mocha timeout in hardhat.config.ts

**Issue**: FHE permission errors
**Solution**: Verify FHE.allow() is called before accessing encrypted values

## Resources

- [Hardhat Testing Guide](https://hardhat.org/tutorial/testing-contracts)
- [Chai Assertion Library](https://www.chaijs.com/)
- [CoFHE Documentation](https://docs.fhenix.zone)
- [Walnut Protocol Documentation](../README.md)

---

**Last Updated**: January 2025  
**Test Framework**: Hardhat + Mocha + Chai  
**Coverage Tool**: Solidity Coverage
