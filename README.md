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

## Current scope (Wave 1)

Implemented app routes:

- /
- /app
- /app/onboard
- /app/deposit
- /app/borrow
- /app/repay (UI scaffold)
- /app/demo
- /app/settings

Implemented protocol interactions:

- deposit(InEuint128)
- borrow(InEuint128)
- encrypted collateral/debt reads + local decrypt

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
- RPC_URL (deploy-only RPC)
- NEXT_PUBLIC_WALNUT_CHAIN_ID
- NEXT_PUBLIC_WALNUT_RPC_URL
- NEXT_PUBLIC_WALNUT_CONTRACT_ADDRESS
- NEXT_PUBLIC_SEPOLIA_RPC_URL

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

### 5) Deploy contract to Sepolia

```bash
npm run deploy:sepolia
```

## Demo flow

1. Connect wallet.
2. Complete onboarding at /app/onboard.
3. Submit encrypted collateral at /app/deposit.
4. Submit encrypted borrow request at /app/borrow.
5. Verify encrypted and decrypted views at /app/demo.

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
