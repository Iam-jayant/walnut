# Fully Homomorphic Encryption (FHE) on Walnut Protocol

Walnut is a state-of-the-art, privacy-preserving lending protocol built on **Fhenix**. It utilizes **Fully Homomorphic Encryption (FHE)** to enable confidential borrowing, encrypted collateral ratios, and private peer-to-peer interest matching without exposing sensitive user financial telemetry to the public ledger.

---

## 1. How Walnut Utilizes FHE: The Step-by-Step Flow

Walnut's FHE flow ensures that sensitive data (such as outstanding debt, collateral balances, and P2P loan terms) is encrypted at rest, encrypted during computation, and only decrypted for authorized owners.

### The Cryptographic Lifecycle:
```
   [ User Browser ]                  [ Fhenix EVM ]                 [ Secure Enclave ]
  Plaintext Loan Terms
         │ (Encrypt)
         ▼
    Ciphertext ───────────────► Stores in Smart Contract
  (Encrypted euint)                 (e.g., euint256)
                                     │
                                     ├─► Computes interest: FHE.add()
                                     ├─► Checks safety: FHE.lte()
                                     │
                                     ▼
 Dashboard Decrypt Request ◄── Sign Viewing Permit ◄────────────── User Signs Permit
         │
         ▼
Enclave decrypts FHE value ──► Returns plaintext to authorized owner screen
```

### 1. Client-Side Encryption
* **Local Security**: When a user inputs terms (like borrowing an amount or posting a P2P offer), the Fhenix client-side SDK encrypts the numbers locally in the user's browser before the transaction is broadcast to the network.
* **Ciphertext Generation**: Plaintext numbers are converted into secure cryptographic ciphertexts (represented as `bytes` on-chain). No unencrypted financial details ever leave the user's device.

### 2. Confidential On-Chain Storage
* **Encrypted State Variables**: The Walnut smart contracts store the encrypted parameters as FHE-native types (such as `euint32` or `euint64` for numbers, and `ebool` for flags) on the Fhenix EVM.
* **Public Shielding**: To external observers on block explorers, all balances and contract positions appear as randomized, unintelligible cryptographic strings.

### 3. Encrypted On-Chain Computation
* **Homomorphic Processing**: When interest accrues or a borrower requests a loan, the contract performs mathematical operations (like addition, subtraction, or comparisons) directly on the encrypted ciphertexts using Fhenix FHE libraries (e.g. `FHE.add()`, `FHE.sub()`, `FHE.lte()`).
* **Zero Plaintext Leakage**: The blockchain validators execute these calculations and update the on-chain state without ever decrypting the numbers or knowing their real values.

### 4. Permitted Decryption & Viewing
* **Viewing Permits**: To render the correct balances on the frontend dashboard, the user signs a local signature called a **Permit** (using their wallet).
* **Authorized Decryption**: This permit is sent along with a view request. The FHE decryption enclaves verify the signature and return the decrypted plaintext values **only** to the authorized wallet owner's browser session.

---

## 2. In Brief: The Core Flow Points

* ── **Encrypt Locally**: Plaintext inputs (sizes, APRs, collateral) are encrypted in the browser into secure ciphertexts.
* ── **Store Privately**: The smart contracts store positions as encrypted data types (`euint`), keeping them fully hidden on-chain.
* ── **Compute Blindly**: Interest accruals and LTV limits are computed homomorphically using `FHE.add` and `FHE.lte` without ever exposing the numbers.
* ── **Reveal Selectively**: Users sign viewing permits locally to securely decrypt and view their own private balances on the dashboard.

---

## 3. Why Fhenix Matters (And Why There Are No Other Options)

Traditional public blockchains (like Ethereum, Arbitrum, or Solana) are entirely transparent. If you try to run private lending, credit scoring, or peer-to-peer negotiations there, any competitor can inspect the public ledger to frontrun your trades or reverse-engineer your yields. 

**Fhenix is the only viable solution because of three critical architectural advantages:**

### 1. EVM-Native Cryptography (Writing Standard Solidity)
Fhenix integrates FHE libraries directly into the EVM. Developers can write standard, readable Solidity code utilizing FHE functions. 
* **The Alternative**: Other privacy options (like custom zero-knowledge networks) force developers to write complex circuits in specialized, non-EVM languages (like Rust/Noir/Leo), fracturing developer ecosystems and composability.

### 2. High-Performance Multi-Party Computations
FHE allows the network to add, subtract, and compare numbers belonging to different users (e.g., adding a lender's liquidity to a borrower's pool, or verifying LTV ratios against dynamic oracle feeds) on the fly.
* **Why ZKPs Fail Here**: Zero-Knowledge Proofs (ZKPs) are excellent for proving a private statement (e.g., "I own enough collateral to borrow"). However, ZKPs cannot dynamically perform state-changing mathematical computations on-chain between multiple untrusted parties. ZKPs are "one-way" proofs, whereas FHE is a "two-way" programmable computing canvas.

### 3. Decoupling Privacy From Hardened Hardware
Fhenix combines Fully Homomorphic Encryption with secure enclaves to deliver cryptographic absolute security.
* **Why Pure TEEs Fail**: Trusted Execution Environments (TEEs) like Intel SGX are fast but rely entirely on physical hardware security. Historically, pure TEE networks have suffered from physical side-channel vulnerability leaks (like Spectre or Meltdown). Fhenix uses FHE to ensure that even if the hardware is compromised, the data remains mathematically encrypted and secure.
