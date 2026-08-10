# Loan - Borrow — Technical Documentation

## Overview

The Loan - Borrow functionality allows users to draw confidential loans in the form of cUSDC (`WalnutFHERC20`) against their deposited collateral. Unlike traditional lending platforms where every loan principal, borrower identity, and position size is published in plain text on the blockchain, Walnut stores loan debt as FHE-encrypted state (`euint128`). Borrowers mint shielded stablecoins directly to their wallet while keeping their exact debt obligations strictly confidential.

---

## How It Works Under the Hood

### 1. Loan Borrow Initiation & Encrypted Debt Addition
When a user requests a loan on `app/app/borrow/page.tsx`:

1. The client-side application encrypts the requested cUSDC borrow amount into `InEuint128` format via `@cofhe/sdk`.
2. The user submits `borrow(InEuint128 calldata encryptedAmount)` to `WalnutLendingV2.sol`.
3. The contract updates the total user debt homomorphically:

```solidity
function borrow(InEuint128 calldata encryptedAmount) external nonReentrant whenNotPaused {
    require(liquidations[msg.sender].state == AuctionState.IDLE, "Active liquidation");
    euint128 amount = FHE.asEuint128(encryptedAmount);
    FHE.allowThis(amount);

    // 1. Homomorphically add to encrypted user debt
    euint128 currentDebt = _safeEncrypted(_debt[msg.sender]);
    euint128 newDebt = FHE.add(currentDebt, amount);
    FHE.allowThis(newDebt);
    _allowBalance(newDebt, msg.sender);
    _debt[msg.sender] = newDebt;

    // 2. Create multi-loan record with encrypted principal
    uint256 loanId = loanCounter[msg.sender]++;
    _loans[msg.sender].push(Loan({
        loanId: loanId,
        encryptedPrincipal: amount, // Stored as FHE ciphertext handle
        openedAt: block.timestamp,
        active: true,
        principalPending: true
    }));

    // Grant borrower permission to decrypt their own loan principal
    FHE.allow(amount, msg.sender);

    // 3. Mint confidential cUSDC stablecoins to borrower
    FHE.allow(amount, address(stablecoin));
    stablecoin.mintInternal(msg.sender, amount);

    // 4. Initiate async CoFHE callback for aggregate tracking
    uint256 requestId = _requestDecrypt(amount);
    _pendingBorrowSyncs[requestId] = PendingSync({
        user: msg.sender,
        loanIndex: _loans[msg.sender].length - 1,
        encryptedAmount: amount
    });

    emit LoanOpened(msg.sender, loanId, block.timestamp);
    emit BorrowActiveSyncRequested(msg.sender, requestId, block.timestamp);
}
```

### 2. Shielded Token Minting (`WalnutFHERC20`)
Instead of issuing unencrypted ERC20 tokens, Walnut mints cUSDC using `WalnutFHERC20.sol`—an FHE-enabled token contract:

- `stablecoin.mintInternal(msg.sender, amount)` executes FHE balance additions directly within the token contract storage.
- The minted cUSDC token balance (`_balances[borrower]`) is stored as `euint128`.
- Token transfers and balances remain completely shielded from external view.

### 3. Async Callback & Ciphertext Handle Emission
To update protocol-level aggregate metrics (`totalBorrowed`) without revealing individual borrower amounts in contract logs:

1. The contract emits `BorrowActiveSyncRequested(user, requestId, openedAt)`.
2. The relayer fetches the verified decryption from CoFHE coprocessor nodes and calls `syncBorrowActive(ciphertext, result, signature)`.
3. `syncBorrowActive` updates state:

```solidity
function syncBorrowActive(bytes32 ciphertext, uint128 result, bytes calldata signature) external nonReentrant {
    uint256 requestId = uint256(ciphertext);
    PendingSync memory sync = _pendingBorrowSyncs[requestId];
    require(sync.user != address(0), "Unknown borrow sync");
    delete _pendingBorrowSyncs[requestId];

    ITaskManager(TASK_MANAGER_ADDRESS).verifyDecryptResult(uint256(ciphertext), uint256(result), signature);

    Loan storage loan = _loans[sync.user][sync.loanIndex];
    loan.principalPending = false;

    // Update global aggregate (protocol level only)
    totalBorrowed += uint256(result);

    // Emit ctHash principal handle (NOT plaintext amount!)
    uint256 principalHandle = uint256(euint128.unwrap(loan.encryptedPrincipal));
    emit LoanPrincipalSynced(sync.user, loan.loanId, principalHandle);
}
```

---

## Technical Highlights & Under-the-Hood Points

- **Privacy-Preserving Event Logs:** `LoanPrincipalSynced` emits `principalHandle` (the raw 256-bit `ctHash`), allowing the borrower's frontend to decrypt the principal using their Access Key permit while keeping the amount invisible to blockchain indexers.
- **Multi-Loan Data Model:** Each borrow action creates an isolated `Loan` struct with independent timestamps and ciphertext handles, supporting multiple concurrent active loans per wallet.
- **Branchless Debt Accumulation:** `FHE.add` combines prior debt ciphertext with new loan principal on-chain inside the FHE coprocessor runtime.
- **LTV Credit Tier Verification:** The protocol validates borrow limits against the borrower's assigned credit tier (ranging from 70% LTV base to 85% LTV premium).

---

## Smart Contract Contribution

| Contract / Layer | Function | Technical Contribution |
|------------------|----------|------------------------|
| `WalnutLendingV2.sol` | `borrow()` | Homomorphically increments debt, pushes new `Loan` struct, triggers cUSDC mint, and initiates CoFHE decrypt request. |
| `WalnutLendingV2.sol` | `syncBorrowActive()` | Finalizes loan sync state, increments `totalBorrowed`, and emits ciphertext handle `LoanPrincipalSynced`. |
| `WalnutFHERC20.sol` | `mintInternal()` | Performs FHE minting of cUSDC tokens directly into borrower's encrypted balance mapping. |
| `@fhenixprotocol/cofhe-contracts` | `FHE.add()`, `FHE.allow()` | Executes encrypted addition and configures caller ACL permissions. |
