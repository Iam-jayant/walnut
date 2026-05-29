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
| WalnutLending | `0x7D2624efEEe1640d347fbE4632d352c8648A26f5` |
| WalnutFHERC20 (cUSDC) | `0xD23FC704Dc7b69F299E8f69704f9dDc631d7CDef` |
| WalnutPriceOracle | `0x5Ca597609292912a9422EB6a954236564331911F` |
| MockUSDC | `0x2956690C57012afF7086dB71bC9d4b08715d920F` |

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
