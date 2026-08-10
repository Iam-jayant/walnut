# Creating Access Key — Technical Documentation

## Overview

In Walnut Protocol, the **Access Key** represents a client-side cryptographic permit (the CoFHE Permit) powered by Fully Homomorphic Encryption (FHE) infrastructure and EIP-712 off-chain signatures. Unlike conventional transparent Web3 applications where public smart contract state getters (such as `balanceOf` or `userDebt`) return unencrypted numbers to any caller, Walnut stores all sensitive user variables—collateral, debt, repayment counts, and credit scores—as encrypted handles (`euint128` ciphertexts).

The Access Key grants the wallet owner permissioned threshold decryption rights over their own encrypted state without revealing plaintext values to the public blockchain, RPC nodes, or external observers.

---

## How It Works Under the Hood

### 1. The FHE Privacy Boundary & Access Control Lists (ACL)
On-chain contracts written with Fhenix FHE library (`@fhenixprotocol/cofhe-contracts`) maintain encrypted state variables. When a user deposits, borrows, or repays, the smart contract updates these variables in ciphertext form and explicitly grants access permissions using FHE ACL primitives:

```solidity
// Contract grants decryption permission to the specific user address
FHE.allow(newCollateral, user);
```

While the smart contract marks `user` as an authorized recipient of the ciphertext, the public blockchain RPC endpoints only serve raw 256-bit ciphertext hashes (`ctHash`). To turn a `ctHash` into a readable human number on the frontend, the client must present proof of ownership over the target wallet address.

### 2. Client-Side EIP-712 Permit Generation
Rather than requiring expensive on-chain gas transactions to authorize views, Walnut uses off-chain EIP-712 typed data signatures managed via `@cofhe/sdk` and `@cofhe/react`.

- **User Action:** The user clicks "Create Access Key" or connects their Web3 wallet.
- **Provider Hook:** `WalnutPermitProvider` (`components/walnut/permit-provider.tsx`) intercepts the request and invokes `cofheClient.permits.getOrCreateSelfPermit(chainId, address)`.
- **EIP-712 Signature:** The user's wallet prompts an off-chain signature containing the domain separator, target chain ID (`421614` for Arbitrum Sepolia), permit issuer address, and expiration timestamp.
- **Zero Gas Cost:** Because EIP-712 signatures are signed off-chain via `eth_signTypedData_v4`, generating or restoring an Access Key requires zero ETH gas fees.

### 3. Threshold Decryption via CoFHE Coprocessor
When the frontend needs to display decrypted collateral or debt values (e.g. on the Dashboard or Repay page):

1. **Fetch Ciphertext Handle:** Frontend reads the raw `ctHash` from `WalnutLendingV2.sol` via `getEncryptedCollateral(address)` or `getEncryptedDebt(address)`.
2. **Execute Decrypt Request:**
   ```typescript
   cofheClient.decryptForView(ctHash, FheTypes.Uint128)
     .setChainId(421614)
     .setAccount(address)
     .withPermit(permitHash)
     .execute();
   ```
3. **KMS Signature Verification:** The request is relayed to the Fhenix CoFHE Key Management System (KMS) nodes. The KMS verifies:
   - The EIP-712 signature matches the requester's wallet address.
   - The contract state has an active `FHE.allow(ctHash, user)` entry.
4. **Decrypted Payload Delivery:** Upon successful verification, CoFHE threshold nodes compute the decryption in a secure environment and return the plaintext `bigint` directly over encrypted TLS to the user's browser.

---

## Technical Highlights & Under-the-Hood Points

- **Cryptographic Independence:** The Access Key signature never exposes private keys. It is scoped strictly to viewing encrypted states bound to the Walnut contract address on Arbitrum Sepolia.
- **Local Cache Persistence:** Once generated, the permit hash is cached locally in browser storage (`walnut_cofhe_permit_hash`). The UI automatically restores session access across page refreshes.
- **Seamless Revocation:** Users can invalidate or regenerate their Access Key at any time from the Settings tab, forcing the CoFHE SDK to purge cached permits and request a fresh signature.
- **Zero Plaintext Leakage:** Neither the RPC provider, the block explorer (Arbiscan), nor rival liquidators can intercept or reconstruct the plaintext value during the decryption request.

---

## Smart Contract Contribution

| Contract / Layer | Key Function / Primitive | Technical Contribution |
|------------------|--------------------------|------------------------|
| `WalnutLendingV2.sol` | `FHE.allow(ciphertext, user)` | Registers the user's wallet address in the FHE Access Control List for the specific ciphertext. |
| `WalnutLendingV2.sol` | `getEncryptedCollateral()`, `getEncryptedDebt()` | Exposes raw `ctHash` handles to the frontend without revealing plaintext data. |
| `@cofhe/sdk` | `permits.getOrCreateSelfPermit()` | Generates and manages the EIP-712 permit payload client-side. |
| CoFHE KMS Coprocessor | `verifyPermitAndDecrypt()` | Validates signature against on-chain ACL and returns threshold-decrypted integer to client. |
