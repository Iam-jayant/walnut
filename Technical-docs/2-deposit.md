# Collateral Deposit — Technical Documentation

## Overview

The Collateral Deposit functionality allows users to lock standard ERC20 stablecoins (such as USDC) into the protocol as collateral. Once deposited, the raw collateral value is encrypted into FHE state (`euint128`), unlocking private borrowing capacity while shielding the user's total net worth and position size from public observation.

---

## How It Works Under the Hood

### 1. Two-Step Execution & Entry-Wrap Boundary
Because standard ERC20 token transfers (`transferFrom`) require plaintext numbers at the token smart contract layer, depositing collateral involves an entry-wrap boundary transition:

1. **ERC20 Token Approval:** The user grants `WalnutLendingV2` permission to spend standard USDC via `IERC20.approve()`.
2. **Encrypted Input Preparation:** On the frontend (`app/app/deposit/page.tsx`), the deposit amount is encrypted client-side using `@cofhe/sdk` into an `InEuint128` ciphertext structure.
3. **Contract Function Invocation:** The user calls `deposit(address token, InEuint128 calldata encryptedAmount)` on `WalnutLendingV2.sol`.

```solidity
function deposit(address token, InEuint128 calldata encryptedAmount) external nonReentrant whenNotPaused {
    euint128 amount = FHE.asEuint128(encryptedAmount);
    FHE.allowThis(amount);

    uint256 requestId = _requestDecrypt(amount);
    _pendingDeposits[requestId] = PendingDeposit({ user: msg.sender, token: token });

    emit Deposited(msg.sender, token);
    emit DepositSyncRequested(msg.sender, requestId);
}
```

### 2. Async Decryption Request & CoFHE Relay Callback
To execute the physical ERC20 token transfer without exposing unverified caller amounts, `WalnutLendingV2` initiates an asynchronous CoFHE decryption request:

- The contract records `_pendingDeposits[requestId]` keyed by the unique ciphertext request ID (`uint256(euint128.unwrap(amount))`).
- It emits a privacy-safe event `DepositSyncRequested(user, requestId)`—**emitting zero plaintext amounts**.
- The frontend / relayer service (`app/api/walnut/sync-decrypt/route.ts`) polls the CoFHE oracle via `cofheClient.decryptForTx(requestId)`.
- Upon CoFHE coprocessor threshold consensus, the CoFHE oracle returns the verified decrypted integer along with an ECDSA signature verified by Fhenix's `TaskManager`.

### 3. State Finalization & Encrypted Collateral Scaling
The relayer invokes `syncDepositTransfer(ciphertext, result, signature)` to complete state mutations on-chain:

```solidity
// 1. Verify threshold signature
ITaskManager(TASK_MANAGER_ADDRESS).verifyDecryptResult(uint256(ciphertext), uint256(result), signature);

// 2. Transfer physical ERC20 collateral into vault
IERC20(token).safeTransferFrom(user, address(this), amount);

// 3. Oracle USD Valuation & FHE Encryption
uint256 usdValue = oracle.getUSDValue(token, amount);
euint128 encryptedUSD = FHE.asEuint128(uint128(usdValue));
FHE.allowThis(encryptedUSD);

// 4. Update encrypted collateral state
euint128 currentCollateral = _safeEncrypted(_collateral[user]);
euint128 newCollateral = FHE.add(currentCollateral, encryptedUSD);
_allowBalance(newCollateral, user);
_collateral[user] = newCollateral;

// 5. Update protocol aggregate
totalDeposited += amount;
```

---

## Technical Highlights & Under-the-Hood Points

- **Privacy Transition:** While the initial ERC20 `transferFrom` transaction is visible on the ERC20 contract level, all subsequent collateral balance tracking, borrowing limits, and health factor calculations inside Walnut are strictly maintained in FHE (`euint128`).
- **Oracle USD Normalization:** `WalnutPriceOracle.sol` fetches Chainlink asset prices, converting token amounts into standardized 18-decimal USD values before encrypting them into the user's collateral pool.
- **Access Permissioning (`_allowBalance`):** The contract grants decryption access over `newCollateral` to both the primary depositor address and any linked secondary ENS wallets via `FHE.allow`.
- **Reentrancy Protection:** All state-changing entry points use OpenZeppelin's `ReentrancyGuard` (`nonReentrant`) to prevent reentrancy during external token transfers and CoFHE callbacks.

---

## Smart Contract Contribution

| Contract / Layer | Function | Technical Contribution |
|------------------|----------|------------------------|
| `WalnutLendingV2.sol` | `deposit()` | Accepts `InEuint128` encrypted input, registers pending deposit, and requests CoFHE decryption. |
| `WalnutLendingV2.sol` | `syncDepositTransfer()` | Verifies CoFHE signature, transfers ERC20, queries oracle USD value, and performs `FHE.add` to update collateral ciphertext. |
| `WalnutPriceOracle.sol` | `getUSDValue()` | Converts collateral token precision to USD denomination using Chainlink price feeds. |
| `MockUSDC.sol` / `IERC20` | `safeTransferFrom()` | Handles physical token transfer from user wallet into protocol escrow vault. |
