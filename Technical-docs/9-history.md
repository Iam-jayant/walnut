# History & Credit Reputation — Technical Documentation

## Overview

The History & Credit Reputation functionality handles transaction activity logging and computes encrypted on-chain credit scores for borrowers. Traditional lending protocols rely on public transaction logs (emitting exact dollar values for every deposit, borrow, and repayment). While public logs provide transparent history, they expose users to financial profiling, surveillance, and wallet tracking.

Walnut Protocol provides **Privacy-Preserving Activity Logging** paired with an **Encrypted Credit Scoring Engine** (`_repaymentCount`). As borrowers successfully build a track record of repaying loans, their encrypted repayment counter increments on-chain, unlocking higher credit tiers and higher Loan-to-Value (LTV) limits without publishing their financial history to the public.

---

## How It Works Under the Hood

### 1. Privacy-Preserving Activity Logging
The history page (`app/app/history/page.tsx`) displays historic borrowing events by combining on-chain contract queries (`getLoans()`, `getActiveLoans()`) with privacy-hardened event logs:

```solidity
// Contract View Function returns LoanInfo with ciphertext handles
function getLoans() external view returns (LoanInfo[] memory) {
    Loan[] storage userLoans = _loans[msg.sender];
    LoanInfo[] memory result = new LoanInfo[](userLoans.length);
    for (uint256 i = 0; i < userLoans.length; i++) {
        result[i] = LoanInfo({
            loanId: userLoans[i].loanId,
            principalHandle: uint256(euint128.unwrap(userLoans[i].encryptedPrincipal)),
            openedAt: userLoans[i].openedAt,
            active: userLoans[i].active,
            principalPending: userLoans[i].principalPending
        });
    }
    return result;
}
```

- **Zero Plaintext Leakage:** Events such as `LoanOpened`, `LoanPrincipalSynced`, and `LoanRepaid` emit timestamps, loan IDs, and `principalHandle` (the 256-bit `ctHash`), but **never emit plaintext numbers**.
- **Client-Side Event Sourcing:** The frontend `use-walnut-protocol.ts` hook listens to contract events, passes the `principalHandle` to `cofheClient.decryptForView()`, and decrypts the loan principal locally using the user's Access Key permit.

### 2. Encrypted Credit Reputation Engine (`_repaymentCount`)
Every time a user repays a loan, `WalnutLendingV2.sol` increments their private repayment count homomorphically:

```solidity
// Inside repay() function:
euint128 currentRepayCount = _safeEncrypted(_repaymentCount[msg.sender]);
euint128 one = FHE.asEuint128(1);
euint128 newRepayCount = FHE.add(currentRepayCount, one);
FHE.allow(newRepayCount, msg.sender);
_repaymentCount[msg.sender] = newRepayCount;
```

### 3. Credit Tier Derivation (`requestCreditTierUpdate` + `syncCreditCount`)
When a borrower requests a credit tier upgrade:

1. User calls `requestCreditTierUpdate(address user)`.
2. The contract requests an async CoFHE threshold decryption of `_repaymentCount[user]`.
3. CoFHE callback `syncCreditCount(ciphertext, result, signature)` converts the decrypted repayment count into an updated credit tier:

```solidity
function syncCreditCount(bytes32 ciphertext, uint128 result, bytes calldata signature) external {
    uint256 requestId = uint256(ciphertext);
    address user = decryptRequests[requestId];
    require(user != address(0), "Unknown credit sync");
    delete decryptRequests[requestId];

    ITaskManager(TASK_MANAGER_ADDRESS).verifyDecryptResult(uint256(ciphertext), uint256(result), signature);

    uint256 repayCount = uint256(result);
    uint8 tier;
    if (repayCount >= 10)     tier = 3; // Tier 3: 85% LTV (Premium)
    else if (repayCount >= 5) tier = 2; // Tier 2: 80% LTV
    else if (repayCount >= 2) tier = 1; // Tier 1: 75% LTV
    else                      tier = 0; // Tier 0: 70% LTV (Base)

    _creditTier[user] = tier;
    emit CreditTierUpdated(user, tier);
}
```

---

## Credit Tier Structure & LTV Table

| Credit Tier | Repayment Requirement | Loan-to-Value (LTV) Limit | Borrowing Power Multiplier |
|-------------|-----------------------|---------------------------|----------------------------|
| **Tier 0**  | 0 – 1 Repaid Loans    | **70% LTV**               | Base Tier                  |
| **Tier 1**  | 2 – 4 Repaid Loans    | **75% LTV**               | +5% Capital Efficiency     |
| **Tier 2**  | 5 – 9 Repaid Loans    | **80% LTV**               | +10% Capital Efficiency    |
| **Tier 3**  | 10+ Repaid Loans      | **85% LTV**               | Maximum Leverage Tier      |

---

## Technical Highlights & Under-the-Hood Points

- **Verifiable Reputation Without Exposure:** Users accumulate verifiable credit history on Arbitrum Sepolia while keeping their transaction amounts, wallet balances, and identity completely private.
- **Dynamic LTV Boosting:** Higher credit tiers allow borrowers to draw larger loans against the same collateral base, incentivizing timely repayments and protocol loyalty.
- **Event Handle Sourcing:** `LoanPrincipalSynced` provides an auditable, encrypted event trail that frontend clients use to reconstruct personal borrowing timelines.

---

## Smart Contract Contribution

| Function / Primitive | Smart Contract | Technical Role |
|----------------------|----------------|----------------|
| `getLoans()`, `getActiveLoans()` | `WalnutLendingV2.sol` | Returns array of `LoanInfo` structs containing `principalHandle` ciphertexts. |
| `_repaymentCount` mapping | `WalnutLendingV2.sol` | Stores encrypted repayment history counts as `euint128`. |
| `requestCreditTierUpdate()` | `WalnutLendingV2.sol` | Triggers CoFHE decrypt callback to evaluate credit score. |
| `syncCreditCount()` | `WalnutLendingV2.sol` | Updates `_creditTier` mapping and emits `CreditTierUpdated`. |
