# Walnut Protocol — Overall Flow & Market Guide

## 1. Overall Protocol Flow in Simple English

Walnut Protocol is a **confidential lending app** built on Web3 technology. Think of it as a digital bank vault where your financial numbers—how much you deposit, how much you borrow, and your credit score—are put inside invisible, locked envelopes using high-tech cryptography (Fully Homomorphic Encryption, or FHE). 

Here is how a user interacts with Walnut from start to finish:

```
[1. Connect & Unlock] ──> [2. Deposit Collateral] ──> [3. Shielded Borrow]
                                                              │
                                                              ▼
[5. Withdraw Assets]  <──  [4. Repay & Boost Credit] <────────┘
```

### Step-by-Step User Journey:
1. **Connect & Unlock (Access Key):**
   - The user connects their crypto wallet (like MetaMask or Rabby).
   - They click **"Create Access Key"** and sign a free message with their wallet. This digital key acts like a private viewing lens—only the user can see their own balances, while the rest of the world sees encrypted code.
2. **Deposit Collateral:**
   - The user deposits stablecoins (such as USDC) into Walnut's vault.
   - The protocol locks the funds and immediately converts the value into an encrypted format.
3. **Shielded Borrowing:**
   - Against their deposit, the user borrows cUSDC (confidential stablecoins).
   - The user gets spending money in their wallet, but **nobody on the internet can see how much they borrowed or what their debt is**.
4. **Repay Loan & Boost Credit:**
   - When ready, the user repays their loan in cUSDC.
   - Repaying automatically earns the user credit points on-chain. Over time, higher credit scores unlock higher borrowing limits (up to 85% of their collateral value).
5. **Withdraw Collateral:**
   - Once debt is cleared, the user withdraws their original collateral back to their wallet safely.

---

## 2. Why Confidential Lending Matters: What Happens Without It?

To understand why Walnut is necessary, imagine if your traditional bank published your bank balance, your credit card debt, and your salary on a public billboard on the main street for everyone to see. 

That is exactly how standard DeFi lending platforms (like Aave, Compound, or MakerDAO) work today. Every single loan and wallet balance is public. Here are the major problems that happen if you do **NOT** use confidential lending:

### Problem 1: Robot Predators (MEV Bot Front-Running & Liquidation Sniping)
- **The Problem:** On public lending platforms, automated computer programs (called MEV bots) spy on everyone's health factor 24/7. If market prices drop slightly and your loan gets close to a risk threshold, these bots instantly jump in ahead of you, force your position into liquidation, and steal a 5% to 15% penalty fee from your collateral.
- **How Walnut Fixes It:** Because health factors and debt are encrypted, bot operators cannot see when you are near liquidation. Liquidations take place through private, sealed-bid auctions, protecting your funds from bot predators.

### Problem 2: Financial Spying & Targeted Attacks
- **The Problem:** When your wallet activity is 100% public, hackers, scammers, and business competitors can track your net worth. Competitors can see your cash flow, short-sell assets you hold to force you into default, or target your wallet with phishing attacks.
- **How Walnut Fixes It:** Walnut hides your debt and collateral amounts behind FHE encryption. You maintain total privacy over your financial health, just like in high-grade private banking.

### Problem 3: Large Companies and Institutions Cannot Use Public DeFi
- **The Problem:** Big corporations, hedge funds, and institutions manage billions of dollars, but corporate laws and privacy regulations strictly prohibit them from exposing their balance sheets on public block explorers.
- **How Walnut Fixes It:** Walnut provides compliance-friendly privacy. Institutions can borrow and lend capital on-chain while keeping their financial risk-books strictly private from competitors.

---

## 3. Product Sustainability: Why Will People Deposit & What Do They Get?

For any lending platform to survive long term, it must answer three questions: *Why would depositors lock their money here? What do they get in return? How does the protocol sustain itself?*

### Why Do People Deposit? (The Incentives)
1. **Passive Yield Earnings (Interest Income):**
   - When borrowers draw loans on Walnut, they pay an annual interest rate (e.g. 8.00% BORROW_APR).
   - A major portion of this interest (e.g. 6.00% APY) is distributed directly to collateral depositors as passive income. Depositors earn return on their idle stablecoins simply by keeping them in the vault.
2. **Access to Borrowing Power Without Selling Assets:**
   - Crypto holders often want cash without selling their long-term assets (like ETH, WBTC, or USDC) because selling triggers capital gains taxes and loses exposure to future price growth.
   - Depositing collateral allows users to take out cash loans (cUSDC) while keeping ownership of their underlying assets.
3. **Confidentiality Advantage:**
   - High-net-worth individuals and whales deposit large amounts into Walnut specifically because they know their positions won't be broadcasted to public tracking bots or Twitter wallet monitors.
4. **Unlocking Higher Leverage via Credit Scoring:**
   - Regular depositors who build a history of timely repayments earn higher Credit Tiers (Tier 0 to Tier 3). Higher tiers let depositors borrow up to **85% LTV** (compared to standard 70% LTV), giving them maximum capital efficiency per dollar deposited.

### What Do Depositors Get in Return?

| Depositor Benefit | Description |
|-------------------|-------------|
| **Base Yield APY** | Continuous passive interest paid in stablecoins derived from borrower interest fees. |
| **Confidential Liquidity** | Ability to draw private loans (cUSDC) against collateral without exposing net worth. |
| **Credit Reputation** | On-chain credit score progression unlocking lower collateral requirements. |
| **Protection from MEV** | Zero exposure to predatory liquidation bots or front-running liquidators. |

### How Does Walnut Sustain in the Market? (Protocol Revenue Model)

Walnut generates sustainable protocol revenue through clear economic mechanisms:

1. **Protocol Fee Spread:** 
   - The protocol charges a 2.00% annual protocol fee (`PROTOCOL_FEE_APR`) on outstanding active loans. This spread flows into the protocol treasury to fund development, insurance reserves, and security audits.
2. **Privara Escrow Interest Routing:**
   - Interest payments are processed through the Privara settlement engine (`/api/privara/settle`), automatically distributing yields between the Lender Pool Vault and the Protocol Treasury cleanly and transparently.
3. **Sealed-Bid Liquidation Surplus Fees:**
   - During liquidation auctions, small protocol processing fees are retained from winning bid settlements to maintain the CoFHE relayer infrastructure.
4. **Institutional TVL Onboarding:**
   - By solving the privacy barrier for corporate treasuries and private funds, Walnut accesses a massive multi-billion dollar institutional market that is completely locked out of traditional transparent DeFi protocols.
