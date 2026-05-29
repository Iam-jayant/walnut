# Walnut Protocol Architecture

This document provides a comprehensive overview of Walnut Protocol's architecture, data flows, and system interactions.

## System Overview

Walnut is a confidential lending protocol that uses Fully Homomorphic Encryption (FHE) to keep user positions private while maintaining protocol functionality. The system consists of smart contracts on Arbitrum Sepolia, a Next.js frontend, and integration with CoFHE for encrypted computation.

## High-Level Architecture

```mermaid
flowchart TB
    subgraph Frontend["Frontend Layer"]
        UI[Next.js Application]
        SDK[CoFHE SDK]
        Wagmi[wagmi + viem]
    end

    subgraph Blockchain["Arbitrum Sepolia"]
        WL[WalnutLending Contract]
        FHERC[WalnutFHERC20 cUSDC]
        Oracle[WalnutPriceOracle]
        MockUSDC[MockUSDC Token]
        PriceFeed[Chainlink Price Feed]
        TM[TaskManager Contract]
    end

    subgraph CoFHE["CoFHE Network"]
        Decrypt[Decryption Enclave Nodes]
    end

    subgraph External["External Services"]
        Privara[Privara Settlement]
    end

    UI --> SDK
    UI --> Wagmi
    SDK -->|Request decryption| Decrypt
    Decrypt -->|Return signature & result| SDK
    Wagmi -->|Transactions & syncXxx| WL
    Wagmi -->|ERC20 ops| MockUSDC

    WL -->|Mint/Burn| FHERC
    WL -->|Price queries| Oracle
    WL -->|Transfer| MockUSDC
    WL -->|verifyDecryptResultSafe| TM
    Oracle -->|Read price| PriceFeed

    UI -->|Settlement request| Privara
```

## FHE Data Flow

This diagram shows how encrypted data flows through the system:

```mermaid
flowchart LR
    User[User Input<br/>Plain Amount] --> Browser[Browser<br/>CoFHE SDK]
    Browser -->|Encrypt| Cipher[InEuint128<br/>Ciphertext]
    Cipher -->|Transaction| Contract[WalnutLending<br/>Contract]
    Contract -->|FHE Operations| Compute[Encrypted<br/>Computation]
    Compute -->|Store| Storage[euint128<br/>On-Chain Storage]
    Storage -->|FHE.allowPublic| Permit[Public Decrypt<br/>Permission]
    Permit -->|Decryption Signature| SDK[CoFHE SDK]
    SDK -->|syncXxx transaction| Contract
    Contract -->|verifyDecryptResultSafe| Display[Plaintext State<br/>Activated]
```

### Encryption Flow

1. **Client-Side Encryption**: User enters amount in browser
2. **CoFHE SDK**: Encrypts value using CoFHE public key → `InEuint128`
3. **Transaction**: Encrypted value sent in transaction calldata
4. **Contract Receipt**: Contract receives `InEuint128` and converts to `euint128`
5. **FHE Operations**: Contract performs encrypted arithmetic (add, sub, mul, div, compare)
6. **Storage**: Encrypted result stored as `euint128` handle
7. **Permission Grant**: Contract calls `FHE.allow(value, user)` to grant read access
8. **Permit Creation**: User signs permit to authorize decryption
9. **Decryption**: Frontend requests decryption via CoFHE SDK
10. **Display**: Decrypted value shown to user

## Contract Interaction Diagram

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant CoFHE SDK
    participant WalnutLending
    participant MockUSDC
    participant WalnutFHERC20
    participant Oracle
    participant TaskManager
    participant CoFHE Network

    Note over User,CoFHE Network: Deposit Flow
    User->>Frontend: Enter deposit amount
    Frontend->>MockUSDC: approve(WalnutLending, amount)
    Frontend->>WalnutLending: deposit(token, amount)
    WalnutLending->>MockUSDC: transferFrom(user, contract, amount)
    WalnutLending->>Oracle: getUSDValue(token, amount)
    Oracle-->>WalnutLending: usdValue
    WalnutLending->>WalnutLending: FHE.asEuint128(usdValue)
    WalnutLending->>WalnutLending: _collateral[user] += encryptedValue
    WalnutLending->>WalnutLending: FHE.allow(_collateral[user], user)
    WalnutLending-->>Frontend: Deposited event

    Note over User,CoFHE Network: Borrow Flow (Client-Driven Sync)
    User->>Frontend: Enter borrow amount
    Frontend->>CoFHE SDK: encrypt(amount)
    CoFHE SDK-->>Frontend: InEuint128
    Frontend->>WalnutLending: borrow(encryptedAmount)
    WalnutLending->>WalnutLending: Check LTV with FHE operations
    WalnutLending->>WalnutLending: FHE.select(withinLimit, amount, 0)
    WalnutLending->>WalnutFHERC20: mintInternal(user, mintAmount)
    WalnutLending->>WalnutLending: Create new Loan (pending state)
    WalnutLending->>WalnutLending: FHE.allowPublic(mintAmount)
    WalnutLending-->>Frontend: Emit BorrowPrincipalSyncRequested(requestId)
    
    Frontend->>CoFHE SDK: requestDecryption(requestId)
    CoFHE SDK->>CoFHE Network: Decrypt allowed ciphertext
    CoFHE Network-->>CoFHE SDK: Return decryptedValue & Signature
    Frontend->>WalnutLending: syncLoanPrincipal(requestId, decryptedValue, signature)
    WalnutLending->>TaskManager: verifyDecryptResultSafe(requestId, decryptedValue, signature)
    TaskManager-->>WalnutLending: true (signature verified)
    WalnutLending->>WalnutLending: Update loan.principal and set loan.active = true
    WalnutLending-->>Frontend: Emit LoanOpened event

    Note over User,CoFHE Network: Repay Flow (Client-Driven Sync)
    User->>Frontend: Enter repay amount + select loan
    Frontend->>CoFHE SDK: encrypt(amount)
    CoFHE SDK-->>Frontend: InEuint128
    Frontend->>WalnutLending: repay(encryptedAmount, loanIndex)
    WalnutLending->>WalnutLending: Get loan from userLoans[user][loanIndex]
    WalnutLending->>WalnutLending: calculateInterest(user, loan.principal)
    WalnutLending->>WalnutLending: Check if amount >= principal + interest
    WalnutLending->>WalnutFHERC20: burnInternal(user, burnAmount)
    WalnutLending->>WalnutLending: FHE.allowPublic(repaySignal)
    WalnutLending-->>Frontend: Emit RepaySyncRequested(requestId) + RepaymentSettlementIntent event
    
    Frontend->>CoFHE SDK: requestDecryption(requestId)
    CoFHE SDK->>CoFHE Network: Decrypt allowed ciphertext
    CoFHE Network-->>CoFHE SDK: Return decryptedValue (signal) & Signature
    Frontend->>WalnutLending: syncLoanRepay(requestId, signal, signature)
    WalnutLending->>TaskManager: verifyDecryptResultSafe(requestId, signal, signature)
    TaskManager-->>WalnutLending: true (signature verified)
    WalnutLending->>WalnutLending: Set loan.active = false if signal == 1
```

## Privara Settlement Flow

Walnut uses Privara for private interest settlement. This is a two-transaction process:

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant WalnutLending
    participant Privara API
    participant Settlement Wallet

    Note over User,Settlement Wallet: Repayment with Interest Settlement

    User->>Frontend: Initiate repay
    Frontend->>WalnutLending: repay(encryptedAmount)
    WalnutLending-->>Frontend: RepaymentSettlementIntent event
    Note right of WalnutLending: Event contains:<br/>- principal<br/>- interest<br/>- protocolFee

    Frontend->>Privara API: POST /settle
    Note right of Frontend: Request body:<br/>- user address<br/>- interest amount<br/>- protocol fee<br/>- lender address

    Privara API->>Settlement Wallet: Sign settlement tx
    Settlement Wallet->>WalnutLending: Transfer interest to lender
    Settlement Wallet->>WalnutLending: Transfer protocol fee to treasury
    Privara API-->>Frontend: Settlement tx hash

    Frontend-->>User: Show both tx hashes:<br/>1. Repay transaction<br/>2. Settlement transaction
```

### Why Two Transactions?

1. **Repay Transaction**: Burns cUSDC and updates encrypted debt
2. **Settlement Transaction**: Transfers interest (encrypted amount) to lender and protocol

The settlement transaction is handled by Privara to keep the interest amount private. The user sees both transaction hashes but the actual interest amount remains encrypted.

## Client-Driven Decryption Sync Flow

Walnut Protocol uses the secure, modern **Client-Driven Decryption Sync** pattern to verify FHE decryption results on-chain. Rather than relying on fragile, push-based callback handlers, the client coordinates the decryption process off-chain and submits the cryptographically signed enclave results back to the smart contract:

```mermaid
sequenceDiagram
    participant User
    participant Client as Frontend (wagmi/viem)
    participant SDK as CoFHE SDK
    participant WL as WalnutLending Contract
    participant TM as TaskManager Contract
    participant FHE as FHE Enclave Nodes

    User->>Client: Triggers FHE operation (e.g., Borrow)
    Client->>WL: Call borrow(encryptedAmount)
    WL->>WL: Compute encrypted LTV bounds
    WL->>WL: FHE.allowPublic(mintAmount)
    WL-->>Client: Emit BorrowPrincipalSyncRequested(requestId)
    
    Client->>SDK: Initiate decryption for requestId
    SDK->>FHE: Request decryption (with view permit)
    FHE->>FHE: Decrypt allowed ciphertext
    FHE-->>SDK: Return decrypted result + ECDSA Enclave Signature
    SDK-->>Client: Return decrypted result & signature
    
    Client->>WL: Call syncLoanPrincipal(requestId, result, signature)
    WL->>TM: Call verifyDecryptResultSafe(requestId, result, signature)
    TM->>TM: Verify enclave ECDSA signature
    TM-->>WL: Signature valid
    WL->>WL: Update loan state (principal & set active = true)
    WL-->>Client: Emit LoanOpened event
```

### Decentralized Timeout Recovery

To prevent positions from getting permanently locked in a pending sync state if a user closes their browser or a relayer fails, Walnut implements a fully decentralized **Timeout Recovery Flow**.

After a **1-hour expiration window**, anyone (e.g., a keeper or the user) can call `cancelPendingBorrow(loanIndex)` or `cancelPendingRepay(loanIndex)` to safely cancel the pending operation and revert the state back to normal.

### Client-Driven Sync Functions

Walnut implements secure, client-driven sync handlers:

1. **`syncLoanPrincipal(uint256 requestId, uint128 result, bytes calldata signature)`**
   - Synchronizes loan principal after a successful borrow.
   - Verifies signature, updates `userLoans[user][loanIndex].principal`, and sets `active = true`.

2. **`syncLoanRepay(uint256 requestId, uint128 result, bytes calldata signature)`**
   - Verifies the repayment signal. If result == 1 (fully repaid), sets `userLoans[user][loanIndex].active = false` and clears principal.

3. **`syncCreditCount(uint256 requestId, uint128 result, bytes calldata signature)`**
   - Updates the user's public credit tier on-chain based on their private decrypted repayment history.

4. **`syncTotalBorrowed(uint256 requestId, uint128 result, bytes calldata signature)`**
   - Updates the public `totalBorrowed` cache with versioning checks to prevent stale updates.

5. **`syncPositionGuardCheck(uint256 requestId, uint128 result, bytes calldata signature)`**
   - Checks position health. If result == 1, marks the user position as liquidatable.

## State Management

### Encrypted State

Stored as `euint128` handles (32-byte values):

```solidity
mapping(address => euint128) private _collateral;
mapping(address => euint128) private _debt;
mapping(address => euint128) private _repaymentCount;
mapping(address => euint128) private _defaultCount;
euint128 private _totalBorrowedEncrypted;
```

### Public State

Stored as regular Solidity types:

```solidity
struct Loan {
    uint128 principal;
    uint256 openedAt;
    bool active;
}

mapping(address => Loan[]) private userLoans;
mapping(address => uint8) public creditTier;
uint256 public totalDeposited;
uint256 public totalBorrowed; // Cache of _totalBorrowedEncrypted
```

**Multi-Loan Model**:
- Each user can have multiple concurrent loans
- Each loan tracks its own `principal`, `openedAt` timestamp, and `active` status
- Interest calculated independently per loan
- Repayment targets specific loan by index

### Pending Request Tracking

Used to map callback requestIds to users and loan indices:

```solidity
mapping(uint256 => address) public pendingPrincipalSyncs;
mapping(uint256 => address) public pendingRepaySyncs;
mapping(uint256 => address) public decryptRequests;
mapping(uint256 => address) private _pendingGuardChecks;
mapping(uint256 => uint256) public pendingTotalBorrowedSyncVersions;
```

**Multi-Loan Context:**
- Principal and repay syncs track both user address and loan index
- Multiple loans can have pending syncs simultaneously
- Each sync is independent and doesn't affect other loans

## Permission Model

### FHE Permissions

Walnut uses three permission levels:

1. **`FHE.allowThis(value)`**
   - Grants contract permission to use value in future operations
   - Called after every encrypted operation
   - Required for contract to read its own encrypted state

2. **`FHE.allow(value, user)`**
   - Grants specific address permission to decrypt value
   - Called after writes to grant user read access
   - User must create permit to actually decrypt

3. **`FHE.allowGlobal(value)`**
   - Makes value globally decryptable
   - **Only used for decrypt requests** (not for user data)
   - Required for CoFHE to decrypt and callback

### Access Control

```solidity
modifier onlyOwner()      // Owner-only functions
modifier whenNotPaused()  // Pausable functions
modifier onlyCoFHE()      // CoFHE callback functions
```

**Owner Functions:**
- `pause()` / `unpause()`
- `transferOwnership()`
- `grantAuditorPermit()` / `revokeAuditorPermit()`

**CoFHE-Only Functions:**
- `onLoanPrincipalDecrypted()`
- `onLoanRepayDecrypted()`
- `onTotalBorrowedDecrypted()`
- `onGuardCheckDecrypted()`
- `onCreditCountDecrypted()`

## Interest Calculation

Interest accrues linearly from `borrowTimestamp`:

```solidity
function calculateInterest(address user, uint256 principal)
    public view returns (uint256 totalInterest, uint256 protocolFee, uint256 lenderPayment)
{
    uint256 elapsed = block.timestamp - borrowTimestamp[user];
    totalInterest = (principal * BORROW_APR * elapsed * PRECISION)
        / (SECONDS_PER_YEAR * 10000 * PRECISION);
    protocolFee = totalInterest / 4;  // 25%
    lenderPayment = totalInterest - protocolFee;  // 75%
}
```

**Constants:**
- `BORROW_APR = 800` (8% annual rate, in basis points)
- `PROTOCOL_FEE_APR = 200` (2% annual rate, 25% of total interest)
- `SECONDS_PER_YEAR = 365 days`
- `PRECISION = 1e6` (6 decimals for USD values)

## Credit Tier System

Users progress through tiers based on repayment count:

| Tier | Repayments Required | Max LTV |
|------|---------------------|---------|
| 0    | 0                   | 70%     |
| 1    | 3                   | 75%     |
| 2    | 10                  | 80%     |
| 3    | 25                  | 85%     |
| 4    | 50                  | 90%     |

**Implementation:**
- Tier update requires decrypt request + client-driven sync
- LTV enforced in `borrow()` using encrypted comparison

## Utilization and Dynamic Rates

```solidity
function utilizationRate() external view returns (uint256) {
    if (totalDeposited == 0) return 0;
    return (totalBorrowed * 10000) / totalDeposited;
}

function currentBorrowRate() external view returns (uint256) {
    if (totalDeposited == 0) return 600;  // 6% base rate
    return 600 + ((totalBorrowed * 600) / totalDeposited);
}
```

**Rate Model:**
- Base rate: 6% (600 bps)
- Slope: 6% (600 bps)
- At 0% utilization: 6% APR
- At 100% utilization: 12% APR
- Linear interpolation between

## Frontend Architecture

### Tech Stack

- **Framework**: Next.js 16.2.1 (App Router)
- **Web3**: wagmi 2.19.5 + viem 2.47.6
- **State**: TanStack Query 5.95.2
- **Encryption**: CoFHE SDK 0.5.0
- **Styling**: Tailwind CSS 4.1.9
- **UI Components**: Custom components with Radix UI primitives

### Key Hooks

1. **`use-walnut-protocol.ts`**
   - Main protocol interaction hook
   - Wraps contract calls with error handling
   - Manages transaction states

2. **`use-permit.ts`**
   - Manages FHE permit creation and storage
   - Handles permit lifecycle
   - Provides permit status

3. **`use-token-balances.ts`**
   - Fetches and decrypts token balances
   - Handles encrypted balance decryption
   - Caches results

### Component Structure

```
components/
├── dashboard/          # Dashboard-specific components
│   ├── empty-state.tsx
│   ├── loan-health.tsx
│   ├── activity-feed.tsx
│   └── protocol-status.tsx
├── landing/           # Landing page components
├── ui/                # Reusable UI components
│   ├── skeleton.tsx
│   └── error-boundary.tsx
└── walnut/            # Protocol-specific components
    ├── permit-provider.tsx
    └── permit-explainer-modal.tsx
```

## Security Considerations

### Protocol-Owned Accounting

Users cannot manipulate debt accounting:
- `userLoans` array is private and contract-controlled
- `repay(loanIndex)` reads loan data internally, not from calldata
- Interest calculated using `loan.openedAt` timestamp
- Each loan maintains independent accounting

### Multi-Loan Support

Supports multiple concurrent loans per user:
- `borrow()` creates new loan, no restriction on existing loans
- Each loan has independent `principal`, `openedAt`, and `active` status
- `repay(loanIndex)` targets specific loan
- View functions: `getLoans()`, `getActiveLoans()`, `hasActiveLoan()`, `getTotalActivePrincipal()`

### Encrypted Aggregates

Public metrics without revealing individual positions:
- `_totalBorrowedEncrypted` is canonical
- `totalBorrowed` is public cache (updated via sync)
- Individual positions remain encrypted

### Sync Validation Security

Decryption results are verified cryptographically on-chain:
- Uses `FHE.verifyDecryptResultSafe(requestId, result, signature)`
- Only cryptographically signed ECDSA signatures from FHE enclave nodes are accepted
- Prevents malicious actors from submitting fake sync values
- Request mappings are cleaned up after a successful synchronization

## Deployment Architecture

### Arbitrum Sepolia Testnet

- **Chain ID**: 421614
- **RPC**: https://sepolia-rollup.arbitrum.io/rpc
- **Explorer**: https://sepolia.arbiscan.io

### Contract Deployment Order

1. MockUSDC (ERC20 token)
2. MockUSDCPriceFeed (Chainlink-compatible)
3. WalnutPriceOracle
4. WalnutFHERC20 (cUSDC)
5. WalnutLending
6. Configuration:
   - `WalnutFHERC20.setMinter(WalnutLending)`
   - `WalnutPriceOracle.setPriceFeed(MockUSDC, MockUSDCPriceFeed)`

### Frontend Deployment

- **Platform**: Vercel
- **Build**: `npm run build`
- **Environment**: `.env.local` for local, Vercel dashboard for production
- **CDN**: Vercel Edge Network

## Performance Considerations

### Gas Optimization

- Encrypted operations are expensive (FHE overhead)
- Batch operations where possible
- Use public cache (`totalBorrowed`) for views
- Minimize decrypt requests

### Frontend Optimization

- Lazy load components
- Cache decrypted values
- Debounce user inputs
- Use React Query for data fetching

### Callback Latency

- Decrypt requests are async (1-5 seconds typical)
- Show loading states during callbacks
- Don't block user on non-critical decrypts
- Use optimistic UI updates where safe

## Future Enhancements

### Planned Features

1. **Sealed-Bid Liquidations**
   - Liquidators submit encrypted bids
   - Contract compares bids without revealing amounts
   - Winner selected via FHE comparison

2. **Credit Score Progression**
   - Automated tier updates
   - On-chain credit history
   - Reputation system

3. **Multi-Collateral Support**
   - Support for multiple ERC20 tokens
   - Weighted collateral baskets
   - Dynamic collateral factors

4. **Governance**
   - Multi-sig ownership
   - Timelock for parameter changes
   - Community voting on protocol upgrades

### Scalability Improvements

- Batch decrypt requests
- Optimize FHE operations
- Layer 2 scaling solutions
- Cross-chain bridges

---

For more information, see:
- [FHE Explainer](fhe-explainer.md)
- [Security Documentation](security.md)
- [User Guide](user-guide.md) *(coming soon)*
- [Contract Documentation](contracts.md) *(coming soon)*
