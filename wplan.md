# Walnut V1 Implementation Plan (Arbitrum Sepolia, Wave 5 Demo)

## Summary
- Build a single production contract, `WalnutV1.sol`, and remove Wave contracts from active use (`WalnutWave1/2/2b` are history only, not referenced, not inherited).
- Migrate the full stack from Ethereum Sepolia (`11155111`) to Arbitrum Sepolia (`421614`) across contract config, frontend chain config, envs, deploy/verify flow, and docs.
- Keep all Wave 3 privacy primitives, but reframe as V1 architecture: async decrypt callbacks via the TaskManager path exposed by `FHE.sol`, strict `onlyCoFHE`, encrypted credit scoring, sealed-bid auction, ENS aggregation, P2P lending, and pool-level encrypted totals.
- Replace placeholder Privara logic with real Reineira SDK settlement transactions and surface both tx hashes in UI.
- Deliver phase-gated execution with compile/test/build/verify gates before progressing.

## Public APIs, Interfaces, and Type Changes
- **Contract replacement:** `WalnutV1` becomes the only protocol contract; remove all Wave-specific contract address selection logic in frontend hooks.
- **Core external functions:** `deposit(InEuint128)`, `borrow(InEuint128)`, `repay(InEuint128)`, `withdraw(InEuint128)`.
- **Liquidation async flow:** `requestLiquidationCheck(address)` + `onLiquidationResult(uint256,uint128)` (`onlyCoFHE`), no user-facing `submitLiquidationCheck`.
- **Auction async flow:** `openAuction(address)`, `submitBid(address,InEuint128)`, `selectWinningBid(address)` + `onWinnerSelected(uint256,uint128)` (`onlyCoFHE`), no `finalizeWinnerSelection`.
- **Credit flow:** `requestCreditTierUpdate(address)` + `onCreditCountDecrypted(uint256,uint128)` (`onlyCoFHE`), `creditTier[address]` public `uint8`, `TIER_LTV[5]=[7000,7500,8000,8500,9000]`.
- **P2P flow:** `postOffer(InEuint128,InEuint128,InEuint128)`, `matchOffer(uint256)` with encrypted terms readable only by parties.
- **ENS aggregation:** `registerENSWallet(string,address)` strict revert checks, `getAggregatedCollateral(address)` nonpayable handle flow.
- **Security/state additions:** `onlyCoFHE` reads the CoFHE address from `@fhenixprotocol/cofhe-contracts/FHE.sol` named constant (`TASK_MANAGER_ADDRESS`), no constructor args, `owner`, `pause()/unpause()`, `whenNotPaused` on `deposit`/`borrow`, `totalPoolCollateral` and `totalPoolDebt` encrypted private counters.
- **Event policy:** no plaintext sensitive amounts in events; keep handle events only for encrypted read handles (`HealthFactorHandle`, `AggregatedCollateralHandle`).
- **Network/env interface:** `NEXT_PUBLIC_CHAIN_ID=421614`, `NEXT_PUBLIC_RPC_URL_PRIMARY=https://sepolia-rollup.arbitrum.io/rpc`, new `ARBITRUM_SEPOLIA_RPC_URL`, and single `NEXT_PUBLIC_CONTRACT_ADDRESS` for WalnutV1.
- **Privara SDK reality check:** current package exports `ReineiraSDK`/modules (not `PrivaraClient`); integration must use actual exported APIs discovered in Phase 0.

## Implementation Changes

### Phase 0 — Network migration + SDK upgrade (Day 1)
- Replace Sepolia config with Arbitrum Sepolia in Hardhat (`hardhat.config.ts`) and frontend chain setup (`wagmi` uses `arbitrumSepolia`; CoFHE config uses `arbSepolia` from `@cofhe/sdk/chains`).
- Upgrade `@cofhe/sdk`, `@cofhe/react`, `@cofhe/abi` to `^0.5.0`; bump `@fhenixprotocol/cofhe-contracts` and confirm the exported decrypt-request pattern from `FHE.sol` before coding callbacks.
- Run SDK export probes before coding Privara integration:
  - `node -e "const s=require('@reineira-os/sdk'); console.log(JSON.stringify(Object.keys(s),null,2))"`
  - Record concrete settlement-capable methods to use in app hook design.
- Migrate env templates and runtime envs (`.env`, `.env.local`, `.env.example`) to Arbitrum values and remove `11155111` references.
- Gate: install clean, chain config resolved to `421614`, CoFHE decrypt paths (`decryptForView`/`decryptForTx`) smoke-tested on Arbitrum Sepolia RPC, Reineira export map documented.

### Phase 1 — WalnutV1 contract from scratch (Days 2–4)
- Create `contracts/WalnutV1.sol` implementing all 9 feature groups exactly, with no dependency on archived Wave contracts.
- Implement internal `_computeHealthFactor(address)` with safe-debt guard and shared usage across liquidation logic.
- Enforce `onlyCoFHE` on all decrypt callbacks with request-id mappings for liquidation, winner-selection, and credit-tier updates.
- Add encrypted pool counters and maintain them on `deposit/borrow/repay/withdraw` with `FHE.allowThis` after every new encrypted handle mutation.
- Add owner controls (`onlyOwner`, pause/unpause) and `whenNotPaused` on `deposit` and `borrow`.
- Implement P2P offer lifecycle with encrypted terms and scoped read permissions (`FHE.allow`) for lender/borrower.
- Add deploy script `scripts/deploy-v1-arbitrum-sepolia.js` that deploys `WalnutV1()`, updates env contract address, and prints verify command.
- Verify on Arbiscan: `npx hardhat verify --network arbitrumSepolia <ADDRESS>`.
- Gate: compile clean, deployed on Arbitrum Sepolia, verified on Arbiscan, no sensitive plaintext in events.

### Phase 2 — Tests (Days 4–5)
- Replace Wave test coverage with `test/WalnutV1.test.js`; retire `WalnutWave2*.test.js`.
- Cover all feature groups: lending loop, liquidation callback auth, auction callback auth/settlement, credit tier updates, P2P privacy behavior, ENS aggregation, pause behavior, pool counters.
- Add explicit revert tests for non-CoFHE callers on callback functions.
- Validate no legacy functions remain callable (`submitLiquidationCheck`, `finalizeWinnerSelection`, `LTV_LIMIT`).
- Gate: `npx hardhat test` zero failures.

### Phase 3 — Frontend migration to WalnutV1 + Arbitrum (Days 4–6)
- Refactor contract client layer (`lib/walnut-contract.ts`) to single ABI/address source for WalnutV1.
- Refactor protocol hook (`hooks/use-walnut-protocol.ts`) to remove wave modes and align with new callback-driven liquidation/auction flows.
- Update chain config (`lib/web3-config.ts`) and CoFHE client chain support (`lib/cofhe-client.ts`) for Arbitrum Sepolia.
- Update dashboard (`app/app/page.tsx`) with credit tier card and pool stats card; compute LTV display from `TIER_LTV[tier]`.
- Update liquidation UI (`app/app/liquidation/page.tsx`) to remove finalize/manual submit flow and use polling on `liquidatable`.
- Create P2P UI page `app/app/p2p/page.tsx`; add nav entries for P2P and History.
- Add toast system (`components/walnut/toast-provider.tsx`) and replace inline status-only UX.
- Gate: `npm run build` clean, no suppressions, all flows pointing to WalnutV1 on chain `421614`.

### Phase 4 — Privara/Reineira real settlement integration (Days 5–6)
- Implement `hooks/use-privara.ts` as an adapter over actual `@reineira-os/sdk` exports discovered in Phase 0.
- On repay confirmation, trigger private interest settlement and capture settlement tx hash.
- On `matchOffer` confirmation, trigger private loan settlement and capture settlement tx hash.
- Surface both hashes in UI (protocol tx + settlement tx), both clickable to Arbiscan (`https://sepolia.arbiscan.io/tx/<hash>`).
- If SDK method mapping is unclear, resolve with Reineira support channel before proceeding.
- Gate: two real settlement transactions observable on Arbiscan from end-to-end UI actions.

### Phase 5 — Polish (Day 7)
- Add `app/app/history/page.tsx` from event logs for connected wallet (event type, tx hash, timestamp; no plaintext amounts).
- Finalize toasts for success/error/pending states across all critical actions.
- Rewrite README contract/network section for WalnutV1 + Arbitrum Sepolia + verification and demo steps.
- Gate: docs align with deployed reality; UI flows are coherent and demo-ready.

### Phase 6 — Demo + Buffer (Days 8–9)
- Rehearse and record complete demo on Arbitrum Sepolia: deposit, borrow, repay + settlement, credit update, liquidation auction, P2P match + settlement, ENS aggregation.
- Confirm all five FHE-differentiating primitives are explicitly shown and explained.
- Use Day 9 buffer for integration defects found during full rehearsal.

## Test Plan and Acceptance Scenarios
- **Contract correctness:** unit/integration tests for all V1 function groups, callback authorization, and event privacy constraints.
- **Privacy invariants:** assert sensitive values are never emitted; only addresses/request ids/handles appear in events.
- **Chain switch reliability:** wallet network mismatch prompt works; switch targets `421614`; RPC reads/writes succeed on Arbitrum Sepolia.
- **Frontend flow checks:** repay and P2P each show two hashes (lending + settlement), liquidation check is callback-driven polling, credit tier updates alter LTV behavior.
- **Release gates:** compile/test/build/verify all pass before demo sign-off.

## Assumptions and Defaults
- Credit tier thresholds default to prior Wave logic unless changed: tier0 `0-1`, tier1 `2-3`, tier2 `4-6`, tier3 `7-9`, tier4 `>=10`.
- Archived Wave contracts/tests/scripts are removed from active code paths; git history is the archive source of truth.
- Arbitrum Sepolia CoFHE source-of-truth is `TASK_MANAGER_ADDRESS` from `@fhenixprotocol/cofhe-contracts/FHE.sol`; funded deployer key and Privara/Reineira runtime config are provided before Phase 1 deploy and Phase 4 integration.
- Hardhat verification uses Arbiscan via `--network arbitrumSepolia`; if plugin requires, add explicit Arbiscan custom chain config.
- No mock data or fake async placeholders are allowed in final UI flows; all displayed tx hashes must be real.
- **Execution status:** plan is decision-complete and ready to execute from Phase 0 immediately on your go-ahead.
