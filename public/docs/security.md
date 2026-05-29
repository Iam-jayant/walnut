# Security Documentation

## Threat Model

Walnut Protocol is designed to protect user privacy while maintaining protocol integrity. Our threat model considers:

**Protected Against:**
- Public visibility of individual user positions (collateral, debt, health factor)
- Front-running of liquidation bids (via sealed-bid auctions in future versions)
- Manipulation of debt accounting through user-supplied calldata
- Unauthorized access to encrypted user data
- Oracle price manipulation within staleness bounds

**Not Protected Against:**
- Malicious CoFHE network operators (we trust the decryption network)
- Smart contract bugs (testnet deployment, not audited)
- Compromised private keys (standard Web3 risk)
- Extreme oracle price staleness (>1 hour)
- Arbitrum Sepolia testnet instability

**Honest Limitations:**
- **Testnet Only**: Deployed on Arbitrum Sepolia for demonstration purposes
- **No Security Audit**: Contracts have not undergone professional security review
- **MockUSDC**: Uses mock tokens for deterministic testing, not production-grade stablecoins
- **Limited Battle Testing**: New protocol without extensive real-world usage
- **CoFHE Trust Assumption**: Relies on CoFHE network for decryption integrity

## FHE Access Control Boundaries

Walnut uses CoFHE's three-tier permission system to control who can decrypt encrypted data:

### `allowThis(address contract)`
Grants the contract itself permission to decrypt a value. Used when the contract needs to perform internal logic on decrypted data.

**Example**: When calculating interest, the contract needs to decrypt the principal debt to compute the interest amount.

```solidity
FHE.allowThis(encryptedPrincipal);
```

### `allow(euint128 value, address user)`
Grants a specific address permission to decrypt a value. Used to give users read access to their own encrypted data.

**Example**: After depositing collateral, the user receives permission to decrypt and view their collateral balance.

```solidity
FHE.allow(encryptedCollateral, msg.sender);
```

### `allowGlobal(euint128 value)`
Makes a value globally decryptable by anyone. **Never used in Walnut** because all user data must remain private.

**Security Principle**: Walnut never calls `allowGlobal()`. All encrypted user data is protected by `allow()` grants to specific addresses only.

## Cryptographic Enclave Verification Explained

Rather than relying on fragile, push-based callback modifiers, Walnut Protocol secures decryption results on-chain via the **TaskManager** contract using ECDSA enclave signatures:

```solidity
function verifyDecryptResultSafe(
    uint256 ctHash,
    uint128 result,
    bytes calldata signature
) external view returns (bool)
```

**Purpose**: Validates that the decrypted value is authentic and has been cryptographically signed directly by decentralized CoFHE enclave nodes.

**Why It Matters**: Because anyone can submit a decryption result back to the contract via public `syncXxx` functions (e.g. `syncLoanPrincipal`, `syncLoanRepay`, `syncCreditCount`), Walnut verifies the ECDSA signature on-chain to prevent malicious actors from providing false plaintext outputs. Without signature verification, an attacker could spoof the result and falsely clear debt or boost their credit tier.

**Verification-Guarded Functions**:
- `syncLoanPrincipal(...)`: Finalizes the active status of a newly opened loan
- `syncLoanRepay(...)`: Validates repay signals and toggles loan active states
- `syncTotalBorrowed(...)`: Updates the public cache for total protocol debt
- `syncPositionGuardCheck(...)`: Processes health checks and flags liquidations
- `syncCreditCount(...)`: Progresses the user's public credit tier on-chain

**Attack Scenario Prevented**: An attacker attempts to call `syncCreditCount` with a spoofed repayment count of `100` to skip directly to credit tier 4. The contract calls `verifyDecryptResultSafe`, identifies that the ECDSA enclave signature is missing or invalid for that specific ciphertext hash, and immediately reverts the transaction.

## Oracle Staleness Attack Surface

Walnut uses Chainlink price feeds to value collateral. Oracle staleness is a known attack vector:

**Staleness Check**:
```solidity
require(block.timestamp - updatedAt <= 1 hours, "WalnutPriceOracle: stale price");
```

**Attack Scenario**: If a price feed becomes stale (not updated for >1 hour), an attacker could exploit outdated prices to borrow against overvalued collateral or trigger unfair liquidations.

**Mitigation**:
- 1-hour staleness threshold (configurable by owner)
- Transactions revert if price data is stale
- Multiple price feed sources can be added for redundancy

**Residual Risk**: If Chainlink stops updating a feed but the last update was <1 hour ago, there's a brief window where stale prices could be used. This is an inherent limitation of oracle-based systems.

**Future Improvement**: Implement TWAP (Time-Weighted Average Price) or multi-oracle aggregation for additional price reliability.

## Access Control Table

All administrative functions and their authorized callers:

| Function | Authorized Caller | Purpose | Risk Level |
|----------|------------------|---------|------------|
| `pause()` | Owner only | Emergency stop of all protocol operations | High |
| `unpause()` | Owner only | Resume protocol operations after pause | High |
| `setPositionGuard(InEuint128 threshold)` | Owner only | Set health factor threshold for position monitoring | Medium |
| `grantAuditorPermit(address auditor, uint256 expiry)` | Owner only | Grant time-limited read access to encrypted positions | High |
| `revokeAuditorPermit(address auditor)` | Owner only | Revoke auditor read access | Medium |
| `syncTotalBorrowed(euint128 ciphertext, uint128 result, bytes signature)` | Anyone (Verified via TaskManager Enclave Signature) | Update public aggregate borrow total cache | Medium (Signature verified) |
| `syncPositionGuardCheck(euint128 ciphertext, uint128 result, bytes signature)` | Anyone (Verified via TaskManager Enclave Signature) | Process position guard health check and flag liquidation | Medium (Signature verified) |
| `setPriceFeed(address token, address feed)` | Owner only (Oracle) | Add or update Chainlink price feed | High |
| `setMinter(address minter)` | Owner only (FHERC20) | Set authorized minter for cUSDC | Critical |

**Security Notes**:
- **Owner** is the deployer address (single point of control)
- **CoFHE** is the CoFHE network contract address (hardcoded, immutable)
- No timelock on owner actions (testnet deployment)
- No multi-sig (testnet deployment)

**Production Recommendations**:
- Implement multi-sig for owner role
- Add timelock for critical parameter changes
- Implement role-based access control (RBAC) for granular permissions
- Add emergency pause guardian role separate from owner

## Protocol-Owned Accounting Security

Walnut implements protocol-owned principal tracking to prevent debt manipulation:

**Security Principle**: Users cannot supply their own principal debt values via calldata.

**Implementation**:
```solidity
struct Loan {
    uint128 principal;
    uint256 openedAt;
    bool active;
}

mapping(address => Loan[]) private userLoans;

function repay(InEuint128 calldata encryptedAmount, uint256 loanIndex) external {
    Loan storage loan = userLoans[msg.sender][loanIndex];
    require(loan.active, "Loan not active");
    uint256 principal = loan.principal;
    uint256 elapsed = block.timestamp - loan.openedAt;
    (uint256 interest, , ) = calculateInterest(msg.sender, principal);
    // ... repayment logic
}
```

**Attack Prevented**: Without protocol-owned accounting, a malicious user could call `repay(principal=1, amount=1000)` to repay a large debt with minimal payment by manipulating the principal parameter.

**Enforcement**:
- `userLoans` is private and only updated by the contract
- `borrow()` creates a new `Loan` struct with principal and timestamp
- `repay(loanIndex)` reads the loan internally from storage
- Users cannot override or manipulate principal values

## Multi-Loan Support

Walnut supports multiple concurrent loans per user:

**Security Principle**: Each loan maintains its own principal and timestamp to prevent interest calculation corruption.

**Implementation**:
```solidity
function borrow(InEuint128 calldata encryptedAmount) external {
    // No restriction on existing loans
    // Each loan is independent with its own:
    // - principal amount
    // - openedAt timestamp
    // - active status
    userLoans[msg.sender].push(Loan({
        principal: decryptedAmount,
        openedAt: block.timestamp,
        active: true
    }));
}

function repay(InEuint128 calldata encryptedAmount, uint256 loanIndex) external {
    // Target specific loan by index
    Loan storage loan = userLoans[msg.sender][loanIndex];
    // Interest calculated from loan.openedAt
    // Repayment clears loan.active flag
}
```

**Benefits**:
- Users can take multiple loans without repaying existing ones
- Each loan accrues interest independently
- Flexible repayment order (repay any loan by index)
- No timestamp corruption between loans

**View Functions**:
- `getLoans(address user)`: Returns all loans for a user
- `getActiveLoans(address user)`: Returns only active loans
- `hasActiveLoan(address user)`: Checks if user has any active loan
- `getTotalActivePrincipal(address user)`: Sums principal across all active loans

## Encrypted Aggregate Synchronization

Walnut maintains both encrypted and public aggregate totals:

**Architecture**:
```solidity
euint128 private _totalBorrowedEncrypted; // Canonical encrypted total
uint256 public totalBorrowed; // Public cache for dashboard
mapping(uint256 => uint256) public pendingTotalBorrowedSyncVersions; // Request version tracking
```

**Security Principle**: The encrypted total is canonical; the public total is a cache updated via client-driven decryption sync with enclave signature checks.

**Synchronization Flow**:
1. User borrows/repays → `_totalBorrowedEncrypted` updated immediately on-chain.
2. The transaction emits a `TotalBorrowedSyncRequested(ctHash, version)` event.
3. The client receives this event, requests the enclave decryption off-chain to obtain the signed plaintext value.
4. The client submits a transaction to `syncTotalBorrowed(ciphertext, result, signature)`.
5. The contract verifies the enclave signature via the TaskManager and updates the public `totalBorrowed` cache.

**Attack Surface**:
- If signature checks were missing, aggregate metrics could be spoofed.
- Mitigated completely by `verifyDecryptResultSafe` signature verification via the TaskManager.

**Residual Risk**: Public total may lag behind encrypted total during high transaction volume. This affects dashboard display only, not protocol logic.

## Permit-Based Decryption Security

Users must create a permit to decrypt their own encrypted data:

**Permit Creation**:
```typescript
const permit = await cofheClient.generatePermit(walletAddress, contractAddress);
```

**Security Properties**:
- Permits are cryptographically signed by the user's wallet
- Permits grant read-only access (cannot modify encrypted data)
- Permits are scoped to specific contract addresses
- Permits can be revoked by the user at any time

**Attack Scenarios**:
- **Stolen Permit**: If an attacker obtains your permit, they can decrypt your encrypted data. However, they cannot modify your position or steal funds (permits are read-only).
- **Phishing**: Malicious dApps could trick users into signing permits for attacker-controlled contracts. Always verify the contract address before signing.

**Best Practices**:
- Never share your permit with untrusted parties
- Verify contract addresses before signing permits
- Revoke permits when no longer needed
- Use separate wallets for high-value positions

## Known Limitations and Future Improvements

**Current Limitations**:
1. **No Liquidation Mechanism**: Testnet version does not implement liquidations (sealed-bid auction planned for production)
2. **No Credit Scoring**: Credit tier system exists but tier progression is not yet implemented
3. **Single Owner**: No multi-sig or governance (testnet deployment)
4. **No Timelock**: Owner can change parameters immediately (testnet deployment)
5. **MockUSDC**: Uses mock tokens instead of production stablecoins (intentional for testnet)
6. **No Rate Limiting**: No protection against spam transactions (testnet only)

**Planned Security Improvements**:
1. **Multi-Sig Ownership**: Implement Gnosis Safe or similar for owner role
2. **Timelock**: Add 24-48 hour delay for critical parameter changes
3. **Circuit Breakers**: Implement automatic pause on anomalous activity
4. **Rate Limiting**: Add per-user transaction limits to prevent spam
5. **Formal Verification**: Mathematically prove critical invariants
6. **Security Audit**: Professional third-party audit before mainnet deployment
7. **Bug Bounty**: Incentivize white-hat security research

## Responsible Disclosure

If you discover a security vulnerability in Walnut Protocol:

1. **Do Not** disclose publicly until the issue is resolved
2. **Do Not** exploit the vulnerability for personal gain
3. **Do** email security@walnut.finance with details (if available)
4. **Do** provide steps to reproduce and potential impact assessment

We are committed to working with security researchers to protect user funds and privacy.

## Disclaimer

Walnut Protocol is experimental software deployed on Arbitrum Sepolia testnet for demonstration purposes. It has not undergone professional security audit and should not be used with real funds. Use at your own risk.

**No Warranty**: The protocol is provided "as is" without warranty of any kind, express or implied.

**Testnet Only**: This deployment uses mock tokens and is intended for testing and demonstration only.

**Not Financial Advice**: Nothing in this documentation constitutes financial, investment, legal, or tax advice.
