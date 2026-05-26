# Walnut Protocol

**Live App**: [walnut-protocol.vercel.app](https://walnut-protocol.vercel.app) *(update with actual URL)*  
**Demo Video**: [Watch Demo](https://youtube.com/...) *(update with actual URL)*  
**Contracts**: [WalnutLending](https://sepolia.arbiscan.io/address/0xD647A9533C9C8831E7E95a4dcB2Dda1afDfF934d) | [cUSDC](https://sepolia.arbiscan.io/address/0x561152D0a49A6CeFE6046d6762efF57cD7aA57DF) | [Oracle](https://sepolia.arbiscan.io/address/0x5d598F3C9b45191d9f131cCbF957E969Eb173b98)  
**Tests**: 55+ passing | **Network**: Arbitrum Sepolia

> Deposit USDC. Borrow cUSDC. Nobody sees how much.

Walnut is a confidential lending protocol built with Fully Homomorphic Encryption (FHE). Users deposit collateral and borrow an encrypted stablecoin while their position data remains encrypted on-chain. The protocol enforces collateral ratios, calculates interest, and manages credit tiers—all without revealing individual user positions.

## Why FHE, Not ZK?

Zero-Knowledge proofs let you prove something is true without revealing why. FHE lets you compute on encrypted data without ever decrypting it. For confidential lending, we need the protocol to calculate your health factor, compare bids in sealed auctions, and update credit scores—all on encrypted values. ZK can't do that; FHE can.

## Features

- **Encrypted Positions**: Collateral, debt, and health factors stored as encrypted `euint128` values on-chain
- **Protocol-Owned Accounting**: Users cannot manipulate debt calculations through calldata
- **Single Active Loan**: One borrow epoch per user prevents timestamp corruption
- **Credit Tier System**: Encrypted repayment history unlocks better LTV ratios (70% → 90%)
- **Interest Calculation**: 8% APR with 25% protocol fee, 75% to lenders
- **Permit-Based Decryption**: Users sign permits to decrypt their own data in the frontend
- **Private Settlement**: Interest settlement via Privara for encrypted payment metadata
- **Real Collateral**: Deposit MockUSDC (testnet), borrow encrypted cUSDC

## Tech Stack

**Smart Contracts**:
- Solidity 0.8.19
- CoFHE (Fhenix) for FHE operations
- Chainlink price feeds for collateral valuation
- Hardhat for development and testing

**Frontend**:
- Next.js 14 with App Router
- TypeScript (strict mode)
- wagmi + viem for Web3 interactions
- TanStack Query for state management
- CoFHE SDK for client-side encryption
- Tailwind CSS for styling

**Infrastructure**:
- Arbitrum Sepolia testnet
- Vercel for frontend hosting
- Privara for private settlement coordination

## Contract Addresses

**Network**: Arbitrum Sepolia (Chain ID: 421614)

| Contract | Address | Arbiscan |
|----------|---------|----------|
| WalnutLending | `0xD647A9533C9C8831E7E95a4dcB2Dda1afDfF934d` | [View](https://sepolia.arbiscan.io/address/0xD647A9533C9C8831E7E95a4dcB2Dda1afDfF934d) |
| cUSDC (WalnutFHERC20) | `0x561152D0a49A6CeFE6046d6762efF57cD7aA57DF` | [View](https://sepolia.arbiscan.io/address/0x561152D0a49A6CeFE6046d6762efF57cD7aA57DF) |
| WalnutPriceOracle | `0x5d598F3C9b45191d9f131cCbF957E969Eb173b98` | [View](https://sepolia.arbiscan.io/address/0x5d598F3C9b45191d9f131cCbF957E969Eb173b98) |
| MockUSDC | `0xaf80C080857956021C0200dFdFC48349eB02F3ff` | [View](https://sepolia.arbiscan.io/address/0xaf80C080857956021C0200dFdFC48349eB02F3ff) |
| MockUSDCPriceFeed | `0xb93D1D4A01E5ed25a96519154F976117d333740b` | [View](https://sepolia.arbiscan.io/address/0xb93D1D4A01E5ed25a96519154F976117d333740b) |

All contracts are verified on Arbiscan.

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- MetaMask or compatible Web3 wallet
- Arbitrum Sepolia testnet ETH ([faucet](https://faucet.quicknode.com/arbitrum/sepolia))

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/walnut-protocol.git
cd walnut-protocol

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
```

### Environment Configuration

Edit `.env.local` with your settings:

```bash
NEXT_PUBLIC_CHAIN_ID=421614
NEXT_PUBLIC_RPC_URL_PRIMARY=https://sepolia-rollup.arbitrum.io/rpc
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Contract addresses (already deployed)
NEXT_PUBLIC_V2_CONTRACT_ADDRESS=0xD647A9533C9C8831E7E95a4dcB2Dda1afDfF934d
NEXT_PUBLIC_FHERC20_ADDRESS=0x561152D0a49A6CeFE6046d6762efF57cD7aA57DF
NEXT_PUBLIC_ORACLE_ADDRESS=0x5d598F3C9b45191d9f131cCbF957E969Eb173b98
NEXT_PUBLIC_MOCK_USDC_ADDRESS=0xaf80C080857956021C0200dFdFC48349eB02F3ff
```

### Run the Application

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

Visit `http://localhost:3000` to access the application.

### Using the Protocol

1. **Connect Wallet**: Connect your MetaMask to Arbitrum Sepolia
2. **Mint Test USDC**: Use the deposit page to mint MockUSDC for testing
3. **Create Permit**: Sign a permit to enable encrypted data decryption
4. **Deposit Collateral**: Deposit MockUSDC as collateral
5. **Borrow cUSDC**: Borrow encrypted cUSDC against your collateral
6. **Repay Loan**: Repay your loan with interest (two transactions)
7. **Withdraw**: Withdraw your collateral after repaying

## Documentation

- **[FHE Explainer](docs/fhe-explainer.md)**: Understanding Fully Homomorphic Encryption
- **[Security Documentation](docs/security.md)**: Threat model, access control, and security considerations
- **[Contract Documentation](docs/contracts.md)**: Detailed contract specifications *(coming soon)*
- **[Architecture Guide](docs/architecture.md)**: System design and data flows *(coming soon)*
- **[User Guide](docs/user-guide.md)**: Step-by-step usage instructions *(coming soon)*

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
```

### Test Coverage

- **55+ passing tests** across unit and integration suites
- Interest calculation tests (1 day, 7 days, 30 days, 1 year)
- Credit tier LTV enforcement tests
- Multi-token collateral support tests
- Complete user journey tests (deposit → borrow → repay → withdraw)
- Access control and pause mechanism tests

### Frontend Type Checking

```bash
# TypeScript strict mode (zero errors)
npx tsc --noEmit

# Build verification
npm run build
```

## Development

### Project Structure

```
walnut-protocol/
├── app/                    # Next.js app routes
│   ├── app/               # Dashboard and protocol pages
│   └── api/               # API routes (Privara settlement)
├── components/            # React components
│   ├── dashboard/        # Dashboard-specific components
│   ├── landing/          # Landing page components
│   ├── ui/               # Reusable UI components
│   └── walnut/           # Protocol-specific components
├── contracts/            # Solidity smart contracts
│   └── wave4/           # Current production contracts
├── docs/                # Documentation
├── hooks/               # React hooks for protocol interaction
├── lib/                 # Utilities and configurations
├── scripts/             # Deployment and utility scripts
└── test/                # Contract tests
    ├── unit/           # Unit tests
    └── integration/    # Integration tests
```

### Key Files

- `contracts/WalnutLending.sol`: Main lending protocol contract
- `contracts/wave4/WalnutFHERC20.sol`: Encrypted cUSDC token
- `hooks/use-walnut-protocol.ts`: Main protocol interaction hook
- `lib/walnut-contract.ts`: Contract configuration and ABIs
- `components/walnut/permit-provider.tsx`: FHE permit management

### Deployment

Deploy to Arbitrum Sepolia:

```bash
# Full deployment (all contracts)
npx hardhat run scripts/deploy-wave4-arbitrum-sepolia.js --network arbitrumSepolia

# Verify contracts on Arbiscan
npx hardhat verify --network arbitrumSepolia <CONTRACT_ADDRESS> [CONSTRUCTOR_ARGS]

# Mint test USDC
npx hardhat run scripts/mint-mock-usdc.js --network arbitrumSepolia
```

## Security Considerations

⚠️ **Testnet Deployment**: This is a testnet deployment for demonstration purposes only.

- **Not Audited**: Contracts have not undergone professional security audit
- **MockUSDC**: Uses mock tokens, not production stablecoins
- **CoFHE Trust**: Relies on CoFHE network for decryption integrity
- **No Timelock**: Owner can change parameters immediately
- **Single Owner**: No multi-sig or governance

See [Security Documentation](docs/security.md) for detailed threat model and security considerations.

## Roadmap

**Current (Testnet)**:
- ✅ Encrypted collateral and debt tracking
- ✅ Protocol-owned principal accounting
- ✅ Credit tier system foundation
- ✅ Interest calculation and settlement
- ✅ Permit-based decryption

**Planned (Future)**:
- 🔄 Sealed-bid liquidation auctions
- 🔄 Credit score progression system
- 🔄 Multi-sig governance
- 🔄 Mainnet deployment
- 🔄 Security audit
- 🔄 Additional collateral types

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [CoFHE](https://fhenix.io/) for Fully Homomorphic Encryption
- Powered by [Arbitrum](https://arbitrum.io/) for scalable execution
- Price feeds from [Chainlink](https://chain.link/)
- Private settlement via [Privara](https://privara.io/)

## Contact

- Website: [walnut-protocol.vercel.app](https://walnut-protocol.vercel.app)
- Twitter: [@WalnutProtocol](https://twitter.com/WalnutProtocol) *(update with actual handle)*
- Discord: [Join our community](https://discord.gg/...) *(update with actual invite)*

---

**Disclaimer**: Walnut Protocol is experimental software. Use at your own risk. This is a testnet deployment and should not be used with real funds.
