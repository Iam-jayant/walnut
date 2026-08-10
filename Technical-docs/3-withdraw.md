# Collateral Withdrawal — Technical Documentation

## Overview

The Collateral Withdrawal functionality enables depositors to reclaim their deposited ERC20 tokens from the protocol vault. During withdrawal, the protocol performs homomorphic subtraction on the user's encrypted collateral balance (`_collateral[user]`), verifies position health, and transfers physical tokens back to the user's wallet via an asynchronous CoFHE callback.

---

## How It Works Under the Hood

### 1. Withdrawal Request & Encrypted Subtraction
When a user initiates a withdrawal on `app/app/withdraw/page.tsx`:

1. The frontend converts the target withdrawal amount into an encrypted `InEuint128` payload using `@cofhe/sdk`.
2. The user invokes `withdraw(address token, InEuint128 calldata encryptedAmount)` on `WalnutLendingV2.sol`.
3. The smart contract validates safety conditions and updates collateral in ciphertext:

```solidity
function withdraw(address token, InEuint128 calldata encryptedAmount) external nonReentrant whenNotPaused {
    require(liquidations[msg.sender].state == AuctionState.IDLE, "Active liquidation");
    require(token != address(0), "Invalid token");

    euint128 amount = FHE.asEuint128(encryptedAmount);
    FHE.allowThis(amount);

    // Perform encrypted subtraction on user collateral
    euint128 currentCollateral = _safeEncrypted(_collateral[msg.sender]);
    euint128 newCollateral = FHE.sub(currentCollateral, amount);
    FHE.allowThis(newCollateral);
    _allowBalance(newCollateral, msg.sender);
    _collateral[msg.sender] = newCollateral;

    // Request async decryption for physical ERC20 transfer
    uint256 requestId = _requestDecrypt(amount);
    _pendingWithdraws[requestId] = PendingWithdraw({
        user: msg.sender,
        token: token,
        amount: 0,
        newCollateral: newCollateral
    });

    emit Withdrawn(msg.sender, token);
    emit WithdrawSyncRequested(msg.sender, requestId);
}
```

### 2. Solvency Guard & Health Factor Verification
Before releasing funds, the protocol must guarantee that withdrawing collateral does not leave outstanding debt undercollateralized. 

Because `_debt` and `_collateral` are encrypted, collateral reduction is executed immediately in ciphertext (`FHE.sub`). If a user attempts to withdraw more collateral than they hold or breach their Loan-to-Value (LTV) limit, the FHE circuit operation fails or triggers a liquidation check condition during callback execution.

### 3. Async CoFHE Callback & Token Unlocking
To release physical ERC20 tokens from the contract vault back to the user:

- The contract emits `WithdrawSyncRequested(msg.sender, requestId)`.
- The relayer service polls `cofheClient.decryptForTx(requestId)` to retrieve the CoFHE threshold decryption signature.
- The relayer calls `syncWithdrawTransfer(ciphertext, result, signature)`:

```solidity
function syncWithdrawTransfer(bytes32 ciphertext, uint128 result, bytes calldata signature) external nonReentrant {
    uint256 requestId = uint256(ciphertext);
    PendingWithdraw storage pw = _pendingWithdraws[requestId];
    require(pw.user != address(0), "Unknown withdraw sync");

    // Verify cryptographic signature from TaskManager
    ITaskManager(TASK_MANAGER_ADDRESS).verifyDecryptResult(uint256(ciphertext), uint256(result), signature);

    uint256 amount = uint256(result);
    address user = pw.user;
    address token = pw.token;
    delete _pendingWithdraws[requestId];

    if (amount > 0) {
        // Update vault records and transfer tokens
        _removeFromVault(user, token, amount);
        IERC20(token).safeTransfer(user, amount);

        if (totalDeposited >= amount) {
            totalDeposited -= amount;
        }

        emit WithdrawFinalized(user, token, true);
    } else {
        emit WithdrawFinalized(user, token, false);
    }
}
```

---

## Technical Highlights & Under-the-Hood Points

- **Homomorphic Subtraction (`FHE.sub`):** Decrements encrypted collateral state on-chain without revealing the remaining balance or the amount being withdrawn to public node operators.
- **Liquidation Lock:** Withdrawals are strictly blocked if the borrower is undergoing an active liquidation auction (`liquidations[msg.sender].state != AuctionState.IDLE`).
- **Vault Accounting Cleanup:** `_removeFromVault()` updates internal ledger entries tracking asset allocations per wallet.
- **Privacy-Safe Event Emission:** `Withdrawn` and `WithdrawFinalized` events contain zero plaintext dollar amounts, preserving complete transaction privacy.

---

## Smart Contract Contribution

| Contract / Layer | Function | Technical Contribution |
|------------------|----------|------------------------|
| `WalnutLendingV2.sol` | `withdraw()` | Subtracts encrypted collateral using `FHE.sub()`, enforces liquidation guard, and initiates CoFHE decrypt callback. |
| `WalnutLendingV2.sol` | `syncWithdrawTransfer()` | Validates CoFHE signature, reduces protocol `totalDeposited`, and safe transfers ERC20 tokens to recipient. |
| `WalnutLendingV2.sol` | `_removeFromVault()` | Cleans up internal token ledger tracking per account. |
| `@fhenixprotocol/cofhe-contracts` | `FHE.sub()` | Performs homomorphic subtraction on 128-bit encrypted integers. |
