<div align="center">

# Walnut - Private Lending, Finally

### Privacy-first lending on Fhenix using Fully Homomorphic Encryption (FHE)

[![Next.js](https://img.shields.io/badge/Next.js-16.2.1-111111?style=for-the-badge)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-18.3.1-149ECA?style=for-the-badge)](https://react.dev)
[![Fhenix CoFHE](https://img.shields.io/badge/Fhenix-CoFHE-1A7F64?style=for-the-badge)](https://docs.fhenix.zone)
[![Privacy by Design](https://img.shields.io/badge/DeFi-Privacy%20by%20Design-3E4CFF?style=for-the-badge)](#vision)

</div>

## What exactly is this project?

Walnut is a privacy-first lending protocol prototype built on Fhenix.

It lets users borrow, lend, and manage positions **without exposing sensitive financial values on-chain**.

In traditional DeFi, collateral, debt, and risk posture are public by default. Walnut changes this by encrypting user financial state end-to-end and only allowing decryption through user permits.

This repository contains:

- A Next.js app (landing + app experience)
- Encrypted deposit and borrow flows
- CoFHE-powered encrypted reads and writes
- Client-side permit-based decryption for user-visible balances

## The problem

DeFi is fully transparent today. That creates real issues:

- Liquidation sniping by bots
- Exposure of user and strategy behavior
- Low institutional comfort with public-by-default state
- No practical way for users to manage positions privately

There is no mainstream way to use DeFi while keeping your full financial state private.

## The solution

Walnut introduces confidential lending using Fully Homomorphic Encryption.

Instead of storing plaintext values on-chain:

- Sensitive values are encrypted in the browser
- Contracts store only encrypted state
- Computation is performed directly on encrypted values
- Users decrypt locally with permit-based access

Result:

- The chain never sees raw collateral or debt values
- Users keep control over who can decrypt their data

## How it works

Walnut uses the Fhenix CoFHE stack for encrypted state + computation.

### Core flow

input -> encrypt -> contract -> store -> fetch -> decrypt -> display

### Step-by-step

1. User enters a deposit or borrow value.
2. Frontend encrypts that value before transaction submission.
3. Contract receives encrypted input and updates encrypted state.
4. Frontend fetches encrypted state from chain.
5. User decrypts locally using permit-based access.
6. UI shows decrypted values only to the authorized user.

## Key features

- Encrypted balances and debt on-chain
- Permit-based decryption with user-controlled visibility
- Private deposit and borrow flows
- Real-time encrypted-state handling in frontend
- Clean UX for encrypted -> decrypted transitions

## Tech stack

- Fhenix CoFHE
- Solidity (encrypted types and FHE ops)
- Next.js 16
- @cofhe/sdk
- @cofhe/react
- Wagmi
- Viem / EVM tooling

## What makes Walnut different

Walnut is not just UI obfuscation.

It changes the protocol internals:

- State is encrypted at the protocol level
- Computation is executed over encrypted data
- Decryption is permissioned, not globally public

Even direct contract storage inspection does not reveal meaningful financial values.

## Current scope

### Wave 1 (Complete)

Implemented app routes:

- /
- /app
- /app/deposit
- /app/borrow
- /app/repay (UI scaffold)
- /app/withdraw
- /app/settings

Implemented protocol interactions:

- deposit(InEuint128)
- borrow(InEuint128)
- encrypted collateral/debt reads + local decrypt

### Wave 2 (Complete)

Wave 2 completes the confidential lending cycle with encrypted repayment, withdrawal, health factor monitoring, and async decrypt liquidation checks.

**New Contract Functions:**
- `repay(InEuint128)` - Encrypted debt repayment with clamping to zero
- `withdraw(InEuint128)` - Encrypted collateral withdrawal (respects available balance)
- `getHealthFactor(address)` - Returns encrypted health factor (collateral/debt ratio scaled by 10000)
- `requestLiquidationCheck(address)` - Initiates async decrypt for liquidation status
- `submitLiquidationCheck(bytes32, uint128, bytes)` - Verifies and processes liquidation check results
- `liquidatable(address)` - Public boolean indicating liquidation eligibility

**New Features:**
- **80% LTV Enforcement**: On-chain encrypted validation prevents borrowing beyond 80% of collateral
- **Health Factor Monitoring**: Color-coded dashboard display (green ≥1.5, amber 1.05-1.5, red <1.05)
- **Liquidation Checks**: Uses new CoFHE tx-side decrypt lifecycle with off-chain decryption and on-chain verification
- **Private Interest Settlement**: Integrates Privara SDK for confidential interest payments
- **Withdraw Flow**: Complete UI for withdrawing available collateral (collateral - debt)

**Updated App Routes:**
- /app/repay - Wired to contract with two-step settlement (principal + interest)
- /app/withdraw - New page for collateral withdrawal
- /app/borrow - Enhanced with LTV calculation and health factor preview
- /app - Dashboard now displays health factor card and liquidation status badge

**Technical Improvements:**
- Migrated to new CoFHE decrypt flow (deprecated fhenixjs patterns removed)
- Uses `FHE.allowGlobal()` + `FHE.verifyDecryptResult()` for publish-on-chain decryption
- Deployed to Ethereum Sepolia (Chain ID: 11155111)
- TypeScript build errors resolved

## Local setup

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Create `.env.local` from `.env.example`.

```bash
cp .env.example .env.local
```

Required variables:

- PRIVATE_KEY (deploy only, never expose in frontend or public env)
- RPC_URL (deploy-only RPC, defaults to https://ethereum-sepolia-rpc.publicnode.com)
- NEXT_PUBLIC_WALNUT_CHAIN_ID (defaults to 11155111 for Ethereum Sepolia)
- NEXT_PUBLIC_WALNUT_RPC_URL (optional, for local development)
- NEXT_PUBLIC_WALNUT_CONTRACT_ADDRESS (Wave 1 contract address)
- NEXT_PUBLIC_WALNUT_WAVE2_CONTRACT_ADDRESS (Wave 2 contract address)
- NEXT_PUBLIC_SEPOLIA_RPC_URL (Sepolia RPC URL for frontend)

### 3) Start the app

```bash
npm run dev
```

Open: http://localhost:3000

### 4) Production build

```bash
npm run build
npm start
```

### 5) Deploy contracts to Sepolia

**Deploy Wave 1 contract:**
```bash
npm run deploy:sepolia
```

**Deploy Wave 2 contract:**
```bash
npm run deploy:wave2:sepolia
```

After deployment, the contract address will be automatically added to your `.env` file.

## Demo flow

### Wave 1 Flow
1. Connect wallet.
2. Enable private access from the dashboard setup card.
3. Submit encrypted collateral at /app/deposit.
4. Submit encrypted borrow request at /app/borrow.

### Wave 2 Flow (Complete Lending Cycle)
1. Connect wallet and enable private access (permit creation).
2. Deposit encrypted collateral at /app/deposit.
3. Borrow against collateral at /app/borrow (respects 80% LTV limit).
4. Monitor health factor on dashboard (decrypt to view exact ratio).
5. Repay debt at /app/repay (two-step: principal on-chain + interest via Privara).
6. Withdraw available collateral at /app/withdraw (collateral - debt).
7. Check liquidation status if health factor drops below 1.05.

## Architecture

### Async Decrypt Liquidation Check Pattern

Wave 2 implements the new CoFHE tx-side decrypt lifecycle for liquidation checks:

1. **Request**: Contract calls `requestLiquidationCheck(user)` which computes encrypted health factor and calls `FHE.allowGlobal()` to grant public decryption permission
2. **Off-chain Decrypt**: Liquidator bot calls `client.decryptForTx(ctHash)` to decrypt health factor with Threshold Network signature
3. **Submit Result**: Bot calls `submitLiquidationCheck(ctHash, plaintext, signature)` with decrypted value and proof
4. **Verify**: Contract uses `FHE.verifyDecryptResult()` to verify Threshold Network signature
5. **Update State**: If health factor < 10500 (1.05), contract sets `liquidatable[user] = true`

This pattern ensures:
- Health factors remain encrypted on-chain
- Decryption is cryptographically verified
- No trusted oracle required
- Plaintext values exist only in callback execution context

### Private Interest Settlement with Privara

Repayment uses a two-step flow:
1. **Principal Repayment**: Encrypted amount submitted to WalnutWave2 contract on-chain
2. **Interest Settlement**: Private stablecoin transfer via Privara SDK (off-chain, confidential)

This separates principal (encrypted on-chain) from interest (private off-chain), maintaining privacy for both components.

## Current limitations

This is an early Walnut version with intentional simplifications:

- Lending logic is minimal (basic borrow constraints)
- Metadata like addresses and transaction timing can still leak behavior
- Full-stack privacy (including metadata privacy) remains an active research area

These are known tradeoffs while validating encrypted DeFi primitives.

## Vision

Walnut pushes DeFi from:

transparent-by-default -> private-by-design

Long-term direction:

- Better financial privacy for retail users
- Institutional participation in on-chain credit markets
- New classes of privacy-native financial protocols
