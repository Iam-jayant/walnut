# Getting Started with Walnut Protocol

Welcome to Walnut Protocol documentation! This guide will help you understand and integrate with our confidential lending protocol.

## What is Walnut?

Walnut is a confidential lending protocol built with Fully Homomorphic Encryption (FHE). Users deposit collateral and borrow an encrypted stablecoin while their position data remains encrypted on-chain.

## Quick Links

- **Live App**: [walnut-protocol.vercel.app](https://walnut-protocol.vercel.app)
- **GitHub**: [github.com/Iam-jayant/walnut](https://github.com/Iam-jayant/walnut)
- **Network**: Arbitrum Sepolia (Chain ID: 421614)

## Key Features

- **Encrypted Positions**: Collateral, debt, and health factors stored as encrypted `euint128` values
- **Multi-Loan Support**: Users can have multiple concurrent loans
- **Credit Tier System**: Encrypted repayment history unlocks better LTV ratios (70% → 90%)
- **Permit-Based Decryption**: Users sign permits to decrypt their own data

## Documentation Structure

### Core Concepts
- **FHE Explainer**: Understanding Fully Homomorphic Encryption
- **Architecture**: System design and data flows
- **Security**: Threat model and security considerations

### Reference
- **Smart Contracts**: Complete contract specifications
- **User Guide**: Step-by-step usage instructions

## Contract Addresses

**Network**: Arbitrum Sepolia (Chain ID: 421614)

| Contract | Address |
|----------|---------|
| WalnutLending | `0xA99C28678ca4C19741995B0874155e6abAad76CA` |
| WalnutFHERC20 (cUSDC) | `0x7974E997e4cF45b37Ff2fA4472ea39BB2eAD4343` |
| WalnutPriceOracle | `0xFaB46543812Fc34b080b668f62864e46064D9ba1` |
| MockUSDC | `0x813Dd4Ffa32728a2d1A9e8f91714E06d062C66Dd` |

## Next Steps

1. Read the **FHE Explainer** to understand the cryptographic foundation
2. Review the **Architecture** to see how the system works
3. Check the **Security** documentation for threat model and best practices
4. Explore **Smart Contracts** for technical implementation details
5. Follow the **User Guide** for step-by-step usage instructions

## Need Help?

- **Discord**: Join our community
- **Twitter**: [@WalnutProtocol](https://twitter.com/WalnutProtocol)
- **GitHub Issues**: Report bugs or request features
