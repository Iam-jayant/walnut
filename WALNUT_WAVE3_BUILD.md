# WALNUT — WAVE 3 BUILD INSTRUCTIONS
**Deadline:** May 4, 2026 (~9 days)  
**Goal:** Fully functional, production-grade confidential lending protocol.  
**Standard:** Every feature must work only because of Fhenix FHE. If it can exist on transparent rails, it doesn't belong here.

---

## CONTEXT FROM AUDIT

Wave 2 delivered the lending loop and sealed-bid liquidation. Wave 3 must do three things:

1. **Fix the async decrypt pattern** — judges flagged this in Wave 1, Wave 2 partially fixed it, Wave 3 must fully implement it. `onlyCoFHE` appears zero times in any contract. This is the #1 criticism vector.
2. **Migrate the SDK** — Fhenix deprecated `FHE.decrypt()` on April 13. New flows are `decryptForView` and `decryptForTx`. Every contract and frontend using the old API is broken.
3. **Ship encrypted credit scoring + P2P lending** — the two remaining FHE primitives that complete the "can't exist on transparent rails" argument.

---

## PHASE ORDER — DO NOT SKIP GATES

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
SDK Prep   Contract   Tests    Frontend   Privara   Polish    Submit
```

Each phase has acceptance criteria. Do not start the next phase until criteria are met.

---

## PHASE 0 — SDK Migration (Day 1, blocks everything)

### 0.1 — Upgrade @cofhe/* packages

In `package.json`, change all three:
```json
"@cofhe/sdk": "^0.4.0"     → "^0.5.0"
"@cofhe/react": "^0.4.0"   → "^0.5.0"
"@cofhe/abi": "^0.4.0"     → "^0.5.0"
```

Run `npm install`. If there are peer dependency conflicts, resolve them — do not use `--legacy-peer-deps` silently.

### 0.2 — Understand the new decrypt API

Fhenix now has two decrypt paths. Read the migration docs at:  
`https://cofhe-docs.fhenix.zone/client-sdk/introduction/migrating-from-cofhejs`

**decryptForView** — for UI display (off-chain, requires permit from connected wallet)
```typescript
// Shows a value to the user — never touches the chain
const result = await fhenixClient.decryptForView(ctHash, FheTypes.Uint128, permit);
```

**decryptForTx** — for on-chain protocol actions (returns a signature, then call FHE.publishDecryptResult())
```typescript
// Protocol needs to act on the decrypted value
const { signature, value } = await fhenixClient.decryptForTx(ctHash, FheTypes.Uint128);
await contract.write.publishDecryptResult([ctHash, value, signature]);
// Contract then reads the published plaintext and acts on it
```

### 0.3 — Verify on-chain contract package

Check if `@fhenixprotocol/cofhe-contracts` needs a version bump alongside the client SDK. Run:
```bash
npm show @fhenixprotocol/cofhe-contracts versions --json
```
If a version > `0.0.13` exists and has `FHE.requestDecrypt` + `onlyCoFHE` in its API, bump it.

### 0.4 — Confirm existing encrypted state still decrypts

After the SDK upgrade, immediately test the existing `getEncryptedCollateral` → `decryptForView` flow against the deployed contract. If it fails, the ciphertext state migration on April 27 may have affected stored values. Resolve before writing any new code.

### Phase 0 Acceptance Criteria
- [ ] `npm install` clean, no peer dependency errors
- [ ] `decryptForView` and `decryptForTx` both resolve correctly against deployed WalnutWave2b
- [ ] Existing deposit flow works end-to-end with new SDK

---

## PHASE 1 — WalnutWave3.sol (Days 1–4)

Deploy a new standalone contract. Do not modify WalnutWave2b.sol.

### 1.1 — Core architecture changes

**Add pool-level encrypted counters** (required for Wave 4 institutional layer — add now so Wave 4 doesn't require a full redeploy):
```solidity
euint128 private totalPoolCollateral;
euint128 private totalPoolDebt;
```
Update on every deposit/borrow/repay/withdraw with `FHE.add`/`FHE.sub` + `FHE.allowThis`.

**Add onlyCoFHE modifier** — this is the single most important change in Wave 3:
```solidity
address private immutable COFHE_ADDRESS;

constructor(address cofheAddress) {
    COFHE_ADDRESS = cofheAddress;
}

modifier onlyCoFHE() {
    require(msg.sender == COFHE_ADDRESS, "Only CoFHE coprocessor");
    _;
}
```

**Add proxy-ready ownership** (for Wave 5 mainnet):
```solidity
address public owner;
modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }
```

### 1.2 — Replace all manual decrypt patterns with FHE.requestDecrypt + onlyCoFHE

**Before (Wave 2 — deprecated):**
```solidity
FHE.allowGlobal(healthFactor);
FHE.decrypt(healthFactor);
// caller later polls and calls submitLiquidationCheck(bytes32 ctHash)
```

**After (Wave 3 — canonical):**
```solidity
function requestLiquidationCheck(address user) external returns (uint256) {
    euint128 hf = _computeHealthFactor(user);
    FHE.allowThis(hf);
    uint256 reqId = FHE.requestDecrypt(hf, this.onLiquidationResult.selector);
    pendingLiquidationChecks[reqId] = user;
    emit LiquidationCheckRequested(user, reqId);
    return reqId;
}

function onLiquidationResult(uint256 reqId, uint128 result) 
    external 
    onlyCoFHE  // ← this is what Wave 1 judge asked for
{
    address user = pendingLiquidationChecks[reqId];
    if (result < LIQUIDATION_THRESHOLD) {
        liquidatable[user] = true;
        emit LiquidationTriggered(user);
    }
    delete pendingLiquidationChecks[reqId];
    // result is NEVER stored or emitted — used only in this scope
}
```

Apply the same pattern to `selectWinningBid` → `onWinnerSelected`:
```solidity
function selectWinningBid(address borrower) external {
    // ... compute encrypted winnerIdx via FHE.select loop ...
    FHE.allowThis(winnerIdx);
    uint256 reqId = FHE.requestDecrypt(winnerIdx, this.onWinnerSelected.selector);
    pendingWinnerChecks[reqId] = borrower;
    emit SelectionRequested(borrower);
}

function onWinnerSelected(uint256 reqId, uint128 result) 
    external 
    onlyCoFHE  // ← canonical callback
{
    address borrower = pendingWinnerChecks[reqId];
    address winner = auctions[borrower].bidders[result];
    auctions[borrower].settled = true;
    liquidatable[borrower] = false;
    emit AuctionSettled(borrower, winner);
    delete pendingWinnerChecks[reqId];
}
```

### 1.3 — Encrypted Credit Scoring System

This is Wave 3's primary new FHE primitive. It must pass the "can't exist transparent" test: if the scoring inputs were public, the privacy model is broken.

**State:**
```solidity
mapping(address => euint128) private repaymentCount;
mapping(address => euint128) private defaultCount;
mapping(address => uint8) public creditTier; // 0-4, public — the tier itself is not sensitive
```

**Increment on repay (inside repay function):**
```solidity
repaymentCount[msg.sender] = FHE.add(
    repaymentCount[msg.sender], 
    FHE.asEuint128(1)
);
FHE.allowThis(repaymentCount[msg.sender]);
```

**Credit tier evaluation:**
```solidity
function requestCreditTierUpdate(address user) external {
    // Compute tier from encrypted repayment history
    // Tier thresholds are public constants — the COUNT is encrypted
    euint128 count = repaymentCount[user];
    FHE.allowThis(count);
    uint256 reqId = FHE.requestDecrypt(count, this.onCreditCountDecrypted.selector);
    pendingCreditUpdates[reqId] = user;
}

function onCreditCountDecrypted(uint256 reqId, uint128 result) 
    external 
    onlyCoFHE 
{
    address user = pendingCreditUpdates[reqId];
    // Tier logic — result is repayment count
    if (result >= 10) creditTier[user] = 4;
    else if (result >= 7) creditTier[user] = 3;
    else if (result >= 4) creditTier[user] = 2;
    else if (result >= 2) creditTier[user] = 1;
    else creditTier[user] = 0;
    emit CreditTierUpdated(user, creditTier[user]);
    delete pendingCreditUpdates[reqId];
    // result (raw count) NEVER stored or emitted
}
```

**Dynamic LTV based on credit tier:**
```solidity
// LTV table: tier 0 = 70%, tier 1 = 75%, tier 2 = 80%, tier 3 = 85%, tier 4 = 90%
uint256[5] public TIER_LTV = [7000, 7500, 8000, 8500, 9000];

function _getLTVForUser(address user) internal view returns (uint256) {
    return TIER_LTV[creditTier[user]];
}

// In borrow(), use _getLTVForUser(msg.sender) instead of hardcoded LTV_LIMIT
```

### 1.4 — P2P Lending

**State:**
```solidity
struct LoanOffer {
    address lender;
    euint128 encryptedAPR;     // hidden until match
    euint128 encryptedSize;    // hidden until match
    euint128 encryptedTenor;   // hidden until match
    bool active;
    address matchedBorrower;   // zero until matched
}

mapping(uint256 => LoanOffer) public offers;
uint256 public offerCount;
```

**Post offer:**
```solidity
function postOffer(
    InEuint128 memory encAPR,
    InEuint128 memory encSize,
    InEuint128 memory encTenor
) external returns (uint256 offerId) {
    offerId = offerCount++;
    offers[offerId].lender = msg.sender;
    offers[offerId].encryptedAPR = FHE.asEuint128(encAPR);
    offers[offerId].encryptedSize = FHE.asEuint128(encSize);
    offers[offerId].encryptedTenor = FHE.asEuint128(encTenor);
    offers[offerId].active = true;
    // Allow lender to read their own terms
    FHE.allow(offers[offerId].encryptedAPR, msg.sender);
    FHE.allow(offers[offerId].encryptedSize, msg.sender);
    FHE.allow(offers[offerId].encryptedTenor, msg.sender);
    emit OfferPosted(offerId, msg.sender);
}
```

**Match offer:**
```solidity
function matchOffer(uint256 offerId) external {
    require(offers[offerId].active, "Offer not active");
    require(offers[offerId].matchedBorrower == address(0), "Already matched");
    offers[offerId].active = false;
    offers[offerId].matchedBorrower = msg.sender;
    // Allow borrower to read the terms they matched
    FHE.allow(offers[offerId].encryptedAPR, msg.sender);
    FHE.allow(offers[offerId].encryptedSize, msg.sender);
    FHE.allow(offers[offerId].encryptedTenor, msg.sender);
    emit OfferMatched(offerId, msg.sender);
    // Privara settlement triggered from frontend after this tx
}
```

**Events:**
```solidity
event OfferPosted(uint256 indexed offerId, address indexed lender);
event OfferMatched(uint256 indexed offerId, address indexed borrower);
event CreditTierUpdated(address indexed user, uint8 tier);
```

### 1.5 — Handle emit events for nonpayable FHE reads

Keep the `HealthFactorHandle` and `AggregatedCollateralHandle` events from Wave 2b. They are the correct pattern for nonpayable functions that return encrypted handles.

### 1.6 — Contract constants

```solidity
uint256 public constant LIQUIDATION_THRESHOLD = 10500; // 1.05 * 1e4
uint256 public constant BID_WINDOW = 10 minutes;
uint256[5] public TIER_LTV = [7000, 7500, 8000, 8500, 9000];
// Remove hardcoded LTV_LIMIT — replaced by tier-based TIER_LTV
```

### 1.7 — Deploy and verify

```bash
npx hardhat compile
npx hardhat run scripts/deploy-wave3-sepolia.js --network sepolia
npx hardhat verify --network sepolia <WAVE3_ADDRESS> <COFHE_ADDRESS>
```

Update `NEXT_PUBLIC_WALNUT_WAVE3_CONTRACT_ADDRESS` in both `.env` and `.env.local`.

### Phase 1 Acceptance Criteria
- [ ] `onlyCoFHE` modifier present and used in all callback functions
- [ ] `FHE.requestDecrypt` used in requestLiquidationCheck and selectWinningBid
- [ ] No `onWinnerSelected` self-call pattern — replaced by onlyCoFHE callback
- [ ] Encrypted credit scoring: repaymentCount increments on repay
- [ ] requestCreditTierUpdate + onCreditCountDecrypted implemented
- [ ] Dynamic LTV reads from TIER_LTV[creditTier[user]]
- [ ] P2P postOffer and matchOffer implemented
- [ ] totalPoolCollateral and totalPoolDebt maintained on every mutation
- [ ] npx hardhat compile — zero errors
- [ ] Deployed and verified on Ethereum Sepolia

---

## PHASE 2 — Tests (Day 4–5)

File: `test/WalnutWave3.test.js`

### Required test cases

**Credit scoring:**
- repay increments encrypted repaymentCount
- requestCreditTierUpdate fires onCreditCountDecrypted via mock CoFHE
- tier 0 assigned at 0–1 repayments
- tier 4 assigned at 10+ repayments
- borrow LTV increases with credit tier

**Async decrypt (onlyCoFHE):**
- requestLiquidationCheck emits reqId
- onLiquidationResult reverts if not called by CoFHE address
- onLiquidationResult sets liquidatable correctly when HF < threshold
- onWinnerSelected reverts if not called by CoFHE address
- onWinnerSelected settles auction and emits winner address (no amounts)

**P2P lending:**
- postOffer stores encrypted terms, only lender can read them
- borrower cannot read terms before match
- matchOffer allows borrower to read terms, emits OfferMatched
- matched offer cannot be matched again

**Pool counters:**
- totalPoolCollateral increases on deposit
- totalPoolDebt increases on borrow
- both decrease correctly on repay and withdraw

**Regression:**
- All Wave 2 core functions (deposit/borrow/repay/withdraw) still work
- Sealed-bid auction end-to-end still works

### Phase 2 Acceptance Criteria
- [ ] All test cases pass
- [ ] `npx hardhat test` — zero failures

---

## PHASE 3 — Frontend Updates (Days 4–6)

### 3.1 — Migrate all frontend decrypt calls to new SDK

**Replace all `cofhejs.unseal()` calls with `fhenixClient.decryptForView()`:**
```typescript
// Before (deprecated)
const result = await cofhejs.unseal(ctHash, FheTypes.Uint128, permit);

// After (v0.5.0)
const result = await fhenixClient.decryptForView(ctHash, FheTypes.Uint128, permit);
```

**Replace all publish-on-chain decrypt flows with `decryptForTx` pattern:**
```typescript
// For flows where the contract needs to act on a decrypted value
const { signature, value } = await fhenixClient.decryptForTx(ctHash, FheTypes.Uint128);
await walletClient.writeContract({
  ...contractConfig,
  functionName: 'publishDecryptResult',
  args: [ctHash, value, signature],
});
```

Update `hooks/use-walnut-protocol.ts` and all direct `cofhejs` imports across the entire codebase.

### 3.2 — Update contract address and ABI

- Set `NEXT_PUBLIC_WALNUT_WAVE3_CONTRACT_ADDRESS` across all config
- Replace ABI in `lib/walnut-contract.ts` from `WalnutWave3.json` artifact
- Remove all Wave 2b-specific function references that no longer exist

### 3.3 — Credit scoring UI

**Dashboard — new Credit Tier card:**
```
CREDIT TIER
[ ●●●○○ ]  Tier 3 / 5
Current LTV limit: 85%
Next tier at 10 repayments
[Request Tier Update]
```

- Tier badge: 0 = gray, 1 = bronze, 2 = silver, 3 = gold, 4 = platinum
- "Request Tier Update" calls `requestCreditTierUpdate(address)` — write tx
- After CoFHE processes callback, `creditTier` mapping updates — read it and refresh card
- Show LTV limit derived from `TIER_LTV[tier]`

### 3.4 — P2P Lending page (`/app/p2p`)

**Two panels:**

Left panel — "Browse Offers":
- List active offers from `OfferPosted` events + `offers[id].active` check
- Each offer shows: Offer #N, Lender (truncated), Terms: [encrypted until match]
- "Match Offer" button — calls `matchOffer(offerId)`
- After match: reveal APR, size, tenor via `decryptForView` using lender permit
- Trigger Privara settlement after match tx confirms

Right panel — "Post an Offer":
- Three inputs: APR (%), Loan Size, Tenor (days) — encrypted client-side
- "Post Offer" button — calls `postOffer(encAPR, encSize, encTenor)`
- After confirm: offer appears in the left panel list with "[Your offer]" label
- Lender can read their own terms with permit toggle

### 3.5 — Repay page — replace Privara placeholder with real integration

Remove the "Coming in Wave 3" static label. Wire Privara SDK for real:

```typescript
import { PrivaraClient } from '@reineira-os/sdk';

// After repay tx confirms:
const priv = new PrivaraClient({ ... });
await priv.settleInterest({
  borrower: userAddress,
  lender: poolAddress,
  amount: interestAmount, // encrypted via Privara
});
```

Step 2 on the repay page becomes a real transaction with a real loading state and a real Etherscan link on confirm.

Check Privara SDK docs at `https://reineira.xyz/docs` for exact API. If the SDK API has changed from what the package exposes, adapt the integration to what `@reineira-os/sdk` actually exports.

### 3.6 — Liquidation check frontend — remove old polling pattern

The `submitLiquidationCheck(bytes32 ctHash)` function no longer exists in Wave 3. Remove all references. The new flow is:

1. User calls `requestLiquidationCheck(address)` — write tx
2. CoFHE calls back `onLiquidationResult` automatically — no user action needed
3. Frontend polls `liquidatable[address]` via a read after the request tx confirms
4. When `liquidatable` flips to `true`, show the liquidation warning banner

The UI should reflect this: after clicking "Request Check", show a pending state and poll `liquidatable` every 10 seconds until it resolves.

### Phase 3 Acceptance Criteria
- [ ] Zero `cofhejs` imports anywhere in the codebase — all replaced with `@cofhe/sdk` v0.5.0 API
- [ ] `decryptForView` used for all display-only decrypt flows
- [ ] `decryptForTx` pattern used where contract needs to act on value
- [ ] Credit tier card on dashboard — reads real `creditTier[address]` mapping
- [ ] P2P page exists, both panels functional, offer post and match work end-to-end
- [ ] Repay page Step 2 is real Privara settlement — not a label
- [ ] Liquidation check no longer uses submitLiquidationCheck — uses polling pattern
- [ ] `npm run build` — zero errors, zero suppressions

---

## PHASE 4 — Privara Integration Detail (Days 5–6)

Privara enables confidential payment flows. It is a Fhenix buildathon sponsor — judges will explicitly look for it.

### 4.1 — Where Privara must be integrated

| Flow | What Privara does |
|---|---|
| Pool interest payout to lenders | Lender receives interest without amount being visible |
| P2P loan settlement on match | Payment from borrower to lender with encrypted amount |
| Protocol fee collection | Treasury receives fee without individual amounts being public |

### 4.2 — Implementation checklist

- [ ] Import `PrivaraClient` from `@reineira-os/sdk` in at least: repay hook, P2P match hook
- [ ] Read Privara SDK docs and identify the correct method for encrypted stable transfers
- [ ] On repay confirm: call `priv.settleInterest(...)` with correct parameters
- [ ] On P2P match confirm: call `priv.settlePayment(...)` or equivalent
- [ ] Show Privara tx hash in UI alongside the lending tx hash
- [ ] Both tx hashes must be real, clickable, and lead to real Sepolia transactions

---

## PHASE 5 — Polish (Day 7)

Do these in order. Stop if time runs out — core FHE features matter more than polish.

### 5.1 — Toast notification system

Replace all inline `protocol.status` string displays with proper toasts:
- Success toast: green, 3 second auto-dismiss
- Error toast: red, persists until dismissed
- Info toast: for pending/async states like "Waiting for CoFHE result..."

### 5.2 — Transaction history page (`/app/history`)

Read events for the connected address:
- DepositSubmitted, BorrowSubmitted, RepaySubmitted, WithdrawSubmitted
- LiquidationCheckRequested, LiquidationTriggered
- AuctionOpened, BidSubmitted, AuctionSettled
- OfferPosted, OfferMatched
- CreditTierUpdated

Display as a table: Event type | Tx hash (linked) | Timestamp. Amounts stay masked — show event name and tx only.

### 5.3 — Architecture diagram

Add to `README.md`:
```
User → Frontend (@cofhe/react) → CoFHE coprocessor
                                        ↓
                              WalnutWave3.sol
                              (all state encrypted)
                                        ↓
                              onlyCoFHE callbacks
                              (liquidation, auction, credit)
                                        ↓
                              Privara SDK
                              (private settlements)
```

Update README Wave 3 section with: new contract address, Etherscan link, feature list.

---

## PHASE 6 — Demo Video (Day 8)

2–3 minutes. Technical. Record this exact flow:

1. Connect wallet (show "Private access ready" badge)
2. Deposit encrypted collateral — show tx on Etherscan, show masked balance on dashboard
3. Borrow at 70% LTV — show health factor gauge update
4. Show credit tier card (tier 0) — explain that repayment history is encrypted
5. Repay — show Step 1 (repay tx) + Step 2 (Privara private settlement)
6. Request credit tier update — explain CoFHE callback, show tier update
7. Borrow again — show higher LTV unlocked by credit tier
8. Liquidation: trigger liquidatable state → open auction → submit 2+ encrypted bids → select winner → show AuctionSettled event on Etherscan (winner address only, no amounts)
9. P2P: post encrypted offer → match it from another wallet → terms reveal after match
10. ENS aggregation: link second wallet → show aggregated collateral

**During the video say explicitly:**
- "Health factor is computed inside CoFHE — the protocol never sees plaintext"
- "Liquidators bid blind — CoFHE compares encrypted bids with FHE.requestDecrypt + onlyCoFHE callback"
- "Credit score is built from encrypted repayment history — raw count never on-chain"
- "Privara handles private settlement — interest amounts are never public"

---

## TIMELINE

| Day | Work |
|---|---|
| Day 1 | Phase 0 — SDK upgrade, verify existing decryption still works |
| Day 2–3 | Phase 1 — WalnutWave3.sol: onlyCoFHE, credit scoring, P2P, pool counters |
| Day 4 | Phase 2 — Tests. Phase 1 deploy + verify on Sepolia |
| Day 5–6 | Phase 3 — Frontend SDK migration, credit UI, P2P page |
| Day 6 | Phase 4 — Privara wiring in repay and P2P |
| Day 7 | Phase 5 — Polish: toasts, history, README |
| Day 8 | Phase 6 — Demo video recording |
| Day 9 | Buffer. Fix anything broken from demo run-through |

---

## WHAT FHENIX ACTUALLY CARES ABOUT

Read the buildathon brief again: *"We evaluate how creatively and effectively you apply privacy-first architecture — not how fast you can ship a demo."*

Every feature must answer the question: **can this exist without FHE?**

| Feature | Without FHE | With FHE |
|---|---|---|
| Sealed-bid liquidation | Bots see all bids, front-run | Bids encrypted, winner selected blind |
| Credit scoring | Raw repayment count is public | Count stays encrypted, only tier revealed |
| P2P lending terms | APR and size visible to everyone | Terms encrypted until match |
| Health factor | Anyone can compute your liquidation point | HF computed in ciphertext, only you see it |
| Interest settlement (Privara) | Amount public | Amount private |

If the demo shows all five of these working, Walnut is the most complete FHE lending protocol in the buildathon. That wins.

---

## NON-NEGOTIABLES

1. `onlyCoFHE` must appear on every decrypt callback. No exceptions.
2. `FHE.requestDecrypt` must replace all `FHE.decrypt` calls for protocol actions.
3. No plaintext sensitive values in any emitted event. Ever.
4. Privara must be real — not a label, not a timeout, not a placeholder.
5. Credit tier counter must be `euint128` — not a public uint that anyone can read.
6. P2P offer terms must be unreadable to non-parties before match.
7. `npm run build` must pass clean. Zero suppressions.
8. Both `.env` and `.env.local` must point to the Wave 3 contract address.

---

## WAVE 4 PREP (do not build, just be aware)

Wave 4 adds institutional selective disclosure. The `totalPoolCollateral` and `totalPoolDebt` state variables added in Phase 1.1 are the foundation. Do not skip them even if they seem unused — Wave 4 needs them to grant auditors aggregate solvency proofs without exposing individual positions.

---

*This document supersedes all previous wave specs for Wave 3. When in doubt, refer here.*
