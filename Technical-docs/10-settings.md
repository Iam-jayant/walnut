# Settings, Key Management & Privacy Controls — Technical Documentation

## Overview

The Settings page (`app/app/settings/page.tsx`) provides user interface controls for managing cryptographic Access Key permits, inspecting RPC network health, monitoring connected wallet state, and managing multi-wallet ENS identity links. It serves as the primary dashboard for client-side security and privacy administration in Walnut Protocol.

---

## How It Works Under the Hood

### 1. Access Key & Permit Lifecycle Management
The CoFHE Permit system is managed via `WalnutPermitProvider` (`components/walnut/permit-provider.tsx`) wrapping the CoFHE SDK (`@cofhe/sdk`):

- **Permit Inspection:** Displays active permit hash, issuer address, signature timestamp, and validity status.
- **Permit Revocation & Clearance:** When the user clicks "Revoke Permit", the frontend purges the cached hash from browser storage (`localStorage.removeItem('walnut_cofhe_permit_hash')`) and calls `cofheClient.permits.removePermit()`.
- **Permit Regeneration:** Clears state and triggers immediate EIP-712 re-authentication via `requestPermitCreation()`, forcing a clean cryptographic key refresh.

### 2. Network Diagnostics & Multi-RPC Fallback
Because FHE operations rely on heavy cryptographic computation and CoFHE coprocessor interaction, standard RPC providers may experience latency or rate limits.

The Settings interface monitors RPC connection health across three fallback endpoints configured in `lib/web3-config.ts`:
1. `NEXT_PUBLIC_RPC_URL_PRIMARY`
2. `NEXT_PUBLIC_RPC_URL_FALLBACK_1`
3. `NEXT_PUBLIC_RPC_URL_FALLBACK_2`

The app uses `viem` fallback transports with 10-second request timeouts to ensure continuous availability.

### 3. Multi-Wallet Identity Management
The Settings panel allows users to inspect primary and secondary wallet relationships:
- Displays `primaryWalletOf[msg.sender]` and list of `linkedWallets[msg.sender]`.
- Provides UI action buttons to initiate `linkWallet` EIP-712 signatures or invoke `requestUnlink` health factor checks.

---

## Technical Highlights & Under-the-Hood Points

- **Local Session Hygiene:** Permits are stored locally per wallet address. Switching Web3 wallets automatically resets the active permit context to prevent cross-account key leaks.
- **RPC Telemetry Monitoring:** Real-time ping testing monitors block synchronization, gas price buffering (+50% buffer on `maxFeePerGas` for FHE ops), and CoFHE task manager availability.
- **Privacy Audit Panel:** Users can inspect active contract allowances and verify that zero unencrypted telemetry or tracking scripts are loaded.

---

## Smart Contract & SDK Contribution

| Component | Module | Technical Role |
|-----------|--------|----------------|
| `WalnutPermitProvider` | `components/walnut/permit-provider.tsx` | Manages permit lifecycle, local storage caching, and revocation triggers. |
| `@cofhe/sdk` | `cofheClient.permits` | Handles EIP-712 permit creation, signature validation, and KMS key storage. |
| `web3-config.ts` | `viem` / `wagmi` | Configures RPC fallback strategy for Arbitrum Sepolia (`421614`). |
| `WalnutLendingV2.sol` | `primaryWalletOf`, `linkedWallets` | Reads multi-wallet identity linking mappings on-chain. |
