# Loan - Withdraw / Repay — Technical Documentation

## Overview

The Loan - Withdraw (Repay) functionality governs how borrowers clear outstanding loan debt to release locked collateral. To repay a loan, borrowers burn confidential cUSDC stablecoins. `WalnutLendingV2.sol` updates encrypted debt balances via branchless FHE subtraction, increments the user's encrypted repayment history count to build on-chain credit reputation, and triggers off-chain interest settlement via Privara escrow before unlocking collateral for withdrawal.

---

## How It Works Under the Hood

### 1. Loan Repayment & Shielded Burning
When a borrower repays an active loan on `app/app/repay/page.tsx`:

1. The frontend calculates accrued interest using protocol constants (`BORROW_APR = 800` BPS / 8.00% annual) based on elapsed time since `loan.openedAt`.
2. The repayment amount is encrypted into `InEuint128`.
3. The user calls `repay(InEuint128 calldata encryptedAmount, uint256 loanIndex)` on `WalnutLendingV2.sol`.

```solidity
function repay(InEuint128 calldata encryptedAmount, uint256 loanIndex) external nonReentrant whenNotPaused {
    require(liquidations[msg.sender].state == AuctionState.IDLE, "Active liquidation");
    require(loanIndex < _loans[msg.sender].length, "Invalid loan index");
    Loan storage loan = _loans[msg.sender][loanIndex];
    require(loan.active, "Loan not active");
    require(!loan.principalPending, "Loan principal still syncing");

    euint128 amount = FHE.asEuint128(encryptedAmount);
    FHE.allowThis(amount);

    // 1. Burn confidential cUSDC tokens from borrower
    FHE.allow(amount, address(stablecoin));
    ebool burnSuccess = stablecoin.burnInternal(msg.sender, amount);
    FHE.allowThis(burnSuccess);

    // 2. Branchless conditional debt reduction
    euint128 currentDebt = _safeEncrypted(_debt[msg.sender]);
    euint128 zero = FHE.asEuint128(0);
    euint128 debtReduction = FHE.select(burnSuccess, amount, zero);
    euint128 newDebt = FHE.sub(currentDebt, debtReduction);
    _allowBalance(newDebt, msg.sender);
    _debt[msg.sender] = newDebt;

    // 3. Close loan record & increment encrypted repayment counter
    loan.active = false;

    euint128 currentRepayCount = _safeEncrypted(_repaymentCount[msg.sender]);
    euint128 one = FHE.asEuint128(1);
    euint128 newRepayCount = FHE.add(currentRepayCount, one);
    FHE.allow(newRepayCount, msg.sender);
    _repaymentCount[msg.sender] = newRepayCount;

    // 4. Trigger CoFHE callback for settlement
    uint256 requestId = _requestDecrypt(amount);
    _pendingRepaySyncs[requestId] = PendingSync({
        user: msg.sender,
        loanIndex: loanIndex,
        encryptedAmount: amount
    });

    emit RepayStateSyncRequested(msg.sender, requestId, loan.loanId);
}
```

### 2. Branchless Conditional Execution (`FHE.select`)
Smart contracts executing on encrypted FHE data cannot use standard `if/else` control flow branches because branching on private conditionals would leak information through execution paths and gas usage. 

To solve this, `WalnutLendingV2.sol` uses `FHE.select()`:
- If `burnSuccess` is true (`ebool 1`), `debtReduction` evaluates to `amount`.
- If `burnSuccess` is false (`ebool 0`), `debtReduction` evaluates to `0`.
- The debt subtraction `FHE.sub(currentDebt, debtReduction)` is performed uniformly without revealing whether the burn succeeded or failed to external observers.

### 3. CoFHE Callback & Off-Chain Interest Settlement
After the repay transaction completes on-chain:

1. `syncLoanRepay` is triggered via CoFHE relayer to decrement `totalBorrowed -= result` and emit privacy-safe event `LoanRepaid(user, loanId)`.
2. The frontend hook `use-privara.ts` initiates an automated HTTP POST request to `/api/privara/settle`.
3. `/api/privara/settle` uses `ReineiraSDK` to settle the accrued interest into Privara escrow:
   - Accrued interest is routed to `LENDER_POOL_ADDRESS`.
   - Protocol fee (2.00% APR) is directed to protocol treasury.
4. With debt cleared and interest settled, the borrower's locked collateral is freed and can be withdrawn immediately.

---

## Technical Highlights & Under-the-Hood Points

- **Credit Reputation Boost:** Every successful loan repayment increments `_repaymentCount[msg.sender]` in FHE. Accumulating repayments unlocks higher credit tiers (Tier 0 to Tier 3), raising the user's borrowing capacity up to 85% LTV.
- **Shielded Token Burning:** `WalnutFHERC20.burnInternal` reduces cUSDC token supply on-chain while keeping total token balances encrypted.
- **Dual State Machine Sync:** The repay workflow uses a 7-state finite state machine (FSM): `idle → repay_pending → repay_confirmed → settlement_pending → settlement_confirmed / failed`.
- **Collateral Release:** Clearing loan debt reduces `_debt[msg.sender]` to zero, elevating position health factor to maximum (`SAFE`) and unblocking collateral withdrawal.

---

## Smart Contract Contribution

| Contract / Layer | Function | Technical Contribution |
|------------------|----------|------------------------|
| `WalnutLendingV2.sol` | `repay()` | Burns cUSDC, executes branchless `FHE.select` debt reduction, marks loan inactive, and increments encrypted repayment counter. |
| `WalnutLendingV2.sol` | `syncLoanRepay()` | Finalizes repay state, updates global `totalBorrowed`, and emits settlement intent events. |
| `WalnutFHERC20.sol` | `burnInternal()` | Performs FHE burn of cUSDC tokens directly from borrower's encrypted balance mapping. |
| `@reineira-os/sdk` / Privara API | `/api/privara/settle` | Escrows accrued interest and distributes protocol fee yields to lender pool. |
