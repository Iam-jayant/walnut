# Walnut Wave 1 Frontend

Walnut is a privacy-first lending prototype built with Next.js, Wagmi, and Cofhe.
This repository contains the Wave 1 UI plus encrypted `deposit` and `borrow` contract interactions.

## What Is Implemented

- Landing experience at `/`
- App shell and pages:
  - `/app` dashboard
  - `/app/onboard`
  - `/app/deposit`
  - `/app/borrow`
  - `/app/repay` (Wave 1 skeleton)
  - `/app/demo`
  - `/app/settings`
- Cofhe + Wagmi providers wired in root layout
- Contract integration for:
  - `deposit(InEuint128)`
  - `borrow(InEuint128)`
  - encrypted collateral/debt reads + client-side decrypt

## Environment Variables

Create `.env.local` from `.env.example`.

```bash
cp .env.example .env.local
```

Required values:

- `NEXT_PUBLIC_WALNUT_CHAIN_ID` (default `31337`)
- `NEXT_PUBLIC_WALNUT_RPC_URL` (default `http://127.0.0.1:8545`)
- `NEXT_PUBLIC_WALNUT_CONTRACT_ADDRESS` (required for txs)
- `NEXT_PUBLIC_SEPOLIA_RPC_URL` (required when using Sepolia chain)

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Wave 1 Demo Flow

1. Connect wallet.
2. Complete onboarding at `/app/onboard`.
3. Deposit encrypted amount at `/app/deposit`.
4. Borrow encrypted amount at `/app/borrow`.
5. Verify ciphertext and decrypted local values in `/app/demo`.

## Notes

- `repay` is intentionally scaffolded in Wave 1 UI and will be wired to on-chain logic in the core lending wave.
- This repo currently focuses on frontend + contract interaction scaffolding, not full production lending mechanics.
