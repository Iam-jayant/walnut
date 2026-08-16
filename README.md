<div align="center">

<pre>
██╗    ██╗ █████╗ ██╗     ███╗   ██╗██╗   ██╗████████╗
██║    ██║██╔══██╗██║     ████╗  ██║██║   ██║╚══██╔══╝
██║ █╗ ██║███████║██║     ██╔██╗ ██║██║   ██║   ██║   
██║███╗██║██╔══██║██║     ██║╚██╗██║██║   ██║   ██║   
╚███╔███╔╝██║  ██║███████╗██║ ╚████║╚██████╔╝   ██║   
 ╚══╝╚══╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝ ╚═════╝    ╚═╝   
                                                        
Confidential Lending Protocol • Powered by FHENIX
</pre>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.25-blue)](https://soliditylang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.2.1-black)](https://nextjs.org/)
[![Tests](https://img.shields.io/badge/Tests-60%2B%20Passing-brightgreen)](./test)
[![Network](https://img.shields.io/badge/Network-Arbitrum%20Sepolia-blue)](https://sepolia.arbiscan.io/)

**[Live Product](https://walnut-finance.vercel.app/)** • **[Video](https://youtu.be/zb2FVYq8C58?si=kjZE6NKMwfgBMBkN)** • **[Protocol Spec](./WALNUT_PROTOCOL_SPEC.md)** • **[Technical Docs](./Technical-docs)** • **[Privacy Audit](./PRIVACY_AUDIT.md)** 

---

**Quick Navigation:** [Overview](#overview) • [Architecture](#architecture) • [Tech Stack](#tech-stack) • [Contracts](#deployed-contracts) • [Quick Start](#quick-start) • [Usage](#usage-guide) • [Testing](#testing) • [Technical Deep Dive](#technical-deep-dive) • [Security](#security) • [Performance](#performance) • [Roadmap](#walnut-beyond-the-buildathon) • [Documentation](#documentation)

</div>

---

## Overview

> **Deposit USDC. Borrow cUSDC. Nobody sees how much.**

Walnut Protocol is a **confidential lending protocol** built with **Fully Homomorphic Encryption (FHE)**. Users deposit collateral and borrow an encrypted stablecoin while their position data remains encrypted on-chain. The protocol enforces collateral ratios, calculates interest, and manages credit tiers—**all without revealing individual user positions**.

### Why FHE, Not ZK?

**Zero-Knowledge proofs** let you prove something is true without revealing why.  
**Fully Homomorphic Encryption** lets you compute on encrypted data without ever decrypting it.

For confidential lending, we need the protocol to:
- Calculate your health factor on encrypted collateral and debt
- Compare sealed bids in liquidation auctions
- Update credit scores based on encrypted repayment history

**ZK can't do that. FHE can.**


---

## Key Features

### [▸] Encrypted Positions
- Collateral, debt, and health factors stored as `euint128` values on-chain
- Only you can decrypt your own data via cryptographic permits
- Protocol performs FHE operations without seeing plaintext values

### [▸] P2P Confidential Marketplace (`WalnutP2P`)
- Create encrypted LEND and BORROW offers with private principal, interest rate, and duration terms
- Counterparty submits encrypted matching terms evaluated on-chain via homomorphic equality checks (`FHE.eq`)
- Automated settlement callback (`syncMatchSettlement`) executes principal transfer upon verified match

### [▸] Solvency-Protected ENS Wallet Linking
- Link secondary wallets/ENS names to aggregate collateral across accounts using EIP-712 domain-bound signatures
- `requestUnlink` + `syncUnlink` callback protects protocol solvency: unlinking is blocked on-chain if removing the secondary wallet leaves the primary position undercollateralized

### [▸] Protocol-Owned Accounting & Repay Hardening
- Users cannot manipulate debt calculations through calldata
- Repay exploit hardening ensures `$0` real balance calls strictly preserve outstanding debt and do not increment `_repaymentCount`
- Each loan maintains independent principal and timestamp

### [▸] Multi-Loan Support
- Users can have multiple concurrent loans
- Each loan tracks its own principal, timestamp, and active status
- Independent interest calculation per loan
- Flexible repayment order

### [▸] Credit Tier System
- Encrypted repayment history unlocks better LTV ratios
- Tier 0 (70% LTV) → Tier 4 (90% LTV)
- On-chain credit progression without exposing history

### [▸] Interest Calculation
- 8% APR with 25% protocol fee, 75% to lenders
- Linear accrual from borrow timestamp
- Private settlement via Privara for encrypted payment metadata

### [▸] Shielded Collateral Vault
- Shield standard USDC into `wUSDC` (Vault Wrapper) to fully encrypt collateral before entering the protocol
- Borrow encrypted `cUSDC` stablecoin against shielded collateral
- Chainlink price feeds for accurate real-time valuation

---

## Architecture

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Next.js UI  │  │  CoFHE SDK   │  │  wagmi + viem        │   │
│  │  (React 18)  │  │  (Encrypt)   │  │  (Web3 Interactions) │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Arbitrum Sepolia Blockchain                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐   │
│  │ WalnutVault      │  │ WalnutLending    │  │ Price Oracle │   │
│  │ Wrapper (wUSDC)  ├─►│ (Main Protocol)  │  │ (Chainlink)  │   │
│  └──────────────────┘  └─────────┬────────┘  └──────────────┘   │
│                                  │                              │
│                        ┌─────────▼────────┐                     │
│                        │ WalnutFHERC20    │                     │
│                        │ (cUSDC Token)    │                     │
│                        └──────────────────┘                     │
│           ▼                                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Encrypted State (euint128)                              │   │
│  │  • _collateral[user]  • _debt[user]                      │   │
│  │  • _repaymentCount[user]  • _defaultCount[user]          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        CoFHE Network                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Threshold Decryption — client-driven model              │   │
│  │  1. Contract: FHE.allowPublic(handle)                    │   │
│  │  2. Client: request decryption off-chain via SDK         │   │
│  │  3. Client: submit (handle, plaintext, signature)        │   │
│  │  4. Contract: FHE.verifyDecryptResultSafe(...)           │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### FHE Data Flow

```
User Input (Plain) → Browser Encryption → InEuint128 (Ciphertext)
                                                │
                                                ▼
                                    Smart Contract Receives
                                                │
                                                ▼
                                    FHE Operations (add, sub, mul, div, compare)
                                                │
                                                ▼
                                    euint128 Stored On-Chain
                                                │
                                                ▼
                                    FHE.allow(value, user)
                                                │
                                                ▼
                                    User Creates Permit
                                                │
                                                ▼
                                    CoFHE Decrypts → Display
```


---

## Tech Stack

### Smart Contracts
| Component | Version | Purpose |
|-----------|---------|---------|
| **Solidity** | 0.8.25 | Smart contract language |
| **CoFHE Contracts** | 0.1.3 | FHE operations (FHE.sol) |
| **Chainlink** | 1.5.0 | Price feed oracles |
| **OpenZeppelin** | Latest | Security primitives (ReentrancyGuard, SafeERC20) |
| **Hardhat** | 2.24.2 | Development framework |

### Frontend
| Component | Version | Purpose |
|-----------|---------|---------|
| **Next.js** | 16.2.1 | React framework (App Router) |
| **TypeScript** | 5.x | Type-safe development |
| **wagmi** | 2.19.5 | React hooks for Ethereum |
| **viem** | 2.47.6 | TypeScript Ethereum library |
| **CoFHE SDK** | 0.5.0 | Client-side encryption |
| **TanStack Query** | 5.95.2 | Async state management |
| **Tailwind CSS** | 4.1.9 | Utility-first styling |
| **Framer Motion** | 12.38.0 | Animations |

**UI/UX Architecture:** The application features a "Private Lending Command Center" aesthetic built around a unified, single-card layout. It utilizes clean 10% chamfers (`rounded-md`), minimal borders (`border-black/10`), and high-contrast dark gradients for key protocol health indicators, abandoning heavy glassmorphism for a sleek, premium, and professional FHE financial interface.

### Infrastructure
| Component | Purpose |
|-----------|---------|
| **Arbitrum Sepolia** | Layer 2 testnet deployment |
| **Vercel** | Frontend hosting & CDN |
| **Privara** | Private settlement coordination *(Note: SDK settlement mocked on Testnet; full integration active on Mainnet)* |
| **CoFHE Network** | Threshold decryption service |

---

## Deployed Contracts

**Network**: Arbitrum Sepolia (Chain ID: 421614)

| Contract | Address | Arbiscan |
|----------|---------|----------|
| **WalnutLendingV2** | `0x22715b184B040c65d1aFb15595B533f2BD94bCfa` | [View →](https://sepolia.arbiscan.io/address/0x22715b184B040c65d1aFb15595B533f2BD94bCfa) |
| **WalnutP2P (Confidential Marketplace)** | `0xF0B496672c2b4F7fC8F53ece3c5199F51f40F517` | [View →](https://sepolia.arbiscan.io/address/0xF0B496672c2b4F7fC8F53ece3c5199F51f40F517) |
| **cUSDC (WalnutFHERC20)** | `0x141F1eD1548F7a1000Dc67C0338c427acE2A654D` | [View →](https://sepolia.arbiscan.io/address/0x141F1eD1548F7a1000Dc67C0338c427acE2A654D) |
| **WalnutVaultWrapper (wUSDC)** | `0x8684d325BE9B635BD72bFC2bB10bB6f354f5Cd61` | [View →](https://sepolia.arbiscan.io/address/0x8684d325BE9B635BD72bFC2bB10bB6f354f5Cd61) |
| **WalnutPriceOracle** | `0x82E7caF958B329c47F10778E10A89B2319D67A14` | [View →](https://sepolia.arbiscan.io/address/0x82E7caF958B329c47F10778E10A89B2319D67A14) |
| **MockUSDC** | `0x6341A12D08EE6F6fA071CF94C7C4a878ee5AF3ef` | [View →](https://sepolia.arbiscan.io/address/0x6341A12D08EE6F6fA071CF94C7C4a878ee5AF3ef) |

All contracts are **verified** on Arbiscan with source code available.


---

## Quick Start

### Prerequisites

```bash
# Required
Node.js 18+ and npm
MetaMask or compatible Web3 wallet
Arbitrum Sepolia testnet ETH

# Get testnet ETH
https://faucet.quicknode.com/arbitrum/sepolia
```

### Installation

```bash
# Clone the repository
git clone https://github.com/Iam-jayant/walnut.git
cd walnut

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
```

### Environment Configuration

Edit `.env.local`:

```bash
# Network Configuration
NEXT_PUBLIC_CHAIN_ID=421614
NEXT_PUBLIC_RPC_URL_PRIMARY=https://sepolia-rollup.arbitrum.io/rpc
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here

# Contract Addresses (Canonical Live Network Deployment)
NEXT_PUBLIC_WALNUT_LENDING_ADDRESS=0x22715b184B040c65d1aFb15595B533f2BD94bCfa
NEXT_PUBLIC_WALNUT_P2P_ADDRESS=0xF0B496672c2b4F7fC8F53ece3c5199F51f40F517
NEXT_PUBLIC_FHERC20_ADDRESS=0x141F1eD1548F7a1000Dc67C0338c427acE2A654D
NEXT_PUBLIC_ORACLE_ADDRESS=0x82E7caF958B329c47F10778E10A89B2319D67A14
NEXT_PUBLIC_MOCK_USDC_ADDRESS=0x6341A12D08EE6F6fA071CF94C7C4a878ee5AF3ef
NEXT_PUBLIC_WRAPPER_ADDRESS=0x8684d325BE9B635BD72bFC2bB10bB6f354f5Cd61
```

### Run the Application

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start

# Open browser
http://localhost:3000
```

---

## Usage Guide

### Step-by-Step Walkthrough

#### [1] Connect Wallet
```
Connect MetaMask → Switch to Arbitrum Sepolia → Approve connection
```

#### [2] Mint Test USDC
```
Navigate to Deposit page → Click "Faucet" → Confirm transaction to mint MockUSDC.
```

#### [3] Create FHE Permit
```
Sign permit message → Grant decryption access to your wallet
```

#### [4] Shield & Deposit Collateral
```
Enter amount → Approve MockUSDC → Click "Shield & Deposit" → Confirm transactions.
Your raw USDC is wrapped into `wUSDC` via the Vault Wrapper and deposited into the protocol, fully encrypted on-chain.
```

#### [5] Borrow cUSDC
```
Enter borrow amount → Protocol checks LTV via FHE → Mint cUSDC
Your debt is encrypted — nobody knows how much you borrowed
```

#### [6] Repay Loan
```
Select loan → Enter repay amount → Confirm two transactions:
  1. Repay transaction (burns cUSDC)
  2. Settlement transaction (interest payment via Privara)
```

#### [7] Withdraw Collateral
```
Repay all loans → Enter withdraw amount → Confirm transaction
Your collateral is returned
```

### Protocol Interactions

```typescript
// Deposit collateral (via WalnutVaultWrapper)
await mockUSDC.approve(walnutVaultWrapperAddress, amount);
await walnutVaultWrapper.shield(account.address, amount);

// Borrow (encrypted amount)
const encryptedAmount = await cofheClient.encrypt(borrowAmount);
await walnutLending.borrow(encryptedAmount);

// Repay specific loan
const encryptedRepayAmount = await cofheClient.encrypt(repayAmount);
await walnutLending.repay(encryptedRepayAmount, loanIndex);

// Withdraw collateral (via WalnutVaultWrapper)
await walnutVaultWrapper.unshield(account.address, account.address, amount);
```


---

## Testing

### Run Contract Tests

```bash
# Compile contracts
npx hardhat compile

# Run all tests
npx hardhat test

# Run specific test suite
npx hardhat test test/unit/contracts/WalnutLending.test.js
npx hardhat test test/integration/wave4-complete-flow.test.js

# Run with gas reporting
REPORT_GAS=true npx hardhat test

# Run with coverage
npx hardhat coverage
```

### Test Coverage

**100+ passing tests** across unit and integration suites spanning multiple security and lifecycle phases.

| Test Category | Coverage |
|---------------|----------|
| **Security Zone Isolation** | Reentrancy locks, calldata manipulation blocks, exploit mitigations |
| **Interest Calculation** | 1 day, 7 days, 30 days, 1 year scenarios |
| **Credit Tier LTV** | All 5 tiers (70%-90% LTV) |
| **Multi-Loan Support** | Concurrent loans, independent repayment |
| **ENS Wallet Aggregation** | EIP-712 linked collateral, solvency-protected unlinking |
| **Vault Wrapper (wUSDC)** | Shielding/unshielding token conversion tracking |
| **Complete User Journey** | Deposit → Borrow → Repay → Withdraw |
| **Access Control** | Owner, CoFHE, and pause mechanisms |
| **Edge Cases** | Zero amounts, insufficient balance, stale prices |

### Frontend Type Checking

```bash
# TypeScript strict mode (zero errors)
npx tsc --noEmit

# Build verification
npm run build
```

---

## Project Structure

```
walnut-protocol/
├── app/                      # Next.js app routes
│   ├── app/                 # Dashboard and protocol pages
│   │   ├── borrow/         # Borrow page
│   │   ├── deposit/        # Deposit page
│   │   ├── ens/            # ENS Wallet Linking
│   │   ├── history/        # Transaction history
│   │   ├── liquidation/    # Liquidation dashboard
│   │   ├── p2p/            # Confidential P2P market
│   │   ├── repay/          # Repay page
│   │   ├── settings/       # Protocol settings
│   │   ├── withdraw/       # Withdraw page
│   │   └── layout.tsx      # App layout
│   ├── api/                # API routes
│   │   └── privara/        # Privara settlement endpoints
│   └── page.tsx            # Landing page
├── components/              # React components
│   ├── dashboard/          # Dashboard-specific components
│   ├── landing/            # Landing page components
│   ├── ui/                 # Reusable UI components
│   └── walnut/             # Protocol-specific components
├── contracts/               # Solidity smart contracts
│   ├── WalnutLendingV2.sol        # Main lending protocol (privacy-hardened)
│   └── common/                    # Tokens, price oracle, and mock contracts
├── Technical-docs/          # Technical Documentation
│   ├── flow.md             # End-to-end data flow
│   ├── 2-deposit.md        # Deposit mechanism
│   └── 4-borrow.md         # Borrowing mechanism
├── PRIVACY_AUDIT.md         # Privacy & Security threat model
├── WALNUT_PROTOCOL_SPEC.md  # Detailed system architecture
├── hooks/                   # React hooks
│   ├── use-privara.ts          # Privara settlement logic
│   ├── use-token-balances.ts   # Balance decryption
│   └── use-walnut-protocol.ts  # Main protocol hook
├── lib/                     # Utilities and configurations
│   ├── cofhe-client.ts     # CoFHE SDK wrapper
│   ├── walnut-contract.ts  # Contract ABIs and config
│   └── web3-config.ts      # wagmi/viem configuration
├── scripts/                 # Deployment scripts
│   └── deploy-arbitrum-sepolia.js
├── test/                    # Contract tests
│   ├── unit/               # Unit tests
│   └── integration/        # Integration tests
├── hardhat.config.ts        # Hardhat configuration
├── package.json             # Dependencies
└── README.md                # This file
```


---

## Technical Deep Dive

### Vault Wrapper Collateral Shielding

To prevent raw ERC20 tracking and preserve privacy at the entry point, Walnut employs a **Vault Wrapper** (`wUSDC`).

```solidity
// User approves Vault Wrapper
MockUSDC.approve(wrapperAddress, amount);

// User calls shield() on the Wrapper
// The wrapper deposits MockUSDC into itself, and mints an encrypted collateral balance in WalnutLendingV2
WalnutVaultWrapper.shield(msg.sender, amount);
```
This guarantees that the main protocol only ever interacts with fully encrypted representations of user balances, acting as a cryptographic firewall.

### FHE Operations in Walnut

Walnut uses CoFHE's FHE library for encrypted computations:

```solidity
// Encrypt plaintext value
euint128 encryptedValue = FHE.asEuint128(plaintextValue);

// Arithmetic operations
euint128 sum = FHE.add(a, b);
euint128 difference = FHE.sub(a, b);
euint128 product = FHE.mul(a, b);
euint128 quotient = FHE.div(a, b);

// Comparison operations
ebool isGreater = FHE.gte(a, b);
ebool isLess = FHE.lte(a, b);
ebool isEqual = FHE.eq(a, b);

// Conditional selection
euint128 result = FHE.select(condition, valueIfTrue, valueIfFalse);

// Permission management
FHE.allowThis(value);           // Grant contract access
FHE.allow(value, userAddress);  // Grant user read access
```

### LTV Enforcement via FHE

Walnut enforces Loan-to-Value ratios using encrypted comparisons:

```solidity
// Get user's credit tier (public)
uint16 ltv = tierLTVs[creditTier[msg.sender]]; // e.g., 8000 = 80%

// Calculate max borrow (encrypted)
euint128 collateralTimesLTV = FHE.mul(_collateral[user], FHE.asEuint128(ltv));
euint128 maxBorrow = FHE.div(collateralTimesLTV, FHE.asEuint128(10000));

// Check if new debt is within limit (encrypted)
euint128 candidateDebt = FHE.add(_debt[user], borrowAmount);
ebool withinLimit = FHE.lte(candidateDebt, maxBorrow);

// Conditional mint (encrypted)
euint128 mintAmount = FHE.select(withinLimit, borrowAmount, FHE.asEuint128(0));
```

**Result**: If the user exceeds their LTV, `mintAmount` becomes 0 (encrypted zero), and no cUSDC is minted. The user never learns why the borrow failed—maintaining privacy.

### Multi-Loan Data Model

```solidity
struct Loan {
    uint128 principal;    // Decrypted principal amount
    uint256 openedAt;     // Borrow timestamp
    bool active;          // Loan status
}

mapping(address => Loan[]) public userLoans;

// User can have multiple concurrent loans
userLoans[alice] = [
    Loan(1000e6, 1704067200, true),   // Loan 0: $1000, active
    Loan(500e6,  1704153600, true),   // Loan 1: $500, active
    Loan(2000e6, 1703980800, false)   // Loan 2: $2000, repaid
];

// Repay specific loan by index
function repay(InEuint128 calldata encryptedAmount, uint256 loanIndex) external {
    Loan storage loan = userLoans[msg.sender][loanIndex];
    // Calculate interest from loan.openedAt
    // Repay and set loan.active = false
}
```

### Interest Calculation

Interest accrues linearly from the borrow timestamp:

```solidity
function calculateInterest(address user, uint256 principal)
    public view
    returns (uint256 totalInterest, uint256 protocolFee, uint256 lenderPayment)
{
    uint256 elapsed = block.timestamp - borrowTimestamp[user];
    
    // Formula: (principal × APR × elapsed × PRECISION) / (SECONDS_PER_YEAR × 10000 × PRECISION)
    totalInterest = (principal * BORROW_APR * elapsed * PRECISION)
        / (SECONDS_PER_YEAR * 10000 * PRECISION);
    
    protocolFee = totalInterest / 4;      // 25% to protocol
    lenderPayment = totalInterest - protocolFee;  // 75% to lenders
}
```

**Constants**:
- `BORROW_APR = 800` (8% annual rate in basis points)
- `PROTOCOL_FEE_APR = 200` (2% annual rate, 25% of total interest)
- `SECONDS_PER_YEAR = 365 days`
- `PRECISION = 1e6` (6 decimals for USD values)

**Example**: Borrow $1000 for 30 days
```
elapsed = 30 days = 2,592,000 seconds
totalInterest = (1000e6 × 800 × 2,592,000 × 1e6) / (31,536,000 × 10000 × 1e6)
              = 6.575e6 = $6.58
protocolFee = $6.58 / 4 = $1.64
lenderPayment = $6.58 - $1.64 = $4.94
```


### Credit Tier System

Users progress through tiers based on encrypted repayment count:

| Tier | Repayments Required | Max LTV | Benefit |
|------|---------------------|---------|---------|
| 0 | 0 | 70% | Starting tier |
| 1 | 3 | 75% | +5% borrowing power |
| 2 | 10 | 80% | +10% borrowing power |
| 3 | 25 | 85% | +15% borrowing power |
| 4 | 50 | 90% | +20% borrowing power |

**Implementation**:
```solidity
// Encrypted repayment count (private)
mapping(address => euint128) private _repaymentCount;

// Public tier (derived from count via client-driven FHE sync)
mapping(address => uint8) public creditTier;

// Tier derivation (in syncCreditCount after decryption)
function _tierFromRepaymentCount(uint128 count) internal pure returns (uint8) {
    if (count >= 50) return 4;
    if (count >= 25) return 3;
    if (count >= 10) return 2;
    if (count >= 3)  return 1;
    return 0;
}
```

**Privacy**: Your repayment count stays encrypted. Only the derived tier is public.

### CoFHE Decryption Flow

Walnut uses CoFHE's automated task manager callback pattern for state syncs:

```
┌─────────────┐
│  Contract   │  1. ITaskManager.addDecrypt(ctHash, callbackSel)
│             │     Queue decryption task on-chain
└──────┬──────┘
       │
       ▼
┌─────────────┐
│CoFHE Network│  2. Decrypt ciphertext off-chain
│             │     (Threshold Network)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Contract   │  3. syncCallback(result)
│             │     CoFHE calls back into contract with plaintext
└─────────────┘
```

**Example**: Loan principal sync after borrow

```solidity
function borrow(InEuint128 calldata encryptedAmount) external {
    // ... FHE operations ...
    euint128 mintAmount = FHE.select(withinLimit, borrowAmount, FHE.asEuint128(0));
    
    // 1. Contract queues decrypt for callback
    ITaskManager(TASK_MANAGER_ADDRESS).addDecrypt(
        mintAmount,
        this.syncBorrowActive.selector
    );
}

// 2 & 3. CoFHE network decrypts and calls back
function syncBorrowActive(uint256 requestId, uint128 result) external onlyCofhe {
    // Update loan principal with verified plaintext
    PendingSync memory pending = _pendingBorrowSyncs[requestId];
    _loans[pending.user][pending.loanIndex].principal = result;
    _loans[pending.user][pending.loanIndex].principalPending = false;
}
```

---

## Security

### Threat Model

**Protected Against**:
- Public visibility of individual positions
- Front-running of liquidation bids (sealed-bid auctions)
- Debt accounting manipulation via calldata
- Unauthorized access to encrypted data
- Oracle price manipulation (staleness checks)

**Not Protected Against**:
- Malicious CoFHE network operators (trust assumption)
- Smart contract bugs (testnet, not audited)
- Compromised private keys (standard Web3 risk)
- Extreme oracle staleness (>1 hour)

### Access Control

| Function | Authorized Caller | Risk Level |
|----------|------------------|------------|
| `pause()` / `unpause()` | Owner only | HIGH |
| `grantAuditorPermit()` | Owner only | HIGH |
| `syncLoanPrincipal()` | Anyone (signature-verified) | LOW — requires valid CoFHE signature |
| `syncLoanRepay()` | Anyone (signature-verified) | LOW — requires valid CoFHE signature |
| `syncCreditTier()` | Anyone (signature-verified) | LOW — requires valid CoFHE signature |
| `setPriceFeed()` | Owner only (Oracle) | HIGH |
| `setMinter()` | Owner only (FHERC20) | CRITICAL |

### Known Limitations

**Testnet Deployment**: This is a testnet deployment for demonstration purposes only.

- **Not Audited**: Contracts have not undergone professional security audit
- **MockUSDC**: Uses mock tokens, not production stablecoins
- **CoFHE Trust**: Relies on CoFHE network for decryption integrity
- **No Timelock**: Owner can change parameters immediately
- **Single Owner**: No multi-sig or governance

**See [Privacy Audit](./PRIVACY_AUDIT.md) for detailed threat model.**


---

## Performance

### Gas costs (Arbitrum Sepolia, approximate)

| Operation | Gas estimate | Notes |
|-----------|-------------|-------|
| Shield & Deposit | ~180,000 | ERC20 transfer + Vault shielding + FHE encrypt |
| Borrow | ~380,000 | FHE arithmetic + cUSDC mint + Callback request |
| Repay | ~320,000 | FHE arithmetic + cUSDC burn + Callback request |
| Unshield (Withdraw) | ~130,000 | ERC20 transfer + FHE state update |

FHE operations are significantly more expensive than standard EVM operations. CoFHE coprocessor offloads compute to an off-chain threshold network — the on-chain footprint is the encrypted handle and the automated callback relay.

### Decryption latency (Arbitrum Sepolia)

- **Client-side View Permits** (Viewing balances): 1–3 seconds via CoFHE SDK.
- **On-chain Callbacks** (Borrow/Repay syncs): 1–3 blocks via `TaskManager`.

---

## Documentation

### Core Documentation
- **[Protocol Specification](./WALNUT_PROTOCOL_SPEC.md)** - System design, data flows, and interactions
- **[Privacy Audit](./PRIVACY_AUDIT.md)** - Threat model and privacy considerations
- **[Technical Docs](./Technical-docs)** - Step-by-step guides for all protocol interactions

### Key Concepts

#### What is Encrypted?
- Your collateral amount (USD value)
- Your debt amount (cUSDC)
- Your health factor
- Your cUSDC balance
- Your repayment count

#### What is Public?
- Aggregate protocol metrics (total supplied, total borrowed)
- Your wallet address
- Your credit tier (0-4)
- Transaction hashes and timestamps
- Which tokens you've deposited (but not amounts)

---

## Deployment

### Deploy to Arbitrum Sepolia

```bash
# Full deployment (all contracts)
npx hardhat run scripts/deploy/deploy.js --network arbitrumSepolia

# Verify contracts on Arbiscan
npx hardhat verify --network arbitrumSepolia <CONTRACT_ADDRESS> [CONSTRUCTOR_ARGS]

# Example: Verify WalnutLendingV2
npx hardhat verify --network arbitrumSepolia \
  0x22715b184B040c65d1aFb15595B533f2BD94bCfa \
  <MockUSDC_Address> \
  <PriceOracle_Address> \
  <FHERC20_Address>

# Mint test USDC
npx hardhat run scripts/mint-mock-usdc.js --network arbitrumSepolia
```

### Deployment Order

1. **MockUSDC** (ERC20 token)
2. **MockUSDCPriceFeed** (Chainlink-compatible)
3. **WalnutPriceOracle**
4. **WalnutFHERC20** (cUSDC)
5. **WalnutLendingV2**
6. **WalnutVaultWrapper** (wUSDC)
7. **Configuration**:
   - `WalnutFHERC20.setMinter(WalnutLendingV2)`
   - `WalnutPriceOracle.setPriceFeed(MockUSDC, MockUSDCPriceFeed)`


---

## Walnut Beyond the Buildathon

Walnut started as a protocol experiment. **It is becoming infrastructure.**

The confidential DeFi lending market does not exist yet. Walnut is the earliest production-grade attempt to build it on FHE. What follows is the roadmap to turn that head start into a durable protocol.

---

### Roadmap

#### **Phase 1 — Mainnet Launch**
- Deploy on Arbitrum One with real USDC after independent security audit
- Replace MockUSDC with Circle's production contract (address swap, zero code changes)
- Switch to Chainlink mainnet price feeds
- Multisig ownership for all admin functions
- Bug bounty program

#### **Phase 2 — Token Expansion**
- Add WBTC, WETH, DAI, USDT as supported collateral
- Integrate additional Chainlink feeds as they become available on mainnet
- Tiered collateral factors per token (ETH: 80% LTV, BTC: 75%, stablecoins: 90%)
- Isolated lending markets per collateral type

#### **Phase 3 — Multichain**
- Deploy on Base, Optimism, and Polygon as CoFHE coprocessor expands
- Unified position management across chains
- Cross-chain collateral bridging (encrypted balances portable across deployments)

#### **Phase 4 — Lender Yield and Protocol Economics**
- Lender deposit pools go live — suppliers earn 6% base APY (currently only borrow side exists)
- Liquidity mining: early depositors earn protocol fee share for bootstrapping TVL
- Referral system: users who bring verified borrowers earn a cut of their interest — on-chain, privately tracked via encrypted counters
- Sealed yield distribution: lender earnings settled privately via Privara, same as borrower interest today
- Protocol treasury accumulates 2% spread between borrow APR (8%) and supply APY (6%)

#### **Phase 5 — Institutional Rails** 
- Permissioned pools for institutional depositors with KYC gating
- Auditor permits for compliance teams (pool solvency visible, individual positions never)
- Private credit lines for DAOs and protocols
- Whitelist-based under-collateralized lending for verified institutional borrowers

#### **Phase 6 — Full Privacy Stack** 
- Client-side amount encryption for true collateral confidentiality (removes trivial encryption constraint)
- Private liquidation notifications — borrowers receive encrypted alerts before health factor breach
- Zero-knowledge identity layer for credit scoring without wallet linking

---



## Acknowledgments

Walnut Protocol is built on the shoulders of giants:

### Core Technologies
- **[CoFHE](https://fhenix.io/)** - Fully Homomorphic Encryption infrastructure
- **[Arbitrum](https://arbitrum.io/)** - Scalable Layer 2 execution
- **[Chainlink](https://chain.link/)** - Decentralized price feeds
- **[Privara](https://privara.io/)** - Private settlement coordination

### Open Source Libraries
- **[OpenZeppelin](https://openzeppelin.com/)** - Security primitives
- **[Hardhat](https://hardhat.org/)** - Development framework
- **[wagmi](https://wagmi.sh/)** - React hooks for Ethereum
- **[viem](https://viem.sh/)** - TypeScript Ethereum library
- **[Next.js](https://nextjs.org/)** - React framework
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS

### Inspiration
- **[Aave](https://aave.com/)** - Lending protocol design patterns
- **[Compound](https://compound.finance/)** - Interest rate models
- **[Aztec](https://aztec.network/)** - Privacy-preserving DeFi

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.


## Disclaimer

**IMPORTANT: READ CAREFULLY**

Walnut Protocol is **experimental software** deployed on **Arbitrum Sepolia testnet** for demonstration and testing purposes only.

### Key Points

1. **Testnet Only**: This deployment uses mock tokens and is NOT intended for production use
2. **No Audit**: Contracts have not undergone professional security audit
3. **Use at Your Own Risk**: No warranties or guarantees of any kind
4. **Not Financial Advice**: Nothing in this documentation constitutes financial, investment, legal, or tax advice
5. **No Real Funds**: Do not use real funds with this testnet deployment

### Risks

- Smart contract bugs or vulnerabilities
- CoFHE network failures or compromises
- Oracle price manipulation or staleness
- Loss of testnet funds (no real value)
- Unexpected protocol behavior

### Legal

This software is provided "AS IS" without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and noninfringement.

In no event shall the authors or copyright holders be liable for any claim, damages, or other liability, whether in an action of contract, tort, or otherwise, arising from, out of, or in connection with the software or the use or other dealings in the software.

---

<div align="center">

## Built with Privacy. Powered by FHE.

**Walnut Protocol** • Confidential Lending for Everyone

[Get Started](https://walnut-finance.vercel.app/) • [Read Docs](./Technical-docs) • [View Contracts](https://sepolia.arbiscan.io/address/0xdF921cF29Aae0fBf524139a4cae9289478893fDf)

---

Built by Jayant • Arbitrum Sepolia • Fhenix CoFHE

*Deposit USDC. Borrow cUSDC. Nobody sees how much.*

</div>
