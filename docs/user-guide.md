# Walnut Protocol User Guide

This guide walks you through using Walnut Protocol step-by-step, from connecting your wallet to completing a full lending cycle.

## Prerequisites

Before you begin, make sure you have:

- **MetaMask** or another Web3 wallet installed
- **Arbitrum Sepolia testnet** configured in your wallet
- **Testnet ETH** for gas fees ([get from faucet](https://faucet.quicknode.com/arbitrum/sepolia))
- Basic understanding of DeFi lending concepts

## Step 1: Connect Your Wallet

1. Visit the Walnut Protocol app at [walnut-protocol.vercel.app](https://walnut-protocol.vercel.app)
2. Click **"Connect Wallet"** in the top right corner
3. Select your wallet provider (MetaMask, WalletConnect, etc.)
4. Approve the connection request in your wallet
5. Ensure you're connected to **Arbitrum Sepolia** (Chain ID: 421614)

**Troubleshooting:**
- If you see "Wrong Network", click the network switcher and select Arbitrum Sepolia
- If Arbitrum Sepolia isn't in your wallet, add it manually:
  - Network Name: Arbitrum Sepolia
  - RPC URL: https://sepolia-rollup.arbitrum.io/rpc
  - Chain ID: 421614
  - Currency Symbol: ETH
  - Block Explorer: https://sepolia.arbiscan.io

## Step 2: Create Your Permit

When you first visit the dashboard, you'll be prompted to create a permit. This is a one-time setup.

### What is a Permit?

A permit is a cryptographic signature that grants your wallet permission to decrypt your encrypted financial data. Your collateral, debt, and health factor are encrypted on-chain—the permit lets you view them.

### Creating Your Permit

1. Click **"Create Permit"** or **"Sign to Create Permit"**
2. Read the explanation modal (appears on first use)
3. Click **"Sign to Create Permit"** in the modal
4. Approve the signature request in your wallet
   - **Note**: This is a signature, not a transaction—it's free and instant
5. Wait a few seconds for the permit to be generated
6. Your dashboard will now show your encrypted data

**Important:**
- You only need to create a permit once
- The permit is stored locally in your browser
- If you clear your browser data, you'll need to create a new permit
- Each wallet address needs its own permit

## Step 3: Get Test USDC

Walnut uses MockUSDC for testing on Arbitrum Sepolia. You can mint it directly from the deposit page.

1. Navigate to **"Deposit"** in the sidebar
2. Scroll to the **"Mint Test USDC"** section
3. Enter the amount you want to mint (e.g., 1000)
4. Click **"Mint MockUSDC"**
5. Confirm the transaction in your wallet
6. Wait for the transaction to confirm (~2 seconds)
7. Your MockUSDC balance will update

**Tips:**
- Mint at least 100 USDC to test the full lending cycle
- You can mint as much as you need—it's free testnet tokens
- Check your balance in the "Your Wallet" section

## Step 4: Deposit Collateral

Now that you have MockUSDC, deposit it as collateral to start borrowing.

### Depositing

1. Stay on the **"Deposit"** page
2. In the **"Deposit Collateral"** section:
   - Token: MockUSDC (pre-selected)
   - Amount: Enter how much you want to deposit (e.g., 100)
3. Click **"Approve MockUSDC"** (first time only)
   - This grants the contract permission to transfer your tokens
   - Confirm the approval transaction in your wallet
4. After approval completes, click **"Deposit"**
5. Confirm the deposit transaction in your wallet
6. Wait for confirmation

### What Happens

- Your MockUSDC is transferred to the Walnut contract
- The USD value is calculated using the Chainlink price feed
- Your encrypted collateral balance increases
- You can now see your collateral on the dashboard (after permit decryption)

**Dashboard Updates:**
- **Your Collateral**: Shows your total collateral in USD (encrypted, decrypted for you)
- **Available to Borrow**: Shows how much you can borrow based on your LTV
- **Health Factor**: Shows ∞ (infinite) since you have no debt yet

## Step 5: Borrow cUSDC

With collateral deposited, you can now borrow encrypted cUSDC. Walnut supports multiple concurrent loans.

### Understanding Borrowing

- **LTV (Loan-to-Value)**: Maximum percentage of collateral you can borrow
- **Credit Tier 0**: 70% LTV (default for new users)
- **cUSDC**: Encrypted stablecoin you receive when borrowing
- **Interest Rate**: 8% APR (currently fixed)
- **Multiple Loans**: You can have multiple active loans simultaneously

### Borrowing

1. Navigate to **"Borrow"** in the sidebar
2. Review your borrowing power:
   - **Max Borrow**: Shows maximum amount at your current tier
   - **Current Tier**: Shows your credit tier and LTV
   - **Interest Estimates**: Shows projected interest for different time periods
3. Enter the amount you want to borrow (e.g., 50 USDC)
   - Must be ≤ your max borrow amount
   - Amount is encrypted client-side before sending
4. Review the interest estimates:
   - 30 days: ~$X
   - 90 days: ~$X
   - 1 year: ~$X
5. Click **"Borrow"**
6. Confirm the transaction in your wallet
7. Wait for confirmation

### What Happens

- Your borrow amount is encrypted in your browser
- The contract checks if you're within your LTV limit (using FHE)
- If approved, cUSDC is minted to your wallet
- A new loan is created in your loans array
- Your encrypted debt increases
- A decrypt request is sent to sync the loan's principal
- The loan's `openedAt` timestamp is recorded for interest calculation

**Dashboard Updates:**
- **Your Debt**: Shows your total borrowed amount across all loans (encrypted)
- **Health Factor**: Shows your position health (collateral / debt ratio)
- **Available to Borrow**: Decreases by the amount you borrowed
- **Active Loans**: Shows count of active loans

**Important:**
- You can have **multiple active loans** simultaneously
- Each loan accrues interest independently from its `openedAt` timestamp
- Your cUSDC balance is encrypted—you'll see "● ● ● ●" until you decrypt it
- Total debt is the sum of all active loan principals

## Step 6: Monitor Your Position

Use the dashboard to track your lending position.

### Dashboard Metrics

**Your Position:**
- **Collateral**: Total USD value of your deposits (encrypted)
- **Debt**: Total amount you've borrowed (encrypted)
- **Available**: How much more you can borrow
- **Health Factor**: Collateral / Debt ratio
  - **Green (>1.5)**: Healthy position
  - **Amber (1.05-1.5)**: Caution zone
  - **Red (<1.05)**: Liquidation risk

**Loan Health Chart:**
- Donut chart showing your utilization percentage
- Health Factor with color coding
- Liquidation Threshold: 105% (10500 basis points)
- Current LTV vs Max LTV

**Protocol Metrics:**
- **Total Supplied**: All collateral in the protocol
- **Total Borrowed**: All active loans
- **Available Liquidity**: Unborrowed funds
- **Utilization Rate**: Percentage of funds borrowed

### Decrypting Your Data

If you see "● ● ● ●" instead of values:

1. Make sure your permit is created (check Protocol Status bar)
2. Click the **"[decrypt ↗]"** button next to the encrypted value
3. Wait a few seconds for decryption
4. The value will update automatically

**Auto-Decryption:**
- Most values decrypt automatically when you load the page
- Manual decrypt is only needed if auto-decrypt fails
- Decryption requires your permit to be active

## Step 7: Repay Your Loan

When you're ready to repay, you'll need to repay both principal and accrued interest.

### Understanding Repayment

Repayment is a **two-transaction process**:

1. **Repay Transaction**: Burns your cUSDC and clears your debt
2. **Settlement Transaction**: Transfers interest to lenders and protocol (via Privara)

The settlement transaction is handled by Privara to keep the interest amount private.

### Repaying

1. Navigate to **"Repay"** in the sidebar
2. If you have multiple loans, select which loan to repay
3. Review the selected loan details:
   - **Principal**: Amount you originally borrowed for this loan
   - **Interest Accrued**: Interest since this loan was opened
   - **Total to Repay**: Principal + Interest for this loan
4. The repay amount is pre-filled with the total
5. Click **"Repay Loan"**
6. Confirm the repay transaction in your wallet
7. Wait for the first transaction to confirm
8. The settlement transaction will be submitted automatically
9. You'll see both transaction hashes with Arbiscan links

### What Happens

**Transaction 1 (Repay):**
- Your cUSDC is burned
- The specific loan's encrypted debt is cleared
- The loan is marked as inactive
- Your repayment count increases (encrypted)
- A decrypt request confirms full repayment

**Transaction 2 (Settlement):**
- Interest is transferred to the lender pool (75%)
- Protocol fee is transferred to treasury (25%)
- Settlement is handled privately via Privara

**Dashboard Updates:**
- **Your Debt**: Decreases by the repaid loan amount
- **Health Factor**: Improves (or returns to ∞ if all loans repaid)
- **Available to Borrow**: Increases
- **Active Loans**: Count decreases by 1
- **Credit Tier**: May increase after 3+ repayments

### Special Cases

**No Interest Settlement:**
- If you borrowed and repaid within 60 seconds, no interest accrued
- You'll see "No interest settlement (loan duration < 60 seconds)"
- Only the repay transaction is needed

**Multiple Active Loans:**
- You can repay loans in any order
- Each loan is independent with its own interest calculation
- Repaying one loan doesn't affect others

**Partial Repayment:**
- Currently not supported—you must repay the full loan amount
- Future versions may support partial repayments

## Step 8: Withdraw Your Collateral

After repaying your loan, you can withdraw your collateral.

### Withdrawal Requirements

You can only withdraw if:
- ✅ Your debt is $0 (loan fully repaid)
- ✅ Your `borrowTimestamp` is cleared
- ✅ You have collateral deposited

### Withdrawing

1. Navigate to **"Withdraw"** in the sidebar
2. If you have an active loan, you'll see:
   - ⚠️ Warning: "Repay your loan before withdrawing collateral"
   - **[Go to Repay →]** button
   - Withdraw button is disabled
3. After repaying, the withdraw form becomes available
4. Select the token you want to withdraw (e.g., MockUSDC)
5. Enter the amount to withdraw
   - Shows your vault balance for that token
   - Can withdraw partial or full amount
6. Click **"Withdraw"**
7. Confirm the transaction in your wallet
8. Wait for confirmation

### What Happens

- The USD value of your withdrawal is calculated
- Your encrypted collateral decreases
- The tokens are transferred back to your wallet
- Your vault holdings are updated

**Dashboard Updates:**
- **Your Collateral**: Decreases by withdrawal amount
- **Available to Borrow**: Decreases proportionally
- **Wallet Balance**: Increases by withdrawn amount

## Credit Tier Progression

As you repay loans, you progress through credit tiers and unlock higher LTV ratios.

### Tier System

| Tier | Repayments Required | Max LTV | Max Borrow (on $100 collateral) |
|------|---------------------|---------|----------------------------------|
| 0    | 0 (default)         | 70%     | $70                              |
| 1    | 3 repayments        | 75%     | $75                              |
| 2    | 10 repayments       | 80%     | $80                              |
| 3    | 25 repayments       | 85%     | $85                              |
| 4    | 50 repayments       | 90%     | $90                              |

### Requesting Tier Update

Your tier doesn't update automatically—you need to request it:

1. Navigate to **"Settings"** (or use the dashboard tier widget)
2. Click **"Request Tier Update"**
3. Confirm the transaction
4. Wait for the decrypt callback to process
5. Your tier will update if you've met the requirements

**How It Works:**
- Your repayment count is encrypted on-chain
- Requesting an update triggers a decrypt request
- CoFHE decrypts your count and calls back with the result
- The contract derives your tier from the count
- Your public `creditTier` is updated

## Protocol Status Bar

The status bar at the bottom of the dashboard shows system health:

- **Wallet**: Connection status and address
- **Network**: Current network (should be Arbitrum Sepolia)
- **Private Access**: Permit status (Active/Loading/None)
- **Oracle**: Chainlink price feed status
- **Encryption**: CoFHE network status
- **Block**: Current block number

**Status Indicators:**
- 🟢 Green: Operational
- 🟡 Amber: Warning
- 🔴 Red: Error

## Troubleshooting

### "Permit not found" or Can't Decrypt

**Solution:**
1. Check if you've created a permit (Protocol Status bar)
2. If not, click "Create Permit" on the dashboard
3. If permit exists but decryption fails, try refreshing the page
4. Clear browser cache and recreate permit if issues persist

### "Repay loan before withdrawing" Error

**Cause:** You're trying to withdraw with an active loan

**Solution:**
1. Navigate to the Repay page
2. Repay your full loan (principal + interest)
3. Wait for both transactions to confirm
4. Return to Withdraw page

### Transaction Stuck or Failed

**Solutions:**
- Check Arbiscan for transaction status (click the tx hash link)
- If pending too long, try speeding up in MetaMask
- If failed, read the error message on Arbiscan
- Ensure you have enough ETH for gas fees
- Try again with higher gas settings

### Encrypted Values Not Showing

**Solutions:**
1. Ensure permit is created and active
2. Click the **[decrypt ↗]** button manually
3. Wait a few seconds for CoFHE to process
4. Refresh the page if values don't appear
5. Check browser console for errors (F12)

### Wrong Network

**Solution:**
1. Click the network switcher in your wallet
2. Select "Arbitrum Sepolia"
3. If not available, add it manually (see Step 1)
4. Refresh the page after switching

## Best Practices

### Security

- ✅ Never share your private keys or seed phrase
- ✅ Verify contract addresses on Arbiscan before interacting
- ✅ Double-check transaction details before confirming
- ✅ Use a separate wallet for testnet activities
- ✅ Keep your permit secure (it's stored locally)

### Position Management

- ✅ Monitor your Health Factor regularly
- ✅ Keep HF above 1.5 for safety margin
- ✅ Repay loans promptly to minimize interest
- ✅ Progress through credit tiers for better LTV
- ✅ Withdraw unused collateral to reduce risk

### Gas Optimization

- ✅ Batch operations when possible
- ✅ Avoid unnecessary transactions
- ✅ Use appropriate gas settings (not too low)
- ✅ Wait for network congestion to clear if gas is high

## Advanced Features

### Position Guard

Set an encrypted health factor threshold for monitoring:

1. Navigate to Settings
2. Enter your desired HF threshold (e.g., 1.2)
3. Click "Set Position Guard"
4. The protocol will monitor your HF
5. If HF drops below threshold, `PositionGuardTriggered` event is emitted

**Use Case:** External monitoring services can watch for this event and alert you

### Auditor Permits

Protocol owner can grant time-limited read access to auditors:

- Auditors can decrypt user positions for compliance/auditing
- Permits expire automatically after set time
- Owner can revoke permits early if needed

**Note:** This is an admin-only feature for protocol governance

## Getting Help

### Resources

- **Documentation**: [docs/](.)
- **Architecture**: [architecture.md](architecture.md)
- **Security**: [security.md](security.md)
- **FHE Explainer**: [fhe-explainer.md](fhe-explainer.md)

### Support Channels

- **Discord**: [Join our community](https://discord.gg/...) *(update with actual invite)*
- **Twitter**: [@WalnutProtocol](https://twitter.com/WalnutProtocol) *(update with actual handle)*
- **GitHub**: [Report issues](https://github.com/your-org/walnut-protocol/issues)

### Common Questions

**Q: Is my data really private?**
A: Yes! Your collateral, debt, and health factor are encrypted on-chain. Only you can decrypt them with your permit. Even the protocol owner cannot see your position values.

**Q: What happens if I lose my permit?**
A: You can create a new permit anytime. Your encrypted data is still on-chain—the permit just lets you decrypt it.

**Q: Can I have multiple loans?**
A: Yes! You can have multiple active loans simultaneously. Each loan accrues interest independently from its `openedAt` timestamp. You can repay them in any order.

**Q: How is interest calculated?**
A: Interest accrues linearly at 8% APR from each loan's `openedAt` timestamp. Formula: `(principal × 0.08 × elapsed_seconds) / (365 days)`. Each loan calculates interest independently.

**Q: What's the liquidation threshold?**
A: 105% (10500 basis points). If your Health Factor drops below 1.05, your position becomes eligible for liquidation. However, liquidations are not yet implemented in this testnet version.

**Q: Is this safe to use with real money?**
A: **No!** This is a testnet deployment for demonstration purposes only. It has not been audited and uses mock tokens. Do not use with real funds.

---

**Ready to get started?** Head to [walnut-protocol.vercel.app](https://walnut-protocol.vercel.app) and connect your wallet!
