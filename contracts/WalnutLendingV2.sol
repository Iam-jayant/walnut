// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title  WalnutLendingV2 — Privacy-Hardened Lending Protocol
/// @notice All per-user values are FHE-encrypted. Events emit NO plaintext amounts.
///         Per-loan principal is stored as euint128; only the borrower can decrypt via CoFHE permit.
/// @dev    Requires @fhenixprotocol/cofhe-contracts ^0.5, @openzeppelin/contracts ^5.

import {FHE, ebool, euint128, TASK_MANAGER_ADDRESS} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {InEuint128, ITaskManager, FunctionId} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ─── External interfaces ─────────────────────────────────────────────────────

interface IWalnutStablecoin {
    function mint(address to, InEuint128 calldata encryptedAmount) external;
    function mintInternal(address to, euint128 amount) external;
    function burn(address from, InEuint128 calldata encryptedAmount) external;
    function burnInternal(address from, euint128 amount) external returns (ebool);
}

interface IWalnutOracle {
    function getUSDValue(address token, uint256 amount) external view returns (uint256);
    function priceFeeds(address token) external view returns (address);
}

// ─── Contract ─────────────────────────────────────────────────────────────────

contract WalnutLendingV2 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Immutables ───────────────────────────────────────────────────────────
    IWalnutStablecoin public immutable stablecoin;
    IWalnutOracle     public immutable oracle;
    address           public immutable treasury;

    // ─── Ownership & pause ────────────────────────────────────────────────────
    address public owner;
    bool    public paused;

    // ─── Protocol constants ───────────────────────────────────────────────────
    uint256 public constant PRECISION         = 1e18;
    uint256 public constant SECONDS_PER_YEAR  = 365 days;
    uint256 public constant BORROW_APR        = 800;   // 8.00% in basis points
    uint256 public constant PROTOCOL_FEE_APR  = 200;   // 2.00% in basis points
    uint128 public constant LIQUIDATION_THRESHOLD = 8000; // 80% LTV

    // ─── FHE encrypted per-user state ─────────────────────────────────────────
    // PRIVATE — no public getter. Access via getEncrypted*() which returns ctHash.
    mapping(address => euint128) private _collateral;
    mapping(address => euint128) private _debt;
    mapping(address => euint128) private _repaymentCount;
    mapping(address => euint128) private _defaultCount;

    // ─── Multi-loan data model (privacy-preserving) ───────────────────────────
    struct Loan {
        uint256   loanId;
        euint128  encryptedPrincipal; // FHE-encrypted — only borrower decrypts via permit
        uint256   openedAt;
        bool      active;
        bool      principalPending;   // true until syncBorrowActive resolves
    }

    /// @dev Public-safe projection of a Loan (no encrypted types in ABI).
    struct LoanInfo {
        uint256 loanId;
        uint256 principalHandle;  // ctHash — pass to cofheClient.decryptForView()
        uint256 openedAt;
        bool    active;
        bool    principalPending;
    }

    mapping(address => Loan[])   private _loans;
    mapping(address => uint256)  public  loanCounter;

    // ─── Pending sync state (CoFHE callback relay) ────────────────────────────
    struct PendingDeposit {
        address  user;
        address  token;
    }
    struct PendingSync {
        address  user;
        uint256  loanIndex;
        euint128 encryptedAmount;
    }
    mapping(uint256 => PendingDeposit) private _pendingDeposits;
    mapping(uint256 => PendingSync) private _pendingBorrowSyncs;
    mapping(uint256 => PendingSync) private _pendingRepaySyncs;
    // ─── Liquidation State ────────────────────────────────────────────────────
    enum AuctionState { IDLE, OPEN, SELECTION_PENDING }

    struct LiquidationBid {
        address bidder;
        euint128 amount;
    }

    struct Auction {
        AuctionState state;
        uint256 endTime;
        LiquidationBid[] bids;
    }

    mapping(address => Auction) public liquidations;
    mapping(uint256 => address) public pendingLiquidationChecks;
    mapping(uint256 => address) public pendingWinnerSelections;

    // ─── Vault / deposit tracking (private) ───────────────────────────────────
    struct VaultHolding {
        address token;
        uint256 amount; // plaintext amount on-chain (ERC20 transfer is inherently public)
    }
    mapping(address => VaultHolding[]) private _vaults;

    // ─── Withdraw pending state ───────────────────────────────────────────────
    struct PendingWithdraw {
        address  user;
        address  token;
        uint256  amount;
        euint128 newCollateral;
    }
    mapping(uint256 => PendingWithdraw) private _pendingWithdraws;
    mapping(uint256 => address) public decryptRequests;

    // ─── Credit tier ──────────────────────────────────────────────────────────
    mapping(uint256 => uint16) public tierLTVs; // tier => LTV in basis points
    mapping(address => uint8)  private _creditTier;

    // ─── Plaintext aggregates (protocol-level, not per-user — acceptable) ─────
    uint256 public totalDeposited;
    uint256 public totalBorrowed;
    uint256 public totalBorrowedSyncVersion;
    mapping(uint256 => uint256) public pendingTotalBorrowedSyncVersions;

    // ─── Events (privacy-safe: NO plaintext amounts) ──────────────────────────

    event Deposited(address indexed user, address indexed token);
    event Withdrawn(address indexed user, address indexed token);
    event WithdrawFinalized(address indexed user, address indexed token, bool approved);

    event LoanOpened(address indexed user, uint256 loanId, uint256 openedAt);
    /// @notice Emitted when borrow principal is synced. principalHandle is a ctHash, NOT plaintext.
    event LoanPrincipalSynced(address indexed user, uint256 loanId, uint256 principalHandle);
    event LoanRepaid(address indexed user, uint256 loanId);
    event LoanRepayFailed(address indexed user, uint256 loanId, string reason);
    event RepaymentSettlementIntent(address indexed user, uint256 loanId);
    event BorrowCancelled(address indexed user, uint256 loanId, string reason);

    event BorrowActiveSyncRequested(address indexed user, uint256 requestId, uint256 openedAt);
    event RepayStateSyncRequested(address indexed user, uint256 requestId, uint256 loanId);
    event DepositSyncRequested(address indexed user, uint256 requestId);
    event WithdrawSyncRequested(address indexed user, uint256 requestId);
    event TotalBorrowedSyncRequested(uint256 requestId, uint256 version);
    event TotalBorrowedCacheUpdated(uint256 totalBorrowed, uint256 version);

    // Liquidation Events
    event LiquidationCheckRequested(address indexed borrower, uint256 requestId);
    event LiquidationAuctionOpened(address indexed borrower, uint256 endTime);
    event LiquidationAuctionHealthy(address indexed borrower);
    event LiquidationBidSubmitted(address indexed bidder, address indexed borrower);
    event WinnerSelectionRequested(address indexed borrower, uint256 requestId);
    event AuctionSettled(address indexed borrower, address indexed winner);

    event CreditTierUpdated(address indexed user, uint8 newTier);
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Protocol paused");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _stablecoin, address _oracle, address _treasury) {
        require(_stablecoin != address(0), "Invalid stablecoin");
        require(_oracle != address(0), "Invalid oracle");
        require(_treasury != address(0), "Invalid treasury");
        stablecoin = IWalnutStablecoin(_stablecoin);
        oracle     = IWalnutOracle(_oracle);
        treasury   = _treasury;
        owner      = msg.sender;

        // Default credit tiers
        tierLTVs[0] = 7000;  // 70% LTV — base tier
        tierLTVs[1] = 7500;  // 75% LTV
        tierLTVs[2] = 8000;  // 80% LTV
        tierLTVs[3] = 8500;  // 85% LTV — highest tier
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SAFE FHE HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    function _safeEncrypted(euint128 val) internal returns (euint128) {
        if (!FHE.isInitialized(val)) {
            euint128 zero = FHE.asEuint128(0);
            FHE.allowThis(zero);
            return zero;
        }
        return val;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DEPOSIT
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Deposit collateral. Amount is encrypted — never plaintext in calldata or events.
    function deposit(address token, InEuint128 calldata encryptedAmount) external nonReentrant whenNotPaused {
        require(token != address(0), "Invalid token");

        // Decrypt the amount to perform the ERC20 transfer (inherently public).
        // This is the documented wrap-boundary caveat: the ERC20 transfer itself
        // reveals the amount. Full privacy requires a shielded entry (future work).
        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);

        // Create a decrypt request to learn the deposit amount for the ERC20 transfer
        uint256 requestId = _requestDecrypt(amount);
        _pendingDeposits[requestId] = PendingDeposit({
            user: msg.sender,
            token: token
        });

        emit Deposited(msg.sender, token);
        emit DepositSyncRequested(msg.sender, requestId);
    }

    /// @notice CoFHE callback: finalize deposit by transferring ERC20 and updating encrypted collateral.
    function syncDepositTransfer(
        bytes32 ciphertext,
        uint128 result,
        bytes calldata signature
    ) external nonReentrant {
        uint256 requestId = uint256(ciphertext);
        PendingDeposit memory pd = _pendingDeposits[requestId];
        require(pd.user != address(0), "Unknown decrypt request");
        delete _pendingDeposits[requestId];

        // Verify with TaskManager
        ITaskManager(TASK_MANAGER_ADDRESS).verifyDecryptResult(uint256(ciphertext), uint256(result), signature);

        uint256 amount = uint256(result);
        require(amount > 0, "Zero deposit");

        address user = pd.user;
        address token = pd.token;

        // Transfer ERC20 from user
        IERC20(token).safeTransferFrom(user, address(this), amount);

        // Update vault
        _addToVault(user, token, amount);

        // Update encrypted collateral (USD value)
        uint256 usdValue = oracle.getUSDValue(token, amount);
        euint128 encryptedUSD = FHE.asEuint128(uint128(usdValue));
        FHE.allowThis(encryptedUSD);

        euint128 currentCollateral = _safeEncrypted(_collateral[user]);
        euint128 newCollateral = FHE.add(currentCollateral, encryptedUSD);
        FHE.allowThis(newCollateral);
        FHE.allow(newCollateral, user); // Only user can decrypt
        _collateral[user] = newCollateral;

        totalDeposited += amount;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BORROW
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Borrow cUSDC. Amount is encrypted.
    function borrow(InEuint128 calldata encryptedAmount) external nonReentrant whenNotPaused {
        require(liquidations[msg.sender].state == AuctionState.IDLE, "Active liquidation");
        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);

        // Add encrypted debt
        euint128 currentDebt = _safeEncrypted(_debt[msg.sender]);
        euint128 newDebt = FHE.add(currentDebt, amount);
        FHE.allowThis(newDebt);
        FHE.allow(newDebt, msg.sender);
        _debt[msg.sender] = newDebt;

        // Create loan record with encrypted principal
        uint256 loanId = loanCounter[msg.sender]++;
        _loans[msg.sender].push(Loan({
            loanId: loanId,
            encryptedPrincipal: amount, // FHE-encrypted — only borrower decrypts
            openedAt: block.timestamp,
            active: true,
            principalPending: true
        }));

        // Allow borrower to decrypt their own principal handle
        FHE.allow(amount, msg.sender);

        // Mint cUSDC to borrower (stablecoin uses FHE internally)
        FHE.allow(amount, address(stablecoin));
        stablecoin.mintInternal(msg.sender, amount);

        // Request decrypt for the sync callback (to update totalBorrowed aggregate)
        uint256 requestId = _requestDecrypt(amount);
        _pendingBorrowSyncs[requestId] = PendingSync({
            user: msg.sender,
            loanIndex: _loans[msg.sender].length - 1,
            encryptedAmount: amount
        });

        emit LoanOpened(msg.sender, loanId, block.timestamp);
        emit BorrowActiveSyncRequested(msg.sender, requestId, block.timestamp);
    }

    /// @notice CoFHE callback: finalize borrow by setting plaintext tracking and emitting handle.
    function syncBorrowActive(
        bytes32 ciphertext,
        uint128 result,
        bytes calldata signature
    ) external nonReentrant {
        uint256 requestId = uint256(ciphertext);
        PendingSync memory sync = _pendingBorrowSyncs[requestId];
        require(sync.user != address(0), "Unknown borrow sync");
        delete _pendingBorrowSyncs[requestId];

        ITaskManager(TASK_MANAGER_ADDRESS).verifyDecryptResult(uint256(ciphertext), uint256(result), signature);

        Loan storage loan = _loans[sync.user][sync.loanIndex];
        loan.principalPending = false;

        // Update plaintext aggregate
        totalBorrowed += uint256(result);

        // Emit the ctHash of the encrypted principal — NOT the plaintext value.
        // The frontend uses this handle with cofheClient.decryptForView() + permit.
        uint256 principalHandle = uint256(euint128.unwrap(loan.encryptedPrincipal));
        emit LoanPrincipalSynced(sync.user, loan.loanId, principalHandle);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REPAY
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Repay a loan. Amount is encrypted.
    function repay(InEuint128 calldata encryptedAmount, uint256 loanIndex) external nonReentrant whenNotPaused {
        require(liquidations[msg.sender].state == AuctionState.IDLE, "Active liquidation");
        require(loanIndex < _loans[msg.sender].length, "Invalid loan index");
        Loan storage loan = _loans[msg.sender][loanIndex];
        require(loan.active, "Loan not active");
        require(!loan.principalPending, "Loan principal still syncing");

        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);

        // Burn cUSDC from borrower
        FHE.allow(amount, address(stablecoin));
        ebool burnSuccess = stablecoin.burnInternal(msg.sender, amount);
        FHE.allowThis(burnSuccess);

        // Reduce debt (branchless: only reduce if burn succeeded)
        euint128 currentDebt = _safeEncrypted(_debt[msg.sender]);
        euint128 zero = FHE.asEuint128(0);
        FHE.allowThis(zero);
        euint128 debtReduction = FHE.select(burnSuccess, amount, zero);
        FHE.allowThis(debtReduction);
        euint128 newDebt = FHE.sub(currentDebt, debtReduction);
        FHE.allowThis(newDebt);
        FHE.allow(newDebt, msg.sender);
        _debt[msg.sender] = newDebt;

        // Mark loan as repaid
        loan.active = false;

        // Increment repayment count
        euint128 currentRepayCount = _safeEncrypted(_repaymentCount[msg.sender]);
        euint128 one = FHE.asEuint128(1);
        FHE.allowThis(one);
        euint128 newRepayCount = FHE.add(currentRepayCount, one);
        FHE.allowThis(newRepayCount);
        FHE.allow(newRepayCount, msg.sender);
        _repaymentCount[msg.sender] = newRepayCount;

        // Request decrypt for settlement callback
        uint256 requestId = _requestDecrypt(amount);
        _pendingRepaySyncs[requestId] = PendingSync({
            user: msg.sender,
            loanIndex: loanIndex,
            encryptedAmount: amount
        });

        emit RepayStateSyncRequested(msg.sender, requestId, loan.loanId);
    }

    /// @notice CoFHE callback: finalize repay.
    function syncLoanRepay(
        bytes32 ciphertext,
        uint128 result,
        bytes calldata signature
    ) external nonReentrant {
        uint256 requestId = uint256(ciphertext);
        PendingSync memory sync = _pendingRepaySyncs[requestId];
        require(sync.user != address(0), "Unknown repay sync");
        delete _pendingRepaySyncs[requestId];

        ITaskManager(TASK_MANAGER_ADDRESS).verifyDecryptResult(uint256(ciphertext), uint256(result), signature);

        // Update plaintext aggregate
        if (totalBorrowed >= uint256(result)) {
            totalBorrowed -= uint256(result);
        }

        Loan storage loan = _loans[sync.user][sync.loanIndex];

        // Emit settlement intent — NO amounts, only metadata
        emit LoanRepaid(sync.user, loan.loanId);
        emit RepaymentSettlementIntent(sync.user, loan.loanId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // WITHDRAW
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Withdraw collateral. Amount is encrypted.
    function withdraw(address token, InEuint128 calldata encryptedAmount) external nonReentrant whenNotPaused {
        require(liquidations[msg.sender].state == AuctionState.IDLE, "Active liquidation");
        require(token != address(0), "Invalid token");

        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);

        // Reduce encrypted collateral
        euint128 currentCollateral = _safeEncrypted(_collateral[msg.sender]);
        euint128 newCollateral = FHE.sub(currentCollateral, amount);
        FHE.allowThis(newCollateral);
        FHE.allow(newCollateral, msg.sender);
        _collateral[msg.sender] = newCollateral;

        // Request decrypt to perform ERC20 transfer
        uint256 requestId = _requestDecrypt(amount);
        _pendingWithdraws[requestId] = PendingWithdraw({
            user: msg.sender,
            token: token,
            amount: 0, // set in callback
            newCollateral: newCollateral
        });

        emit Withdrawn(msg.sender, token);
        emit WithdrawSyncRequested(msg.sender, requestId);
    }

    /// @notice CoFHE callback: finalize withdraw.
    function syncWithdrawTransfer(
        bytes32 ciphertext,
        uint128 result,
        bytes calldata signature
    ) external nonReentrant {
        uint256 requestId = uint256(ciphertext);
        PendingWithdraw storage pw = _pendingWithdraws[requestId];
        require(pw.user != address(0), "Unknown withdraw sync");

        ITaskManager(TASK_MANAGER_ADDRESS).verifyDecryptResult(uint256(ciphertext), uint256(result), signature);

        uint256 amount = uint256(result);
        address user = pw.user;
        address token = pw.token;
        delete _pendingWithdraws[requestId];

        if (amount > 0) {
            _removeFromVault(user, token, amount);
            IERC20(token).safeTransfer(user, amount);

            if (totalDeposited >= amount) {
                totalDeposited -= amount;
            }

            emit WithdrawFinalized(user, token, true);
        } else {
            emit WithdrawFinalized(user, token, false);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SEALED-BID LIQUIDATION
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Request a liquidation check on a borrower.
    function requestLiquidationCheck(address borrower) external whenNotPaused {
        Auction storage auc = liquidations[borrower];
        require(auc.state == AuctionState.IDLE, "Auction not idle");
        
        euint128 debt = _safeEncrypted(_debt[borrower]);
        euint128 collateral = _safeEncrypted(_collateral[borrower]);
        
        // debt * 10000 >= collateral * LIQUIDATION_THRESHOLD
        euint128 const10000 = FHE.asEuint128(10000);
        euint128 constThreshold = FHE.asEuint128(LIQUIDATION_THRESHOLD);
        euint128 debtScaled = FHE.mul(debt, const10000);
        euint128 collateralScaled = FHE.mul(collateral, constThreshold);
        ebool isLiquidatable = FHE.gte(debtScaled, collateralScaled);
        
        FHE.allowThis(isLiquidatable);
        euint128 isLiq128 = FHE.asEuint128(isLiquidatable);
        
        uint256 reqId = _requestDecrypt(isLiq128);
        pendingLiquidationChecks[reqId] = borrower;
        emit LiquidationCheckRequested(borrower, reqId);
    }

    /// @notice CoFHE callback for liquidation check.
    function syncLiquidationCheck(
        bytes32 ciphertext,
        uint128 result,
        bytes calldata signature
    ) external {
        uint256 reqId = uint256(ciphertext);
        address borrower = pendingLiquidationChecks[reqId];
        require(borrower != address(0), "Unknown check");
        delete pendingLiquidationChecks[reqId];

        ITaskManager(TASK_MANAGER_ADDRESS).verifyDecryptResult(uint256(ciphertext), uint256(result), signature);

        if (result == 1) {
            liquidations[borrower].state = AuctionState.OPEN;
            liquidations[borrower].endTime = block.timestamp + 10 minutes;
            delete liquidations[borrower].bids;
            emit LiquidationAuctionOpened(borrower, liquidations[borrower].endTime);
        } else {
            emit LiquidationAuctionHealthy(borrower);
        }
    }

    /// @notice Submit an encrypted liquidation bid.
    function submitLiquidationBid(address borrower, InEuint128 calldata encryptedAmount) external nonReentrant whenNotPaused {
        Auction storage auc = liquidations[borrower];
        require(auc.state == AuctionState.OPEN, "Auction not open");
        require(block.timestamp <= auc.endTime, "Auction ended");
        require(auc.bids.length < 10, "Max bids reached");

        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);
        
        // Escrow funds by burning from bidder
        FHE.allow(amount, address(stablecoin));
        ebool burnSuccess = stablecoin.burnInternal(msg.sender, amount);
        FHE.allowThis(burnSuccess);
        
        euint128 zero = FHE.asEuint128(0);
        FHE.allowThis(zero);
        euint128 validAmount = FHE.select(burnSuccess, amount, zero);
        FHE.allowThis(validAmount);
        
        auc.bids.push(LiquidationBid({
            bidder: msg.sender,
            amount: validAmount
        }));
        
        emit LiquidationBidSubmitted(msg.sender, borrower);
    }

    /// @notice Request winner selection after auction ends.
    function selectWinningBid(address borrower) external {
        Auction storage auc = liquidations[borrower];
        require(auc.state == AuctionState.OPEN, "Auction not open");
        require(block.timestamp > auc.endTime || auc.bids.length >= 10, "Auction still running");

        auc.state = AuctionState.SELECTION_PENDING;

        if (auc.bids.length == 0) {
            auc.state = AuctionState.IDLE;
            return;
        }

        euint128 maxBid = FHE.asEuint128(0);
        euint128 winnerIdx = FHE.asEuint128(0);
        FHE.allowThis(maxBid);
        FHE.allowThis(winnerIdx);

        for (uint8 i = 0; i < auc.bids.length; i++) {
            euint128 iEnc = FHE.asEuint128(i);
            FHE.allowThis(iEnc);
            ebool isNewMax = FHE.gt(auc.bids[i].amount, maxBid);
            maxBid = FHE.select(isNewMax, auc.bids[i].amount, maxBid);
            winnerIdx = FHE.select(isNewMax, iEnc, winnerIdx);
            FHE.allowThis(maxBid);
            FHE.allowThis(winnerIdx);
        }

        uint256 reqId = _requestDecrypt(winnerIdx);
        pendingWinnerSelections[reqId] = borrower;
        emit WinnerSelectionRequested(borrower, reqId);
    }

    /// @notice CoFHE callback to finalize winner selection and apply state changes.
    function syncWinnerSelection(
        bytes32 ciphertext,
        uint128 result,
        bytes calldata signature
    ) external nonReentrant {
        uint256 reqId = uint256(ciphertext);
        address borrower = pendingWinnerSelections[reqId];
        require(borrower != address(0), "Unknown winner selection");
        delete pendingWinnerSelections[reqId];

        ITaskManager(TASK_MANAGER_ADDRESS).verifyDecryptResult(uint256(ciphertext), uint256(result), signature);

        Auction storage auc = liquidations[borrower];
        uint256 winnerIdx = uint256(result);
        
        address winner = address(0);
        if (winnerIdx < auc.bids.length) {
            winner = auc.bids[winnerIdx].bidder;
            euint128 winningBidAmt = auc.bids[winnerIdx].amount;

            // 1. Reduce Debt (Bad Debt Handling)
            euint128 currentDebt = _safeEncrypted(_debt[borrower]);
            ebool isBidGreaterThanDebt = FHE.gt(winningBidAmt, currentDebt);
            
            euint128 zero = FHE.asEuint128(0);
            FHE.allowThis(zero);
            euint128 debtReduction = FHE.select(isBidGreaterThanDebt, currentDebt, winningBidAmt);
            FHE.allowThis(debtReduction);
            
            euint128 newDebt = FHE.sub(currentDebt, debtReduction);
            FHE.allowThis(newDebt);
            FHE.allow(newDebt, borrower);
            _debt[borrower] = newDebt;

            // Surplus Handling
            euint128 surplus = FHE.sub(winningBidAmt, debtReduction);
            FHE.allowThis(surplus);
            // stablecoin.mintInternal uses FHE internally
            FHE.allow(surplus, address(stablecoin));
            stablecoin.mintInternal(borrower, surplus);

            // 2. Seize Collateral
            euint128 currentCollateral = _safeEncrypted(_collateral[borrower]);
            euint128 winnerCollateral = _safeEncrypted(_collateral[winner]);
            
            euint128 newWinnerCollateral = FHE.add(winnerCollateral, currentCollateral);
            FHE.allowThis(newWinnerCollateral);
            FHE.allow(newWinnerCollateral, winner);
            _collateral[winner] = newWinnerCollateral;

            // Zero out borrower's collateral
            FHE.allow(zero, borrower);
            _collateral[borrower] = zero;
        }

        // 3. Refund Losers
        for (uint256 i = 0; i < auc.bids.length; i++) {
            if (i != winnerIdx) {
                // Refund bid amount
                euint128 refundAmt = auc.bids[i].amount;
                FHE.allow(refundAmt, address(stablecoin));
                stablecoin.mintInternal(auc.bids[i].bidder, refundAmt);
            }
        }

        auc.state = AuctionState.IDLE;
        emit AuctionSettled(borrower, winner);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TOTAL BORROWED SYNC
    // ═══════════════════════════════════════════════════════════════════════════

    function syncTotalBorrowed(
        bytes32 ciphertext,
        uint128 result,
        bytes calldata signature
    ) external {
        ITaskManager(TASK_MANAGER_ADDRESS).verifyDecryptResult(uint256(ciphertext), uint256(result), signature);
        uint256 requestId = uint256(ciphertext);
        uint256 version = pendingTotalBorrowedSyncVersions[requestId];
        if (version > 0) {
            delete pendingTotalBorrowedSyncVersions[requestId];
            totalBorrowed = uint256(result);
            emit TotalBorrowedCacheUpdated(totalBorrowed, version);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CREDIT TIER
    // ═══════════════════════════════════════════════════════════════════════════

    event CreditCountSyncRequested(address indexed user, uint256 requestId);

    /// @notice Request a credit tier update (triggers async repayment count decrypt).
    function requestCreditTierUpdate(address user) external whenNotPaused {
        euint128 repayCount = _safeEncrypted(_repaymentCount[user]);
        uint256 requestId = _requestDecrypt(repayCount);
        decryptRequests[requestId] = user;
        emit CreditCountSyncRequested(user, requestId);
    }

    /// @notice CoFHE callback: finalize credit tier from decrypted repayment count.
    function syncCreditCount(
        bytes32 ciphertext,
        uint128 result,
        bytes calldata signature
    ) external {
        uint256 requestId = uint256(ciphertext);
        address user = decryptRequests[requestId];
        require(user != address(0), "Unknown credit sync");
        delete decryptRequests[requestId];

        ITaskManager(TASK_MANAGER_ADDRESS).verifyDecryptResult(uint256(ciphertext), uint256(result), signature);

        uint256 repayCount = uint256(result);
        uint8 tier;
        if (repayCount >= 10) tier = 3;
        else if (repayCount >= 5) tier = 2;
        else if (repayCount >= 2) tier = 1;
        else tier = 0;

        _creditTier[user] = tier;
        emit CreditTierUpdated(user, tier);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS (privacy-preserving)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Get encrypted collateral handle. Returns bytes32 ctHash for permit-based decrypt.
    function getEncryptedCollateral(address user) external view returns (bytes32) {
        return euint128.unwrap(_collateral[user]);
    }

    /// @notice Get encrypted debt handle.
    function getEncryptedDebt(address user) external view returns (bytes32) {
        return euint128.unwrap(_debt[user]);
    }

    /// @notice Get encrypted repayment count handle.
    function getEncryptedRepaymentCount(address user) external view returns (bytes32) {
        return euint128.unwrap(_repaymentCount[user]);
    }

    /// @notice Get encrypted default count handle.
    function getEncryptedDefaultCount(address user) external view returns (bytes32) {
        return euint128.unwrap(_defaultCount[user]);
    }

    /// @notice Get all loans for msg.sender. Returns LoanInfo[] with principalHandle (ctHash) — NOT plaintext.
    function getLoans() external view returns (LoanInfo[] memory) {
        Loan[] storage userLoans = _loans[msg.sender];
        LoanInfo[] memory result = new LoanInfo[](userLoans.length);
        for (uint256 i = 0; i < userLoans.length; i++) {
            result[i] = LoanInfo({
                loanId: userLoans[i].loanId,
                principalHandle: uint256(euint128.unwrap(userLoans[i].encryptedPrincipal)),
                openedAt: userLoans[i].openedAt,
                active: userLoans[i].active,
                principalPending: userLoans[i].principalPending
            });
        }
        return result;
    }

    /// @notice Get active loans for msg.sender.
    function getActiveLoans() external view returns (LoanInfo[] memory activeLoans, uint256[] memory indices) {
        Loan[] storage userLoans = _loans[msg.sender];
        uint256 activeCount = 0;
        for (uint256 i = 0; i < userLoans.length; i++) {
            if (userLoans[i].active) activeCount++;
        }

        activeLoans = new LoanInfo[](activeCount);
        indices = new uint256[](activeCount);
        uint256 j = 0;
        for (uint256 i = 0; i < userLoans.length; i++) {
            if (userLoans[i].active) {
                activeLoans[j] = LoanInfo({
                    loanId: userLoans[i].loanId,
                    principalHandle: uint256(euint128.unwrap(userLoans[i].encryptedPrincipal)),
                    openedAt: userLoans[i].openedAt,
                    active: true,
                    principalPending: userLoans[i].principalPending
                });
                indices[j] = i;
                j++;
            }
        }
    }

    /// @notice Check if user has any active loan.
    function hasActiveLoan(address user) external view returns (bool) {
        Loan[] storage userLoans = _loans[user];
        for (uint256 i = 0; i < userLoans.length; i++) {
            if (userLoans[i].active) return true;
        }
        return false;
    }

    /// @notice Protocol utilization rate in basis points.
    function utilizationRate() external view returns (uint256) {
        if (totalDeposited == 0) return 0;
        return (totalBorrowed * 10000) / totalDeposited;
    }

    /// @notice Current borrow rate (constant for V2).
    function currentBorrowRate() external pure returns (uint256) {
        return BORROW_APR;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════════════════════

    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setTierLTV(uint256 tier, uint16 ltv) external onlyOwner {
        require(ltv <= 10000, "LTV > 100%");
        tierLTVs[tier] = ltv;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INTERNAL HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    function _requestDecrypt(euint128 value) internal returns (uint256) {
        FHE.allowThis(value);
        FHE.allow(value, msg.sender);
        return uint256(euint128.unwrap(value));
    }

    function _getOrCreateVaultToken(address user) internal view returns (address) {
        if (_vaults[user].length > 0) {
            return _vaults[user][0].token;
        }
        return address(0);
    }

    function _addToVault(address user, address token, uint256 amount) internal {
        VaultHolding[] storage holdings = _vaults[user];
        for (uint256 i = 0; i < holdings.length; i++) {
            if (holdings[i].token == token) {
                holdings[i].amount += amount;
                return;
            }
        }
        holdings.push(VaultHolding({token: token, amount: amount}));
    }

    function _removeFromVault(address user, address token, uint256 amount) internal {
        VaultHolding[] storage holdings = _vaults[user];
        for (uint256 i = 0; i < holdings.length; i++) {
            if (holdings[i].token == token) {
                if (holdings[i].amount >= amount) {
                    holdings[i].amount -= amount;
                } else {
                    holdings[i].amount = 0;
                }
                return;
            }
        }
    }
}
