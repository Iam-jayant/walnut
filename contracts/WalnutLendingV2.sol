// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title  WalnutLendingV2 — Privacy-Hardened Lending Protocol
/// @notice All per-user values are FHE-encrypted. Events emit NO plaintext amounts.
///         Per-loan principal is stored as euint128; only the borrower can decrypt via CoFHE permit.
/// @dev    Requires @fhenixprotocol/cofhe-contracts ^0.5, @openzeppelin/contracts ^5.

import {FHE, ebool, euint8, euint64, euint128, TASK_MANAGER_ADDRESS} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {InEuint64, InEuint128, ITaskManager, FunctionId} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

// ─── External interfaces ─────────────────────────────────────────────────────

interface IWalnutStablecoin {
    function mint(address to, InEuint128 calldata encryptedAmount) external;
    function mintInternal(address to, euint128 amount) external;
    function burn(address from, InEuint128 calldata encryptedAmount) external;
    function burnInternal(address from, euint128 amount) external returns (ebool);
}

interface IWalnutVaultWrapper {
    function confidentialTransferFrom(address from, address to, euint64 amount) external returns (euint64);
    function confidentialTransfer(address to, euint64 amount) external returns (euint64);
    function underlying() external view returns (address);
}

interface IWalnutOracle {
    function getUSDValue(address token, uint256 amount) external view returns (uint256);
    function priceFeeds(address token) external view returns (address);
}

// ─── Contract ─────────────────────────────────────────────────────────────────

contract WalnutLendingV2 is ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    // ─── Immutables ───────────────────────────────────────────────────────────
    IWalnutStablecoin public immutable stablecoin;
    IWalnutOracle     public immutable oracle;
    address           public immutable treasury;

    // ─── Ownership & pause ────────────────────────────────────────────────────
    address public owner;
    bool    public paused;

    // ─── Collateral config ────────────────────────────────────────────────────
    address public wUSDC_address;

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
    struct PendingSync {
        address  user;
        uint256  loanIndex;
        euint128 encryptedAmount;
    }
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

    struct PendingValidCheck {
        address borrower;
        euint128 winnerIdx;
    }

    mapping(address => Auction) public liquidations;
    mapping(uint256 => address) public pendingLiquidationChecks;
    mapping(uint256 => PendingValidCheck) private pendingAuctionValidations;
    mapping(uint256 => address) public pendingWinnerSelections;

    // ─── Vault / deposit tracking (private) ───────────────────────────────────
    // Removed plaintext `_vaults` tracker for privacy. Collateral is tracked fully encrypted in `_collateral`.

    // ─── Withdraw pending state ───────────────────────────────────────────────
    // Removed pending states for withdraw and decryptRequests.

    // ─── Credit tier ──────────────────────────────────────────────────────────
    mapping(uint256 => uint16) public tierLTVs; // tier => LTV in basis points
    mapping(address => euint8) private _creditTier;

    // ─── ENS Wallet Aggregation ─────────────────────────────────────────────────
    mapping(address => uint256) public nonces;
    mapping(address => address) public primaryWalletOf;
    mapping(address => address[]) public linkedWallets;

    bytes32 public constant LINK_WALLET_TYPEHASH = keccak256("LinkWallet(address primary,address secondary,uint256 nonce,string consentMessage)");

    struct PendingUnlink {
        address primary;
        address secondary;
    }
    mapping(uint256 => PendingUnlink) public pendingUnlinks;

    // ─── Encrypted aggregates ─────────────────────────────────────────────────
    euint128 private _totalDeposited;
    euint128 private _totalBorrowed;

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
    event TotalBorrowedSyncRequested(uint256 requestId, uint256 version);
    event TotalBorrowedCacheUpdated(uint256 totalBorrowed, uint256 version);

    // Liquidation Events
    event LiquidationCheckRequested(address indexed borrower, uint256 requestId);
    event LiquidationAuctionOpened(address indexed borrower, uint256 endTime);
    event LiquidationAuctionHealthy(address indexed borrower);
    event LiquidationBidSubmitted(address indexed bidder, address indexed borrower);
    event LiquidationValidCheckRequested(address indexed borrower, uint256 requestId);
    event LiquidationAuctionFailed(address indexed borrower);
    event WinnerSelectionRequested(address indexed borrower, uint256 requestId);
    event AuctionSettled(address indexed borrower, address indexed winner);

    // ENS Aggregation Events
    event WalletLinked(address indexed primary, address indexed secondary);
    event UnlinkRequested(address indexed primary, address indexed secondary, uint256 requestId);
    event WalletUnlinked(address indexed primary, address indexed secondary);

    event CreditTierUpdated(address indexed user, bytes32 newTierCtHash);
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

    constructor(address _stablecoin, address _oracle, address _treasury) EIP712("WalnutLending", "2") {
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
    function deposit(address token, InEuint64 calldata encryptedAmount) external nonReentrant whenNotPaused {
        require(token != address(0), "Invalid token");

        euint64 amountE64 = FHE.asEuint64(encryptedAmount);
        FHE.allowThis(amountE64);
        FHE.allowTransient(amountE64, token);

        // Shielded entry: Pull wUSDC from user directly in ciphertext
        IWalnutVaultWrapper(token).confidentialTransferFrom(msg.sender, address(this), amountE64);

        // Cast to euint128 for protocol-wide internal accounting
        euint128 amountE128 = FHE.asEuint128(amountE64);
        FHE.allowThis(amountE128);

        // Update encrypted collateral in raw wUSDC units
        euint128 currentCollateral = _safeEncrypted(_collateral[msg.sender]);
        euint128 newCollateral = FHE.add(currentCollateral, amountE128);
        FHE.allowThis(newCollateral);
        FHE.allow(newCollateral, msg.sender);
        _collateral[msg.sender] = newCollateral;

        // Update encrypted totalDeposited aggregate
        euint128 currentTotalDeposited = _safeEncrypted(_totalDeposited);
        euint128 newTotalDeposited = FHE.add(currentTotalDeposited, amountE128);
        FHE.allowThis(newTotalDeposited);
        _totalDeposited = newTotalDeposited;

        emit Deposited(msg.sender, token);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BORROW
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Borrow cUSDC. Amount is encrypted.
    function borrow(InEuint128 calldata encryptedAmount) external nonReentrant whenNotPaused {
        require(liquidations[msg.sender].state == AuctionState.IDLE, "Active liquidation");
        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);

        // Compute health factor homomorphically BEFORE applying debt
        euint128 totalCollateral = _getAggregatedCollateral(msg.sender);
        euint128 totalDebt = _getAggregatedDebt(msg.sender);

        euint128 newTotalDebt = FHE.add(totalDebt, amount);
        FHE.allowThis(newTotalDebt);

        require(wUSDC_address != address(0), "wUSDC not set");
        address underlyingToken = IWalnutVaultWrapper(wUSDC_address).underlying();
        uint256 colMultiplier = LIQUIDATION_THRESHOLD * oracle.getUSDValue(underlyingToken, 1e6);
        euint128 constDebtScale = FHE.asEuint128(uint128(10000 * 1e6));
        euint128 constThreshold = FHE.asEuint128(uint128(colMultiplier));

        euint128 debtScaled = FHE.mul(newTotalDebt, constDebtScale);
        euint128 collateralScaled = FHE.mul(totalCollateral, constThreshold);

        ebool isHealthy = FHE.lte(debtScaled, collateralScaled);
        FHE.allowThis(isHealthy);

        euint128 zero = FHE.asEuint128(0);
        FHE.allowThis(zero);

        euint128 validAmount = FHE.select(isHealthy, amount, zero);
        FHE.allowThis(validAmount);

        // Add encrypted debt using validAmount
        euint128 currentDebt = _safeEncrypted(_debt[msg.sender]);
        euint128 actualNewDebt = FHE.add(currentDebt, validAmount);
        FHE.allowThis(actualNewDebt);
        FHE.allow(actualNewDebt, msg.sender);
        _debt[msg.sender] = actualNewDebt;

        // Update encrypted totalBorrowed aggregate
        euint128 currentTotalBorrowed = _safeEncrypted(_totalBorrowed);
        euint128 newTotalBorrowed = FHE.add(currentTotalBorrowed, validAmount);
        FHE.allowThis(newTotalBorrowed);
        _totalBorrowed = newTotalBorrowed;

        // Create loan record with encrypted principal
        uint256 loanId = loanCounter[msg.sender]++;
        _loans[msg.sender].push(Loan({
            loanId: loanId,
            encryptedPrincipal: validAmount, // FHE-encrypted — only borrower decrypts
            openedAt: block.timestamp,
            active: true,
            principalPending: false
        }));

        // Allow borrower to decrypt their own principal handle
        FHE.allow(validAmount, msg.sender);

        // Mint cUSDC to borrower (stablecoin uses FHE internally)
        FHE.allowTransient(validAmount, address(stablecoin));
        stablecoin.mintInternal(msg.sender, validAmount);

        emit LoanOpened(msg.sender, loanId, block.timestamp);
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

        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);

        euint128 currentDebt = _safeEncrypted(_debt[msg.sender]);
        euint128 zero = FHE.asEuint128(0);
        FHE.allowThis(zero);

        // Cap repayment amount at current user debt to prevent homomorphic underflow
        ebool exceedsDebt = FHE.gt(amount, currentDebt);
        euint128 cappedAmount = FHE.select(exceedsDebt, currentDebt, amount);
        FHE.allowThis(cappedAmount);

        // Burn cUSDC from borrower
        FHE.allowTransient(cappedAmount, address(stablecoin));
        ebool burnSuccess = stablecoin.burnInternal(msg.sender, cappedAmount);
        FHE.allowThis(burnSuccess);

        // Calculate actual debt reduction (branchless: only reduce if burn succeeded)
        euint128 debtReduction = FHE.select(burnSuccess, cappedAmount, zero);
        FHE.allowThis(debtReduction);

        // Reduce user debt
        euint128 newDebt = FHE.sub(currentDebt, debtReduction);
        FHE.allowThis(newDebt);
        FHE.allow(newDebt, msg.sender);
        _debt[msg.sender] = newDebt;

        // Reduce global totalBorrowed
        euint128 currentTotalBorrowed = _safeEncrypted(_totalBorrowed);
        euint128 newTotalBorrowed = FHE.sub(currentTotalBorrowed, debtReduction);
        FHE.allowThis(newTotalBorrowed);
        _totalBorrowed = newTotalBorrowed;

        // Increment repayment count ONLY if burn succeeded AND amount > 0 (prevents credit farming)
        ebool isNonZeroRepay = FHE.gt(cappedAmount, zero);
        ebool validRepay = FHE.and(burnSuccess, isNonZeroRepay);
        FHE.allowThis(validRepay);

        euint128 currentRepayCount = _safeEncrypted(_repaymentCount[msg.sender]);
        euint128 one = FHE.asEuint128(1);
        FHE.allowThis(one);
        euint128 countToAdd = FHE.select(validRepay, one, zero);
        FHE.allowThis(countToAdd);
        euint128 newRepayCount = FHE.add(currentRepayCount, countToAdd);
        FHE.allowThis(newRepayCount);
        FHE.allow(newRepayCount, msg.sender);
        _repaymentCount[msg.sender] = newRepayCount;

        // Evaluate credit tier homomorphically
        // Tier 3: >= 10, Tier 2: >= 5, Tier 1: >= 2, Tier 0: < 2
        ebool isTier3 = FHE.gte(newRepayCount, FHE.asEuint128(10));
        ebool isTier2 = FHE.gte(newRepayCount, FHE.asEuint128(5));
        ebool isTier1 = FHE.gte(newRepayCount, FHE.asEuint128(2));

        euint8 t3 = FHE.asEuint8(3);
        euint8 t2 = FHE.asEuint8(2);
        euint8 t1 = FHE.asEuint8(1);
        euint8 t0 = FHE.asEuint8(0);

        euint8 tier = FHE.select(isTier3, t3, 
                        FHE.select(isTier2, t2, 
                            FHE.select(isTier1, t1, t0)
                        )
                      );
        
        FHE.allowThis(tier);
        FHE.allow(tier, msg.sender);
        _creditTier[msg.sender] = tier;

        emit CreditTierUpdated(msg.sender, euint8.unwrap(tier));

        // Request decrypt for a SINGLE BOOLEAN (burnSuccess) to safely flip loan.active
        euint128 success128 = FHE.asEuint128(burnSuccess);
        FHE.allowThis(success128);
        uint256 requestId = _requestDecrypt(success128);
        _pendingRepaySyncs[requestId] = PendingSync({
            user: msg.sender,
            loanIndex: loanIndex,
            encryptedAmount: zero
        });

        emit RepayStateSyncRequested(msg.sender, requestId, loan.loanId);
    }

    /// @notice CoFHE callback: flip loan.active if burn succeeded (single boolean decrypt, no amount leak).
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

        Loan storage loan = _loans[sync.user][sync.loanIndex];
        if (result > 0) {
            loan.active = false;
        }

        emit LoanRepaid(sync.user, loan.loanId);
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

        euint128 zero = FHE.asEuint128(0);
        FHE.allowThis(zero);

        // 1. Cap amount at own collateral to prevent homomorphic underflow
        euint128 currentOwnCollateral = _safeEncrypted(_collateral[msg.sender]);
        ebool hasEnoughOwn = FHE.lte(amount, currentOwnCollateral);
        euint128 cappedAmount = FHE.select(hasEnoughOwn, amount, zero);
        FHE.allowThis(cappedAmount);

        // 2. Validate health factor with cappedAmount
        euint128 totalCollateral = _getAggregatedCollateral(msg.sender);
        euint128 totalDebt = _getAggregatedDebt(msg.sender);

        euint128 newTotalCollateral = FHE.sub(totalCollateral, cappedAmount);
        FHE.allowThis(newTotalCollateral);

        address underlyingToken = IWalnutVaultWrapper(token).underlying();
        uint256 colMultiplier = LIQUIDATION_THRESHOLD * oracle.getUSDValue(underlyingToken, 1e6);
        euint128 constDebtScale = FHE.asEuint128(uint128(10000 * 1e6));
        euint128 constThreshold = FHE.asEuint128(uint128(colMultiplier));
        euint128 debtScaled = FHE.mul(totalDebt, constDebtScale);
        euint128 collateralScaled = FHE.mul(newTotalCollateral, constThreshold);

        ebool isHealthy = FHE.lte(debtScaled, collateralScaled);
        FHE.allowThis(isHealthy);

        // 3. Final validated amount
        euint128 validAmount = FHE.select(isHealthy, cappedAmount, zero);
        FHE.allowThis(validAmount);

        // Reduce encrypted collateral using validAmount
        euint128 newCollateral = FHE.sub(currentOwnCollateral, validAmount);
        FHE.allowThis(newCollateral);
        FHE.allow(newCollateral, msg.sender);
        _collateral[msg.sender] = newCollateral;

        // Reduce totalDeposited
        euint128 currentTotalDeposited = _safeEncrypted(_totalDeposited);
        euint128 newTotalDeposited = FHE.sub(currentTotalDeposited, validAmount);
        FHE.allowThis(newTotalDeposited);
        _totalDeposited = newTotalDeposited;

        // Downcast back to euint64 for the FHERC20 transfer
        euint64 transferAmount = FHE.asEuint64(validAmount);
        FHE.allowThis(transferAmount);
        FHE.allowTransient(transferAmount, token);

        // Transfer directly via FHERC20 shielded transfer
        IWalnutVaultWrapper(token).confidentialTransfer(msg.sender, transferAmount);

        emit Withdrawn(msg.sender, token);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SEALED-BID LIQUIDATION
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Request a liquidation check on a borrower.
    function requestLiquidationCheck(address borrower) external whenNotPaused {
        require(primaryWalletOf[borrower] == address(0), "Must request on primary wallet");
        Auction storage auc = liquidations[borrower];
        require(auc.state == AuctionState.IDLE, "Auction not idle");
        
        euint128 debt = _getAggregatedDebt(borrower);
        euint128 collateral = _getAggregatedCollateral(borrower);
        
        // debt * 10000 >= collateral * (LIQUIDATION_THRESHOLD * price)
        require(wUSDC_address != address(0), "wUSDC not set");
        address underlyingToken = IWalnutVaultWrapper(wUSDC_address).underlying();
        uint256 colMultiplier = LIQUIDATION_THRESHOLD * oracle.getUSDValue(underlyingToken, 1e6);
        euint128 constDebtScale = FHE.asEuint128(uint128(10000 * 1e6));
        euint128 constThreshold = FHE.asEuint128(uint128(colMultiplier));
        euint128 debtScaled = FHE.mul(debt, constDebtScale);
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
        FHE.allowTransient(amount, address(stablecoin));
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
            emit LiquidationAuctionFailed(borrower);
            return;
        }

        euint128 debtOwed = _getAggregatedDebt(borrower);
        euint128 zero = FHE.asEuint128(0);
        euint128 maxBid = FHE.asEuint128(0);
        euint128 winnerIdx = FHE.asEuint128(0);
        ebool hasValidBid = FHE.asEbool(false);

        FHE.allowThis(zero);
        FHE.allowThis(maxBid);
        FHE.allowThis(winnerIdx);
        FHE.allowThis(hasValidBid);

        for (uint8 i = 0; i < auc.bids.length; i++) {
            euint128 iEnc = FHE.asEuint128(i);
            FHE.allowThis(iEnc);

            // Homomorphic minimum bid validity check: bid must be >= debtOwed to be eligible (prevents $0 solo-bid theft)
            ebool bidValid = FHE.gte(auc.bids[i].amount, debtOwed);
            ebool isBetter = FHE.and(bidValid, FHE.gt(auc.bids[i].amount, maxBid));

            maxBid = FHE.select(isBetter, auc.bids[i].amount, maxBid);
            winnerIdx = FHE.select(isBetter, iEnc, winnerIdx);
            hasValidBid = FHE.or(hasValidBid, bidValid);

            FHE.allowThis(maxBid);
            FHE.allowThis(winnerIdx);
            FHE.allowThis(hasValidBid);
        }

        euint128 valid128 = FHE.asEuint128(hasValidBid);
        FHE.allowThis(valid128);

        uint256 reqId = _requestDecrypt(valid128);
        pendingAuctionValidations[reqId] = PendingValidCheck({
            borrower: borrower,
            winnerIdx: winnerIdx
        });

        emit LiquidationValidCheckRequested(borrower, reqId);
    }

    /// @notice CoFHE callback to verify whether any bid met the minimum debt threshold.
    function syncAuctionValidCheck(
        bytes32 ciphertext,
        uint128 result,
        bytes calldata signature
    ) external nonReentrant {
        uint256 reqId = uint256(ciphertext);
        PendingValidCheck memory check = pendingAuctionValidations[reqId];
        require(check.borrower != address(0), "Unknown valid check");
        delete pendingAuctionValidations[reqId];

        ITaskManager(TASK_MANAGER_ADDRESS).verifyDecryptResult(uint256(ciphertext), uint256(result), signature);

        Auction storage auc = liquidations[check.borrower];

        if (result == 0) {
            // No bid reached the minimum debt threshold — refund all bids and return to IDLE
            for (uint256 i = 0; i < auc.bids.length; i++) {
                euint128 refundAmt = auc.bids[i].amount;
                FHE.allowTransient(refundAmt, address(stablecoin));
                stablecoin.mintInternal(auc.bids[i].bidder, refundAmt);
            }
            auc.state = AuctionState.IDLE;
            emit LiquidationAuctionFailed(check.borrower);
        } else {
            // At least one valid bid exists — proceed to decrypt winning index
            uint256 winnerReqId = _requestDecrypt(check.winnerIdx);
            pendingWinnerSelections[winnerReqId] = check.borrower;
            emit WinnerSelectionRequested(check.borrower, winnerReqId);
        }
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
            euint128 currentDebt = _getAggregatedDebt(borrower);
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
            FHE.allowTransient(surplus, address(stablecoin));
            stablecoin.mintInternal(borrower, surplus);

            // 2. Seize Collateral
            euint128 currentCollateral = _getAggregatedCollateral(borrower);
            euint128 winnerCollateral = _safeEncrypted(_collateral[winner]);
            
            euint128 newWinnerCollateral = FHE.add(winnerCollateral, currentCollateral);
            FHE.allowThis(newWinnerCollateral);
            FHE.allow(newWinnerCollateral, winner);
            _collateral[winner] = newWinnerCollateral;

            // Zero out borrower's and all linked secondary wallets' collateral and debt
            FHE.allow(zero, borrower);
            _collateral[borrower] = zero;
            
            address[] storage linked = linkedWallets[borrower];
            for (uint256 i = 0; i < linked.length; i++) {
                FHE.allow(zero, linked[i]);
                _collateral[linked[i]] = zero;
                _debt[linked[i]] = zero;
            }
        }

        // 3. Refund Losers
        for (uint256 i = 0; i < auc.bids.length; i++) {
            if (i != winnerIdx) {
                // Refund bid amount
                euint128 refundAmt = auc.bids[i].amount;
                FHE.allowTransient(refundAmt, address(stablecoin));
                stablecoin.mintInternal(auc.bids[i].bidder, refundAmt);
            }
        }

        auc.state = AuctionState.IDLE;
        emit AuctionSettled(borrower, winner);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TOTAL BORROWED SYNC
    // ═══════════════════════════════════════════════════════════════════════════

    function getEncryptedTotalBorrowedCtHash() external returns (uint256) {
        return uint256(euint128.unwrap(_safeEncrypted(_totalBorrowed)));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ENS WALLET AGGREGATION
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Link a secondary wallet to the sender's primary identity via EIP-712 signature.
    function linkWallet(address secondary, bytes calldata signature) external whenNotPaused {
        require(secondary != msg.sender, "Cannot link to self");
        require(primaryWalletOf[secondary] == address(0), "Already linked");
        require(primaryWalletOf[msg.sender] == address(0), "Primary is already a secondary");
        require(linkedWallets[secondary].length == 0, "Secondary has linked wallets");

        uint256 nonce = nonces[secondary]++;
        
        bytes32 structHash = keccak256(abi.encode(LINK_WALLET_TYPEHASH, msg.sender, secondary, nonce, keccak256(bytes("I authorize aggregation and acknowledge that all liquidation surplus accrues exclusively to the primary wallet."))));
        bytes32 hash = _hashTypedDataV4(structHash);
        
        address signer = ECDSA.recover(hash, signature);
        require(signer == secondary, "Invalid signature");

        primaryWalletOf[secondary] = msg.sender;
        linkedWallets[msg.sender].push(secondary);

        // Grant primary wallet access to secondary's FHE collateral & debt
        if (euint128.unwrap(_collateral[secondary]) != 0) {
            FHE.allow(_collateral[secondary], msg.sender);
        }
        if (euint128.unwrap(_debt[secondary]) != 0) {
            FHE.allow(_debt[secondary], msg.sender);
        }

        emit WalletLinked(msg.sender, secondary);
    }

    /// @notice Request to unlink a secondary wallet. Evaluates an async health factor check first.
    function requestUnlink(address secondaryWallet) external whenNotPaused {
        require(primaryWalletOf[secondaryWallet] == msg.sender, "Not linked to you");
        require(liquidations[msg.sender].state == AuctionState.IDLE, "Active liquidation");
        
        // Compute health factor WITHOUT this secondary wallet
        euint128 totalCollateral = _safeEncrypted(_collateral[msg.sender]);
        euint128 totalDebt = _safeEncrypted(_debt[msg.sender]);
        
        address[] storage linked = linkedWallets[msg.sender];
        for (uint256 i = 0; i < linked.length; i++) {
            if (linked[i] != secondaryWallet) {
                totalCollateral = FHE.add(totalCollateral, _safeEncrypted(_collateral[linked[i]]));
                totalDebt = FHE.add(totalDebt, _safeEncrypted(_debt[linked[i]]));
            }
        }
        
        // Check if debt * 10000 <= collateral * (LIQUIDATION_THRESHOLD * price)
        require(wUSDC_address != address(0), "wUSDC not set");
        address underlyingToken = IWalnutVaultWrapper(wUSDC_address).underlying();
        uint256 colMultiplier = LIQUIDATION_THRESHOLD * oracle.getUSDValue(underlyingToken, 1e6);
        euint128 constDebtScale = FHE.asEuint128(uint128(10000 * 1e6));
        euint128 constThreshold = FHE.asEuint128(uint128(colMultiplier));
        euint128 debtScaled = FHE.mul(totalDebt, constDebtScale);
        euint128 collateralScaled = FHE.mul(totalCollateral, constThreshold);
        ebool isHealthy = FHE.lte(debtScaled, collateralScaled);
        
        FHE.allowThis(isHealthy);
        euint128 isHealthy128 = FHE.asEuint128(isHealthy);
        uint256 reqId = _requestDecrypt(isHealthy128);
        pendingUnlinks[reqId] = PendingUnlink({primary: msg.sender, secondary: secondaryWallet});
        
        emit UnlinkRequested(msg.sender, secondaryWallet, reqId);
    }

    /// @notice CoFHE callback: finalize unlink if health factor permits.
    function syncUnlink(
        bytes32 ciphertext,
        uint128 result,
        bytes calldata signature
    ) external nonReentrant {
        uint256 reqId = uint256(ciphertext);
        PendingUnlink memory pu = pendingUnlinks[reqId];
        require(pu.primary != address(0), "Unknown unlink");
        delete pendingUnlinks[reqId];

        ITaskManager(TASK_MANAGER_ADDRESS).verifyDecryptResult(uint256(ciphertext), uint256(result), signature);

        require(result == 1, "Unlink would cause undercollateralization");

        // Perform unlink
        primaryWalletOf[pu.secondary] = address(0);
        address[] storage linked = linkedWallets[pu.primary];
        for (uint256 i = 0; i < linked.length; i++) {
            if (linked[i] == pu.secondary) {
                linked[i] = linked[linked.length - 1];
                linked.pop();
                break;
            }
        }

        emit WalletUnlinked(pu.primary, pu.secondary);
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

    // utilizationRate removed because totalDeposited is fully encrypted

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

    function setWUSDCAddress(address _wUSDC) external onlyOwner {
        require(_wUSDC != address(0), "Invalid address");
        wUSDC_address = _wUSDC;
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



    function _getAggregatedCollateral(address primary) internal returns (euint128) {
        euint128 total = _safeEncrypted(_collateral[primary]);
        address[] storage linked = linkedWallets[primary];
        for (uint256 i = 0; i < linked.length; i++) {
            total = FHE.add(total, _safeEncrypted(_collateral[linked[i]]));
        }
        FHE.allowThis(total);
        return total;
    }

    function getAggregatedCollateralCtHash(address primary) external returns (uint256) {
        return uint256(euint128.unwrap(_getAggregatedCollateral(primary)));
    }

    function _getAggregatedDebt(address primary) internal returns (euint128) {
        euint128 total = _safeEncrypted(_debt[primary]);
        address[] storage linked = linkedWallets[primary];
        for (uint256 i = 0; i < linked.length; i++) {
            total = FHE.add(total, _safeEncrypted(_debt[linked[i]]));
        }
        FHE.allowThis(total);
        return total;
    }
}
