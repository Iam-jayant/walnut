# Understanding Fully Homomorphic Encryption (FHE) in Walnut

## What is Fully Homomorphic Encryption?

Fully Homomorphic Encryption (FHE) allows computations to be performed directly on encrypted data without ever decrypting it. Think of it like a locked box with special gloves that let you manipulate the contents without opening the box. The result stays encrypted until you choose to unlock it with your private key.

In Walnut Protocol, this means your collateral amounts, debt positions, and health factors remain encrypted on-chain. The smart contract can still perform calculations—checking if you're eligible to borrow, calculating interest, or determining liquidation risk—all while your actual numbers stay private.

## FHE vs Zero-Knowledge Proofs: What's the Difference?

While both FHE and Zero-Knowledge (ZK) proofs provide privacy, they solve fundamentally different problems:

**Zero-Knowledge Proofs** let you prove a statement is true without revealing why it's true. For example, you can prove you're over 18 without showing your birthdate. ZK is perfect for verification and validation, but it doesn't hide the data itself during computation.

**Fully Homomorphic Encryption** keeps data encrypted throughout the entire computation process. The blockchain never sees your actual numbers—it only works with encrypted values. This is crucial for applications where the data itself must remain confidential, not just the proof of its validity.

## Why Sealed-Bid Liquidation Requires FHE (Not ZK)

Walnut's future sealed-bid liquidation system demonstrates why FHE is essential:

In a sealed-bid auction, liquidators submit encrypted bids without knowing what others have bid. The smart contract must compare these encrypted bids to find the highest one—all without decrypting any bid until the winner is selected. This prevents bid sniping and front-running.

ZK proofs can't solve this problem because they're designed for verification, not computation on hidden data. You'd need to decrypt the bids to compare them, which defeats the purpose of a sealed auction. FHE allows the contract to perform the comparison directly on encrypted bids, preserving confidentiality throughout the entire auction process.

## Why Credit Scoring Requires FHE

Walnut's credit tier system tracks your repayment history to unlock better loan terms. With FHE, your complete borrowing history—every loan amount, repayment, and default—stays encrypted on-chain. The protocol can still calculate your credit score and determine your tier without exposing your financial history to the public blockchain.

This is impossible with ZK proofs alone. While ZK could prove "this user has a credit score above 700," it can't maintain an encrypted, updateable credit history that the protocol can compute on over time. FHE enables the protocol to continuously update your encrypted credit profile as you interact with the system.

## What Stays Encrypted vs What's Public

**Encrypted (Private to You):**
- Your collateral amount in USD
- Your debt amount in cUSDC
- Your health factor
- Your cUSDC balance
- Your credit score and repayment history
- Liquidation bids (in sealed-bid auctions)

**Public (Visible to Everyone):**
- Aggregate protocol metrics (total supplied, total borrowed)
- Your wallet address
- Your credit tier (0-4)
- Transaction hashes and timestamps
- Which tokens you've deposited (but not how much)
- Whether you have an active loan (but not the amount)

This design gives you privacy where it matters—your financial position—while keeping the protocol transparent and auditable through aggregate metrics.

## How FHE Works in Walnut

When you interact with Walnut:

1. **Encryption**: Your browser encrypts your input (e.g., deposit amount) using the CoFHE network's public key
2. **On-Chain Computation**: The smart contract performs calculations on your encrypted data
3. **Permission-Based Decryption**: Only you can decrypt your data by creating a permit that grants your wallet read access
4. **Client-Driven Decryption Sync**: When the protocol needs a decrypted value (like for interest settlement or principal updates), the client requests decryption off-chain and submits the enclave-signed result back to the contract, which verifies it using `verifyDecryptResultSafe`

This architecture ensures your sensitive financial data never appears in plaintext on the blockchain, while still enabling a fully functional lending protocol.

## The Future: Sealed-Bid Liquidations and Credit Scoring

Walnut is built for a future where:

- **Liquidators compete in sealed-bid auctions**, preventing front-running and ensuring fair market prices
- **Credit scores unlock better terms**, with your complete history encrypted on-chain
- **Privacy-preserving DeFi** becomes the standard, not the exception

FHE makes this future possible by enabling computation on encrypted data—something no other cryptographic primitive can achieve.
