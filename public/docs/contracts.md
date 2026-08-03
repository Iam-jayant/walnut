# Walnut Protocol Contracts Documentation

Complete reference for all smart contracts deployed on Arbitrum Sepolia.

## Contract Addresses

**Network**: Arbitrum Sepolia (Chain ID: 421614)

| Contract | Address | Arbiscan |
|----------|---------|----------|
| WalnutLending | `0xA99C28678ca4C19741995B0874155e6abAad76CA` | [View](https://sepolia.arbiscan.io/address/0xA99C28678ca4C19741995B0874155e6abAad76CA) |
| WalnutFHERC20 (cUSDC) | `0x7974E997e4cF45b37Ff2fA4472ea39BB2eAD4343` | [View](https://sepolia.arbiscan.io/address/0x7974E997e4cF45b37Ff2fA4472ea39BB2eAD4343) |
| WalnutPriceOracle | `0xFaB46543812Fc34b080b668f62864e46064D9ba1` | [View](https://sepolia.arbiscan.io/address/0xFaB46543812Fc34b080b668f62864e46064D9ba1) |
| MockUSDC | `0x813Dd4Ffa32728a2d1A9e8f91714E06d062C66Dd` | [View](https://sepolia.arbiscan.io/address/0x813Dd4Ffa32728a2d1A9e8f91714E06d062C66Dd) |
| MockUSDCPriceFeed | `0xc55f567ac8E27E0Cb33fcbF62F923BA4b1f827E1` | [View](https://sepolia.arbiscan.io/address/0xc55f567ac8E27E0Cb33fcbF62F923BA4b1f827E1) |

All contracts are verified and source code is available on Arbiscan.

---

## WalnutLending

Main lending protocol contract. Handles deposits, borrows, repayments, and withdrawals with FHE-encrypted user positions.

### Constructor

```solidity
constructor(address _stablecoin, address _oracle, address _treasury)
```

**Parameters:**
- `_stablecoin`: Address of WalnutFHERC20 (cUSDC) contract
- `_oracle`: Address of WalnutPriceOracle contract
- `_treasury`: Address to receive protocol fees

**Initialization:**
- Sets contract owner to deployer
- Initializes tier LTVs: [7000, 7500, 8000, 8500, 9000]
- Emits `OwnershipTransferred` event

### State Variables

**Public Constants:**
```solidity
uint256 public constant BORROW_APR = 800;              // 8% annual rate
uint256 public constant PROTOCOL_FEE_APR = 200;        // 2% annual rate
uint256 public constant SECONDS_PER_YEAR = 365 days;
uint256 public constant PRECISION = 1e6;               // 6 decimals
uint128 public constant LIQUIDATION_THRESHOLD = 10500; // 105% (10500 bps)
```

**Immutable:**
```solidity
IWalnutStablecoin public immutable stablecoin;
IWalnutOracle public immutable oracle;
address public immutable treasury;
```

**Encrypted State:**
```solidity
mapping(address => euint128) private _collateral;
mapping(address => euint128) private _debt;
mapping(address => euint128) private _repaymentCount;
mapping(address => euint128) private _defaultCount;
euint128 private _totalBorrowedEncrypted;
mapping(address => euint128) private _guardThreshold;
```

**Public State:**
```solidity
address public owner;
bool public paused;
mapping(address => uint256) private principalDebt;
mapping(address => uint256) public borrowTimestamp;
mapping(address => uint8) public creditTier;
uint16[5] public tierLTVs;
uint256 public totalDeposited;
uint256 public totalBorrowed;
uint256 public totalBorrowedSyncVersion;
mapping(address => uint256) public auditorPermitExpiry;
```

### User Functions

#### deposit

```solidity
function deposit(address token, uint256 amount) external whenNotPaused
```

Deposits ERC20 collateral and increases encrypted collateral balance.

**Parameters:**
- `token`: Address of ERC20 token to deposit
- `amount`: Amount of tokens to deposit (in token decimals)

**Requirements:**
- Protocol not paused
- `amount > 0`
- User has approved contract to transfer tokens
- Token has price feed configured in oracle

**Effects:**
- Transfers tokens from user to contract
- Queries oracle for USD value
- Increases `_collateral[msg.sender]` by encrypted USD value
- Grants user permission to decrypt their collateral
- Adds to user's vault holdings
- Increases `totalDeposited`

**Events:**
- `Deposited(user, token, amount, usdValue)`

**FHE Operations:**
- `FHE.asEuint128(usdValue)` - Encrypt USD value
- `FHE.add(_collateral[user], encryptedValue)` - Add to collateral
- `FHE.allow(_collateral[user], user)` - Grant read permission

#### borrow

```solidity
function borrow(InEuint128 calldata encryptedAmount) external whenNotPaused
```

Borrows encrypted cUSDC against collateral, enforcing LTV limits via FHE. Supports multiple concurrent loans.

**Parameters:**
- `encryptedAmount`: Client-encrypted borrow amount (InEuint128)

**Requirements:**
- Protocol not paused
- No pending principal sync
- Encrypted amount within LTV limit (checked via FHE)

**Effects:**
- Checks LTV using encrypted comparison
- Mints cUSDC if within limit (via `FHE.select`)
- Updates `_debt[msg.sender]`
- Creates new `Loan` struct in `userLoans[msg.sender]` array
- Updates `_totalBorrowedEncrypted`
- Emits `BorrowPrincipalSyncRequested` for client-driven decryption sync
- Emits `TotalBorrowedSyncRequested` for client-driven total borrowed sync

**Events:**
- `Borrowed(user, timestamp)`
- `LoanOpened(user, loanIndex, openedAt)`
- `BorrowPrincipalSyncRequested(user, requestId, openedAt)`
- `TotalBorrowedSyncRequested(requestId, version)`

**FHE Operations:**
- `FHE.asEuint128(encryptedAmount)` - Convert input
- `FHE.mul(_collateral[user], ltvEncrypted)` - Calculate max borrow
- `FHE.div(collateralTimesLTV, 10000)` - Apply LTV percentage
- `FHE.lte(candidateDebt, maxBorrow)` - Check limit
- `FHE.select(withinLimit, amount, 0)` - Conditional mint

**Multi-Loan Support:**
- No restriction on existing loans
- Each loan is independent with its own principal and timestamp
- Users can have multiple active loans simultaneously

#### repay

```solidity
function repay(InEuint128 calldata encryptedAmount, uint256 loanIndex) external whenNotPaused
```

Repays a specific loan with interest, burning cUSDC and clearing debt.

**Parameters:**
- `encryptedAmount`: Client-encrypted repay amount (InEuint128)
- `loanIndex`: Index of the loan to repay in the user's loans array

**Requirements:**
- Protocol not paused
- No pending principal sync
- Loan exists and is active (`userLoans[user][loanIndex].active == true`)
- Encrypted amount >= principal + interest (checked via FHE)

**Effects:**
- Retrieves loan from `userLoans[msg.sender][loanIndex]`
- Calculates interest using `calculateInterest()`
- Checks if repay amount is sufficient (via FHE)
- Clears `_debt[msg.sender]` if sufficient
- Sets `loan.active = false` if sufficient
- Increments `_repaymentCount[msg.sender]` if sufficient
- Burns cUSDC
- Reduces `_totalBorrowedEncrypted`
- Emits `RepayStateSyncRequested` for client-driven decryption sync
- Emits `TotalBorrowedSyncRequested` for client-driven total borrowed sync

**Events:**
- `LoanRepaid(user, loanIndex, principal, interest)`
- `RepaymentSettlementIntent(user, principal, interest, protocolFee)`
- `RepayStateSyncRequested(user, requestId)`
- `TotalBorrowedSyncRequested(requestId, version)`

**FHE Operations:**
- `FHE.asEuint128(encryptedAmount)` - Convert input
- `FHE.gte(amount, requiredAmount)` - Check sufficiency
- `FHE.select(sufficient, 0, _debt[user])` - Conditional clear
- `FHE.select(sufficient, burnAmount, 0)` - Conditional burn

**Multi-Loan Support:**
- Targets specific loan by index
- Other loans remain unaffected
- Can repay loans in any order

#### withdraw

```solidity
function withdraw(address token, uint256 amount) external whenNotPaused
```

Withdraws collateral after loan is repaid.

**Parameters:**
- `token`: Address of ERC20 token to withdraw
- `amount`: Amount of tokens to withdraw (in token decimals)

**Requirements:**
- Protocol not paused
- `amount > 0`
- No pending principal sync
- No active loans (`hasActiveLoan(user) == false`)
- Sufficient vault balance

**Effects:**
- Queries oracle for USD value
- Decreases `_collateral[msg.sender]` by encrypted USD value
- Decreases `totalDeposited`
- Transfers tokens to user
- Removes from vault holdings

**Events:**
- `Withdrawn(user, token, amount)`
- `WithdrawFinalized(user, token, amount, true)`

**FHE Operations:**
- `FHE.asEuint128(usdValue)` - Encrypt USD value
- `FHE.sub(_collateral[user], encryptedValue)` - Subtract from collateral

### Multi-Loan View Functions

#### getLoans

```solidity
function getLoans(address user) external view returns (Loan[] memory)
```

Returns all loans for a user (both active and inactive).

**Parameters:**
- `user`: Address to query

**Returns:**
- Array of `Loan` structs:
  ```solidity
  struct Loan {
      uint128 principal;
      uint256 openedAt;
      bool active;
  }
  ```

#### getActiveLoans

```solidity
function getActiveLoans(address user) external view returns (Loan[] memory, uint256[] memory)
```

Returns only active loans for a user.

**Parameters:**
- `user`: Address to query

**Returns:**
- `loans`: Array of active `Loan` structs
- `indices`: Array of loan indices in the user's loans array

**Use Case:** Frontend displays only active loans that can be repaid

#### hasActiveLoan

```solidity
function hasActiveLoan(address user) external view returns (bool)
```

Checks if user has any active loans.

**Parameters:**
- `user`: Address to check

**Returns:**
- `true` if user has at least one active loan, `false` otherwise

**Use Case:** Withdraw function checks this before allowing collateral withdrawal

#### getTotalActivePrincipal

```solidity
function getTotalActivePrincipal(address user) external view returns (uint256)
```

Sums principal across all active loans for a user.

**Parameters:**
- `user`: Address to query

**Returns:**
- Total principal amount across all active loans

**Use Case:** Dashboard displays total borrowed amount

### Position Management

#### setPositionGuard

```solidity
function setPositionGuard(InEuint128 calldata encryptedThreshold) external
```

Sets encrypted health factor threshold for position monitoring.

**Parameters:**
- `encryptedThreshold`: Client-encrypted HF threshold (e.g., 1.2 = 12000)

**Effects:**
- Stores encrypted threshold for user
- Grants contract permission to use threshold

**Events:**
- `PositionGuardSet(user)`

#### checkPositionGuard

```solidity
function checkPositionGuard(address user) external
```

Checks if user's health factor is below their guard threshold.

**Parameters:**
- `user`: Address to check

**Requirements:**
- User has set a guard threshold
- Handles edge cases (zero debt, zero collateral) gracefully

**Effects:**
- Calculates health factor using FHE
- Compares to threshold
- Grants decryption permission to public enclave via `FHE.allowPublic`
- Maps request ID to user in `_pendingGuardChecks`
- Attendant sync execution in `syncPositionGuardCheck` emits `PositionGuardTriggered` if HF < threshold

**FHE Operations:**
- `FHE.mul(_collateral[user], 10000)` - Scale collateral
- `FHE.div(scaledCollateral, debt)` - Calculate HF
- `FHE.lt(hf, threshold)` - Compare to threshold

### Credit Tier Management

#### requestCreditTierUpdate

```solidity
function requestCreditTierUpdate(address user) external
```

Requests credit tier update based on repayment count.

**Parameters:**
- `user`: Address to update tier for

**Effects:**
- Grants public enclave permission to decrypt repayment count via `FHE.allowPublic`
- Maps decryption request ID to user in `decryptRequests`
- Attendant sync execution in `syncCreditCount` updates user tier based on decrypted count

**Events:**
- `CreditTierUpdated(user, tier)` (emitted in `syncCreditCount`)

### View Functions

#### calculateInterest

```solidity
function calculateInterest(address user, uint256 principal)
    public view
    returns (uint256 totalInterest, uint256 protocolFee, uint256 lenderPayment)
```

Calculates accrued interest for a loan.

**Parameters:**
- `user`: Borrower address
- `principal`: Loan principal amount

**Returns:**
- `totalInterest`: Total interest accrued
- `protocolFee`: 25% of total interest
- `lenderPayment`: 75% of total interest

**Formula:**
```
elapsed = block.timestamp - borrowTimestamp[user]
totalInterest = (principal × BORROW_APR × elapsed × PRECISION) / (SECONDS_PER_YEAR × 10000 × PRECISION)
protocolFee = totalInterest / 4
lenderPayment = totalInterest - protocolFee
```

#### utilizationRate

```solidity
function utilizationRate() external view returns (uint256)
```

Returns protocol utilization rate in basis points.

**Returns:**
- Utilization rate (0-10000, where 10000 = 100%)
- Returns 0 if `totalDeposited == 0`

**Formula:**
```
utilizationRate = (totalBorrowed × 10000) / totalDeposited
```

#### currentBorrowRate

```solidity
function currentBorrowRate() external view returns (uint256)
```

Returns current dynamic borrow rate in basis points.

**Returns:**
- Borrow rate (600-1200 bps, i.e., 6%-12% APR)
- Returns 600 (6%) if `totalDeposited == 0`

**Formula:**
```
currentBorrowRate = 600 + ((totalBorrowed × 600) / totalDeposited)
```

**Rate Model:**
- Base rate: 6% (600 bps)
- Slope: 6% (600 bps)
- At 0% utilization: 6% APR
- At 100% utilization: 12% APR

#### getEncryptedCollateral

```solidity
function getEncryptedCollateral(address user) external view returns (euint128)
```

Returns user's encrypted collateral handle.

**Parameters:**
- `user`: Address to query

**Returns:**
- `euint128` handle (32-byte encrypted value)

**Note:** User needs permit to decrypt this value.

#### getEncryptedDebt

```solidity
function getEncryptedDebt(address user) external view returns (euint128)
```

Returns user's encrypted debt handle.

#### getEncryptedRepaymentCount

```solidity
function getEncryptedRepaymentCount(address user) external view returns (euint128)
```

Returns user's encrypted repayment count handle.

#### getVaults

```solidity
function getVaults(address user) external view returns (VaultHolding[] memory)
```

Returns user's vault holdings (token addresses and amounts).

**Returns:**
- Array of `VaultHolding` structs:
  ```solidity
  struct VaultHolding {
      address token;
      uint256 amount;
  }
  ```

#### vaultBalanceOf

```solidity
function vaultBalanceOf(address user, address token) external view returns (uint256)
```

Returns user's total balance of a specific token in their vault.

**Parameters:**
- `user`: Address to query
- `token`: Token address

**Returns:**
- Total amount of token in user's vault

### Admin Functions

#### pause / unpause

```solidity
function pause() external onlyOwner
function unpause() external onlyOwner
```

Pauses/unpauses all protocol operations.

**Effects:**
- Sets `paused` flag
- Blocks all user functions when paused

**Events:**
- `Paused(by)` / `Unpaused(by)`

#### transferOwnership

```solidity
function transferOwnership(address newOwner) external onlyOwner
```

Transfers contract ownership.

**Parameters:**
- `newOwner`: New owner address (cannot be zero address)

**Events:**
- `OwnershipTransferred(previousOwner, newOwner)`

#### grantAuditorPermit

```solidity
function grantAuditorPermit(address auditor, uint256 expiry) external onlyOwner
```

Grants time-limited read access to encrypted positions.

**Parameters:**
- `auditor`: Address to grant access
- `expiry`: Unix timestamp when permit expires

**Requirements:**
- `auditor != address(0)`
- `expiry > block.timestamp`

**Events:**
- `AuditorPermitGranted(auditor, expiry)`

#### revokeAuditorPermit

```solidity
function revokeAuditorPermit(address auditor) external onlyOwner
```

Revokes auditor's read access.

**Parameters:**
- `auditor`: Address to revoke

**Events:**
- `AuditorPermitRevoked(auditor)`

### Client-Driven Decryption Sync Functions

These functions are called by the client (frontend) off-chain to synchronize decrypted results and verify enclave signatures on-chain via the TaskManager.

#### syncLoanPrincipal

```solidity
function syncLoanPrincipal(euint128 ciphertext, uint128 result, bytes calldata signature) external
```

Synchronizes borrow principal after a borrow operation.

**Parameters:**
- `ciphertext`: Encrypted principal ciphertext handle
- `result`: Plaintext decrypted principal amount
- `signature`: ECDSA signature signed by FHE enclave nodes

**Effects:**
- Verifies enclave signature via `TaskManager.verifyDecryptResultSafe`
- Retrieves loan details associated with the ciphertext handle
- Updates `userLoans[user][loanIndex].principal = result`
- Sets `userLoans[user][loanIndex].active = true`
- Clears pending sync mappings

**Events:**
- `LoanPrincipalSynced(user, loanIndex, principal, openedAt)`

**Multi-Loan Context:**
- Each loan sync is independent
- Active loan tracking and index mapping safely isolated per loan

#### syncLoanRepay

```solidity
function syncLoanRepay(euint128 ciphertext, uint128 result, bytes calldata signature) external
```

Synchronizes repay state after a repayment operation.

**Parameters:**
- `ciphertext`: Encrypted repay signal ciphertext handle
- `result`: Decryption signal (1 = full repayment, 0 = insufficient)
- `signature`: ECDSA signature signed by FHE enclave nodes

**Effects:**
- Verifies enclave signature via `TaskManager.verifyDecryptResultSafe`
- If result == 1:
  - Sets `userLoans[user][loanIndex].active = false`
  - Clears `userLoans[user][loanIndex].principal = 0`

**Events:**
- `LoanRepayFailed(user, loanIndex)` (if result == 0)
- `LoanStateCleared(user, loanIndex)` (if result == 1)

#### syncTotalBorrowed

```solidity
function syncTotalBorrowed(euint128 ciphertext, uint128 result, bytes calldata signature) external
```

Synchronizes global total borrowed cache.

**Parameters:**
- `ciphertext`: Encrypted total borrowed ciphertext handle
- `result`: Plaintext total borrowed amount
- `signature`: ECDSA signature signed by FHE enclave nodes

**Effects:**
- Verifies enclave signature via `TaskManager.verifyDecryptResultSafe`
- Updates `totalBorrowed` cache on-chain if version check matches

**Events:**
- `TotalBorrowedCacheUpdated(totalBorrowed, version)`

#### syncPositionGuardCheck

```solidity
function syncPositionGuardCheck(euint128 ciphertext, uint128 result, bytes calldata signature) external
```

Synchronizes user position health guard state.

**Parameters:**
- `ciphertext`: Encrypted position guard signal handle
- `result`: Plaintext signal (1 = triggered, 0 = not triggered)
- `signature`: ECDSA signature signed by FHE enclave nodes

**Effects:**
- Verifies signature and triggers `PositionGuardTriggered(user)` event if result == 1

**Events:**
- `PositionGuardTriggered(user)` (if result == 1)

#### syncCreditCount

```solidity
function syncCreditCount(euint128 ciphertext, uint128 result, bytes calldata signature) external
```

Synchronizes user repayment count for credit tier progression.

**Parameters:**
- `ciphertext`: Encrypted repayment count handle
- `result`: Plaintext decrypted repayment count
- `signature`: ECDSA signature signed by FHE enclave nodes

**Effects:**
- Verifies signature, derives credit tier, and updates `creditTier[user]`

**Events:**
- `CreditTierUpdated(user, tier)`

**Tier Mapping:**
- count >= 50 → Tier 4 (90% LTV)
- count >= 25 → Tier 3 (85% LTV)
- count >= 10 → Tier 2 (80% LTV)
- count >= 3 → Tier 1 (75% LTV)
- count < 3 → Tier 0 (70% LTV)

### Events

```solidity
event Deposited(address indexed user, address indexed token, uint256 amount, uint256 usdValue);
event Borrowed(address indexed user, uint256 timestamp);
event LoanOpened(address indexed user, uint256 indexed loanIndex, uint256 openedAt);
event LoanPrincipalSynced(address indexed user, uint256 indexed loanIndex, uint256 principal, uint256 openedAt);
event BorrowPrincipalSyncRequested(address indexed user, uint256 requestId, uint256 openedAt);
event LoanRepaid(address indexed user, uint256 indexed loanIndex, uint256 principal, uint256 interest);
event LoanRepayFailed(address indexed user, uint256 indexed loanIndex);
event RepaymentSettlementIntent(address indexed user, uint256 principal, uint256 interest, uint256 protocolFee);
event LoanStateCleared(address indexed user, uint256 indexed loanIndex);
event RepayStateSyncRequested(address indexed user, uint256 requestId);
event Withdrawn(address indexed user, address indexed token, uint256 amount);
event WithdrawFinalized(address indexed user, address indexed token, uint256 amount, bool approved);
event CreditTierUpdated(address indexed user, uint8 tier);
event PositionGuardSet(address indexed user);
event PositionGuardTriggered(address indexed user);
event AuditorPermitGranted(address indexed auditor, uint256 expiry);
event AuditorPermitRevoked(address indexed auditor);
event TotalBorrowedCacheUpdated(uint256 totalBorrowed, uint256 version);
event TotalBorrowedSyncRequested(uint256 requestId, uint256 version);
event Paused(address indexed by);
event Unpaused(address indexed by);
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
```

---

## WalnutFHERC20

Encrypted ERC20 token (cUSDC) used as the borrow asset. Balances are stored as `euint128`.

### Constructor

```solidity
constructor()
```

**Initialization:**
- Sets name to "Walnut Confidential USDC"
- Sets symbol to "cUSDC"
- Sets decimals to 6
- Sets owner to deployer

### Public Functions

#### mint

```solidity
function mint(address to, InEuint128 calldata encryptedAmount) external onlyMinter
```

Mints encrypted tokens (external interface).

**Parameters:**
- `to`: Recipient address
- `encryptedAmount`: Client-encrypted amount

**Requirements:**
- Caller must be minter (WalnutLending)

#### mintInternal

```solidity
function mintInternal(address to, euint128 amount) external onlyMinter
```

Mints encrypted tokens (internal interface for contract-to-contract calls).

**Parameters:**
- `to`: Recipient address
- `amount`: Already-encrypted amount (euint128)

#### burn / burnInternal

```solidity
function burn(address from, InEuint128 calldata encryptedAmount) external onlyMinter
function burnInternal(address from, euint128 amount) external onlyMinter
```

Burns encrypted tokens.

#### transfer

```solidity
function transfer(address to, InEuint128 calldata encryptedAmount) external returns (bool)
```

Transfers encrypted tokens.

**Parameters:**
- `to`: Recipient address
- `encryptedAmount`: Client-encrypted transfer amount

**Effects:**
- Checks balance sufficiency via FHE
- Transfers amount if sufficient (via `FHE.select`)
- Grants permissions to sender and recipient

#### approve

```solidity
function approve(address spender, InEuint128 calldata encryptedAmount) external returns (bool)
```

Approves encrypted spending allowance.

#### transferFrom

```solidity
function transferFrom(address from, address to, InEuint128 calldata encryptedAmount) external returns (bool)
```

Transfers tokens using allowance.

### View Functions

#### balanceOf

```solidity
function balanceOf(address account) external view returns (euint128)
```

Returns encrypted balance handle.

#### allowance

```solidity
function allowance(address owner, address spender) external view returns (euint128)
```

Returns encrypted allowance handle.

### Admin Functions

#### setMinter

```solidity
function setMinter(address _minter) external onlyOwner
```

Sets the authorized minter (should be WalnutLending).

---

## WalnutPriceOracle

Oracle adapter for Chainlink price feeds. Converts token amounts to USD values.

### Functions

#### setPriceFeed

```solidity
function setPriceFeed(address token, address feed) external onlyOwner
```

Registers a Chainlink price feed for a token.

**Parameters:**
- `token`: ERC20 token address
- `feed`: Chainlink AggregatorV3Interface address

#### getUSDValue

```solidity
function getUSDValue(address token, uint256 amount) external view returns (uint256)
```

Converts token amount to USD value (6 decimals).

**Parameters:**
- `token`: Token address
- `amount`: Amount in token decimals

**Returns:**
- USD value with 6 decimals

**Requirements:**
- Price feed must be configured
- Price must not be stale (< 1 hour old)
- Price must be positive

**Formula:**
```
usdValue = (amount × price × 1e6) / (10^tokenDecimals × 10^priceFeedDecimals)
```

---

## MockUSDC

Standard ERC20 token with open minting for testnet use.

### Functions

#### mint

```solidity
function mint(address to, uint256 amount) external
```

Mints tokens to any address (open for testing).

**Parameters:**
- `to`: Recipient address
- `amount`: Amount to mint (6 decimals)

**Note:** Anyone can mint—this is intentional for testnet.

---

## MockUSDCPriceFeed

Chainlink-compatible price feed returning fixed $1.00 price.

### Functions

#### latestRoundData

```solidity
function latestRoundData() external view returns (
    uint80 roundId,
    int256 answer,
    uint256 startedAt,
    uint256 updatedAt,
    uint80 answeredInRound
)
```

Returns mock price data.

**Returns:**
- `answer`: 100000000 (8 decimals = $1.00)
- `updatedAt`: Current block timestamp
- Other fields: Mock values

---

## Integration Examples

### Depositing Collateral

```typescript
// 1. Approve token
await mockUSDC.approve(walnutLendingAddress, amount);

// 2. Deposit
await walnutLending.deposit(mockUSDCAddress, amount);
```

### Borrowing

```typescript
// 1. Encrypt amount client-side
const encryptedAmount = await cofheClient.encrypt(amount);

// 2. Initiate Borrow transaction (mints cUSDC and emits BorrowPrincipalSyncRequested event)
const tx = await walnutLending.borrow(encryptedAmount);
const receipt = await tx.wait();

// 3. Retrieve requestId from the BorrowPrincipalSyncRequested event
const event = receipt.events.find(e => e.name === "BorrowPrincipalSyncRequested");
const { requestId } = event.args;

// 4. Request enclave decryption signature off-chain via CoFHE SDK
const { decryptedValue, signature } = await cofheClient
    .decryptForTx(requestId)
    .execute();

// 5. Submit client-driven sync transaction with enclave signature to finalize the active state
await walnutLending.syncLoanPrincipal(requestId, decryptedValue, signature);
```

### Repaying

```typescript
// 1. Calculate total repayment (principal + accrued interest)
const [totalInterest, protocolFee, lenderPayment] = 
    await walnutLending.calculateInterest(userAddress, principal);
const totalRepay = principal + totalInterest;

// 2. Encrypt amount
const encryptedAmount = await cofheClient.encrypt(totalRepay);

// 3. Initiate Repay transaction (burns cUSDC and emits RepaySyncRequested event)
const tx = await walnutLending.repay(encryptedAmount, loanIndex);
const receipt = await tx.wait();

// 4. Retrieve requestId from the RepaySyncRequested event
const event = receipt.events.find(e => e.name === "RepayStateSyncRequested");
const { requestId } = event.args;

// 5. Request enclave decryption signature off-chain via CoFHE SDK
const { decryptedValue, signature } = await cofheClient
    .decryptForTx(requestId)
    .execute();

// 6. Submit client-driven sync transaction with enclave signature to finalize loan closure
await walnutLending.syncLoanRepay(requestId, decryptedValue, signature);

// 7. Handle Privara interest settlement (separate transaction)
```

### Decrypting Values

```typescript
// 1. Get encrypted handle
const encryptedCollateral = await walnutLending.getEncryptedCollateral(userAddress);

// 2. Decrypt with permit
const decryptedValue = await cofheClient.decrypt(
    encryptedCollateral,
    userPermit
);
```

---

For more information, see:
- [Architecture Documentation](architecture.md)
- [Security Documentation](security.md)
- [User Guide](user-guide.md)
