// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice WalnutLending: Main Lending Protocol Contract (Multi-Loan Enabled)

import {FHE, ebool, euint128, TASK_MANAGER_ADDRESS} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {InEuint128, ITaskManager} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IWalnutStablecoin {
    function mint(address to, InEuint128 calldata encryptedAmount) external;
    function mintInternal(address to, euint128 amount) external;
    function burn(address from, InEuint128 calldata encryptedAmount) external;
    function burnInternal(address from, euint128 amount) external;
}

interface IWalnutOracle {
    function getUSDValue(address token, uint256 amount) external view returns (uint256);
}

contract WalnutLending is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IWalnutStablecoin public immutable stablecoin;
    IWalnutOracle public immutable oracle;
    address public immutable treasury;

    address public owner;
    bool public paused;

    // ─── FHE encrypted state (unchanged) ─────────────────────────────────────
    mapping(address => euint128) private _collateral;
    mapping(address => euint128) private _debt;
    mapping(address => euint128) private _repaymentCount;
    mapping(address => euint128) private _defaultCount;

    // ─── Multi-loan data model ────────────────────────────────────────────────
    struct Loan {
        uint256 loanId;           // unique per user (loanCounter[user]++)
        uint256 principal;        // plaintext principal (set by CoFHE callback)
        uint256 openedAt;         // block.timestamp at borrow
        bool    active;           // true until fully repaid
        bool    principalPending; // true until CoFHE callback resolves principal
    }

    mapping(address => Loan[])    public loans;
    mapping(address => uint256)   public loanCounter;

    struct PendingSync {
        address user;
        uint256 loanIndex;
    }
    mapping(uint256 => PendingSync) private _pendingPrincipalSyncs;
    mapping(uint256 => PendingSync) private _pendingRepaySyncs;

    // ─── Vault / withdraw ─────────────────────────────────────────────────────
    struct VaultHolding {
        address token;
        uint256 amount;
    }

    mapping(address => VaultHolding[]) public vaults;

    struct PendingWithdraw {
        address user;
        address token;
        uint256 amount;
        euint128 newCollateral;
    }

    mapping(uint256 => PendingWithdraw) public pendingWithdraws;
    mapping(uint256 => address) public decryptRequests;

    // ─── Credit tier ─────────────────────────────────────────────────────────
    mapping(address => uint8) public creditTier;
    uint16[5] public tierLTVs;

    // ─── Total-borrowed tracking (unchanged) ──────────────────────────────────
    uint256 public totalDeposited;
    uint256 public totalBorrowed;
    euint128 private _totalBorrowedEncrypted;
    mapping(uint256 => uint256) public pendingTotalBorrowedSyncVersions;
    uint256 private _totalBorrowedSyncNonce;
    uint256 public totalBorrowedSyncVersion;

    // ─── Auditor / guard ─────────────────────────────────────────────────────
    mapping(address => uint256)  public auditorPermitExpiry;
    mapping(address => euint128) private _guardThreshold;
    mapping(uint256 => address)  private _pendingGuardChecks;

    // ─── Constants ────────────────────────────────────────────────────────────
    uint256 public constant BORROW_APR        = 800;
    uint256 public constant PROTOCOL_FEE_APR  = 200;
    uint256 public constant SECONDS_PER_YEAR  = 365 days;
    uint256 public constant PRECISION         = 1e6;
    uint128 public constant LIQUIDATION_THRESHOLD = 10500;

    // ─── Events ───────────────────────────────────────────────────────────────
    event Deposited(address indexed user, address indexed token, uint256 amount, uint256 usdValue);
    event Borrowed(address indexed user, uint256 timestamp);
    event LoanOpened(address indexed user, uint256 loanId, uint256 openedAt);
    event LoanPrincipalSynced(address indexed user, uint256 loanId, uint256 principal);
    event LoanRepaid(address indexed user, uint256 loanId, uint256 principal, uint256 interest);
    event LoanRepayFailed(address indexed user, uint256 loanId, string reason);
    // Kept for backward compat with existing listeners
    event BorrowPrincipalSyncRequested(address indexed user, uint256 requestId, uint256 openedAt);
    event RepayStateSyncRequested(address indexed user, uint256 requestId, uint256 loanId);
    event RepaymentSettlementIntent(
        address indexed user,
        uint256 principal,
        uint256 interest,
        uint256 protocolFee
    );
    event Withdrawn(address indexed user, address indexed token, uint256 amount);
    event WithdrawFinalized(address indexed user, address indexed token, uint256 amount, bool approved);
    event CreditTierUpdated(address indexed user, uint8 tier);
    event PositionGuardSet(address indexed user);
    event PositionGuardTriggered(address indexed user);
    event AuditorPermitGranted(address indexed auditor, uint256 expiry);
    event AuditorPermitRevoked(address indexed auditor);
    event TotalBorrowedCacheUpdated(uint256 totalBorrowed, uint256 version);
    event TotalBorrowedSyncRequested(uint256 requestId, uint256 version);
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ─── Modifiers ────────────────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "WalnutLending: not owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "WalnutLending: protocol paused");
        _;
    }

    modifier onlyCoFHE() {
        require(msg.sender == TASK_MANAGER_ADDRESS, "WalnutLending: not CoFHE");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(address _stablecoin, address _oracle, address _treasury) {
        require(_stablecoin != address(0), "WalnutLending: zero stablecoin");
        require(_oracle    != address(0), "WalnutLending: zero oracle");
        require(_treasury  != address(0), "WalnutLending: zero treasury");

        stablecoin = IWalnutStablecoin(_stablecoin);
        oracle     = IWalnutOracle(_oracle);
        treasury   = _treasury;
        owner      = msg.sender;

        tierLTVs[0] = 7000;
        tierLTVs[1] = 7500;
        tierLTVs[2] = 8000;
        tierLTVs[3] = 8500;
        tierLTVs[4] = 9000;

        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────
    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "WalnutLending: zero address");
        address prev = owner;
        owner = newOwner;
        emit OwnershipTransferred(prev, newOwner);
    }

    // ─── FHE safe helpers ─────────────────────────────────────────────────────
    function _safeCollateral(address user) internal returns (euint128) {
        if (euint128.unwrap(_collateral[user]) == 0) {
            euint128 zero = FHE.asEuint128(0);
            FHE.allowThis(zero);
            return zero;
        }
        return _collateral[user];
    }

    function _safeDebt(address user) internal returns (euint128) {
        if (euint128.unwrap(_debt[user]) == 0) {
            euint128 zero = FHE.asEuint128(0);
            FHE.allowThis(zero);
            return zero;
        }
        return _debt[user];
    }

    function _safeRepaymentCount(address user) internal returns (euint128) {
        if (euint128.unwrap(_repaymentCount[user]) == 0) {
            euint128 zero = FHE.asEuint128(0);
            FHE.allowThis(zero);
            return zero;
        }
        return _repaymentCount[user];
    }

    function _safeDefaultCount(address user) internal returns (euint128) {
        if (euint128.unwrap(_defaultCount[user]) == 0) {
            euint128 zero = FHE.asEuint128(0);
            FHE.allowThis(zero);
            return zero;
        }
        return _defaultCount[user];
    }

    function _safeTotalBorrowed() internal returns (euint128) {
        if (euint128.unwrap(_totalBorrowedEncrypted) == 0) {
            euint128 zero = FHE.asEuint128(0);
            FHE.allowThis(zero);
            return zero;
        }
        return _totalBorrowedEncrypted;
    }

    // ─── DEPOSIT (unchanged) ──────────────────────────────────────────────────
    function deposit(address token, uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "WalnutLending: zero amount");

        SafeERC20.safeTransferFrom(IERC20(token), msg.sender, address(this), amount);

        uint256 usdValue = oracle.getUSDValue(token, amount);
        require(usdValue > 0, "WalnutLending: zero USD value");

        euint128 encryptedValue = FHE.asEuint128(usdValue);
        FHE.allowThis(encryptedValue);

        euint128 currentCollateral = _safeCollateral(msg.sender);
        euint128 updatedCollateral = FHE.add(currentCollateral, encryptedValue);
        FHE.allowThis(updatedCollateral);
        _collateral[msg.sender] = updatedCollateral;

        FHE.allow(_collateral[msg.sender], msg.sender);

        vaults[msg.sender].push(VaultHolding(token, amount));
        totalDeposited += usdValue;

        emit Deposited(msg.sender, token, amount, usdValue);
    }

    // ─── BORROW (multi-loan, no single-loan restriction) ──────────────────────
    function borrow(InEuint128 calldata encryptedAmount) external nonReentrant whenNotPaused {
        // No single-loan restriction — multiple concurrent loans are supported.
        // LTV enforcement is done in FHE: silent reject if over limit.

        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);

        euint128 currentCollateral = _safeCollateral(msg.sender);

        uint16 ltv = tierLTVs[creditTier[msg.sender]];
        euint128 ltvEncrypted = FHE.asEuint128(ltv);
        FHE.allowThis(ltvEncrypted);

        euint128 collateralTimesLTV = FHE.mul(currentCollateral, ltvEncrypted);
        FHE.allowThis(collateralTimesLTV);

        // Candidate total debt = existing encrypted debt + new amount
        euint128 currentDebt = _safeDebt(msg.sender);
        euint128 candidateDebt = FHE.add(currentDebt, amount);
        FHE.allowThis(candidateDebt);

        euint128 divisor = FHE.asEuint128(10000);
        FHE.allowThis(divisor);

        // Compare cross-products instead of using FHE.div:
        // candidateDebt <= collateral * ltv / 10000
        // is equivalent to candidateDebt * 10000 <= collateral * ltv.
        euint128 debtTimesScale = FHE.mul(candidateDebt, divisor);
        FHE.allowThis(debtTimesScale);

        // FHE LTV check — silent reject if candidateDebt > maxBorrow
        ebool withinLimit = FHE.lte(debtTimesScale, collateralTimesLTV);
        FHE.allowThis(withinLimit);

        euint128 updatedDebt = FHE.select(withinLimit, candidateDebt, currentDebt);
        FHE.allowThis(updatedDebt);
        _debt[msg.sender] = updatedDebt;

        euint128 mintAmount = FHE.select(withinLimit, amount, FHE.asEuint128(0));
        FHE.allowThis(mintAmount);
        FHE.allow(mintAmount, address(stablecoin));

        // CEI: all state changes before external call
        uint256 loanId    = loanCounter[msg.sender]++;
        uint256 openedAt  = block.timestamp;
        loans[msg.sender].push(Loan({
            loanId:           loanId,
            principal:        0,
            openedAt:         openedAt,
            active:           true,
            principalPending: true
        }));
        uint256 loanIndex = loans[msg.sender].length - 1;

        // External calls after state changes
        stablecoin.mintInternal(msg.sender, mintAmount);

        euint128 currentTotalBorrowed = _safeTotalBorrowed();
        _totalBorrowedEncrypted = FHE.add(currentTotalBorrowed, mintAmount);
        FHE.allowThis(_totalBorrowedEncrypted);
        _requestTotalBorrowedSync();

        _requestLoanPrincipalSync(msg.sender, loanIndex, mintAmount, openedAt);

        FHE.allow(_debt[msg.sender], msg.sender);

        emit LoanOpened(msg.sender, loanId, openedAt);
        emit Borrowed(msg.sender, openedAt);
    }

    // ─── REPAY (targets a specific loan by index) ─────────────────────────────
    function repay(InEuint128 calldata encryptedAmount, uint256 loanIndex)
        external
        nonReentrant
        whenNotPaused
    {
        require(loanIndex < loans[msg.sender].length, "WalnutLending: invalid loan index");

        Loan storage loan = loans[msg.sender][loanIndex];
        require(loan.active,            "WalnutLending: loan not active");
        require(!loan.principalPending, "WalnutLending: principal sync pending - try again shortly");
        require(loan.principal > 0,     "WalnutLending: principal unavailable");

        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);

        (uint256 totalInterest, uint256 protocolFee,) = calculateInterestForLoan(
            loan.principal,
            loan.openedAt
        );
        uint256 settlementAmount = loan.principal + totalInterest;

        euint128 requiredAmount  = FHE.asEuint128(settlementAmount);
        FHE.allowThis(requiredAmount);

        euint128 principalAmount = FHE.asEuint128(loan.principal);
        FHE.allowThis(principalAmount);

        ebool sufficient = FHE.gte(amount, requiredAmount);
        FHE.allowThis(sufficient);

        // Reduce total encrypted debt by loan principal (if sufficient repayment)
        euint128 currentDebt = _safeDebt(msg.sender);
        ebool debtGtePrincipal = FHE.gte(currentDebt, principalAmount);
        euint128 safeReducedDebt = FHE.select(
            FHE.and(sufficient, debtGtePrincipal),
            FHE.sub(currentDebt, principalAmount),
            currentDebt
        );
        FHE.allowThis(safeReducedDebt);
        _debt[msg.sender] = safeReducedDebt;

        // Increment repayment count on successful repayment
        euint128 currentRepaymentCount = _safeRepaymentCount(msg.sender);
        euint128 incrementedCount = FHE.add(currentRepaymentCount, FHE.asEuint128(1));
        FHE.allowThis(incrementedCount);
        _repaymentCount[msg.sender] = FHE.select(sufficient, incrementedCount, currentRepaymentCount);
        FHE.allowThis(_repaymentCount[msg.sender]);

        euint128 burnAmount = FHE.select(sufficient, requiredAmount, FHE.asEuint128(0));
        FHE.allowThis(burnAmount);
        FHE.allow(burnAmount, address(stablecoin));

        // Update encrypted pool total
        euint128 currentTotalBorrowed = _safeTotalBorrowed();
        euint128 aggregateReduction   = FHE.select(sufficient, principalAmount, FHE.asEuint128(0));
        FHE.allowThis(aggregateReduction);
        _totalBorrowedEncrypted = FHE.sub(currentTotalBorrowed, aggregateReduction);
        FHE.allowThis(_totalBorrowedEncrypted);

        euint128 repaySignal = FHE.select(sufficient, FHE.asEuint128(1), FHE.asEuint128(0));
        FHE.allowThis(repaySignal);

        // CEI: state changes done — now external calls
        stablecoin.burnInternal(msg.sender, burnAmount);

        _requestTotalBorrowedSync();
        _requestLoanRepaySync(msg.sender, loanIndex, repaySignal);

        FHE.allow(_debt[msg.sender], msg.sender);
        FHE.allow(_repaymentCount[msg.sender], msg.sender);

        emit RepaymentSettlementIntent(msg.sender, loan.principal, totalInterest, protocolFee);
    }

    // ─── WITHDRAW ─────────────────────────────────────────────────────────────
    function withdraw(address token, uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "WalnutLending: zero amount");
        require(!hasActiveLoan(msg.sender), "WalnutLending: repay all loans before withdrawing");
        require(_vaultBalanceOf(msg.sender, token) >= amount, "WalnutLending: insufficient vault balance");

        uint256 usdValue = oracle.getUSDValue(token, amount);

        euint128 encryptedValue  = FHE.asEuint128(usdValue);
        FHE.allowThis(encryptedValue);

        euint128 currentCollateral = _safeCollateral(msg.sender);
        euint128 newCollateral     = FHE.sub(currentCollateral, encryptedValue);
        FHE.allowThis(newCollateral);

        // CEI: state changes before transfer
        _collateral[msg.sender] = newCollateral;
        FHE.allowThis(_collateral[msg.sender]);
        FHE.allow(_collateral[msg.sender], msg.sender);

        if (totalDeposited >= usdValue) {
            totalDeposited -= usdValue;
        }

        _removeFromVault(msg.sender, token, amount);

        // External transfer last
        SafeERC20.safeTransfer(IERC20(token), msg.sender, amount);

        emit Withdrawn(msg.sender, token, amount);
        emit WithdrawFinalized(msg.sender, token, amount, true);
    }

    // ─── POSITION GUARD ───────────────────────────────────────────────────────
    function setPositionGuard(InEuint128 calldata encryptedThreshold) external {
        _guardThreshold[msg.sender] = FHE.asEuint128(encryptedThreshold);
        FHE.allowThis(_guardThreshold[msg.sender]);
        emit PositionGuardSet(msg.sender);
    }

    function checkPositionGuard(address user) external {
        require(_guardThreshold[user].unwrap() != 0, "WalnutLending: no guard set");

        if (!hasActiveLoan(user)) return;

        euint128 currentCollateral = _safeCollateral(user);
        euint128 scaledCollateral  = FHE.mul(currentCollateral, FHE.asEuint128(10000));
        FHE.allowThis(scaledCollateral);

        euint128 currentDebt = _safeDebt(user);
        ebool debtIsZero     = FHE.eq(currentDebt, FHE.asEuint128(0));
        FHE.allowThis(debtIsZero);

        euint128 safeDebt = FHE.select(debtIsZero, FHE.asEuint128(1), currentDebt);
        FHE.allowThis(safeDebt);

        euint128 hf = FHE.div(scaledCollateral, safeDebt);
        FHE.allowThis(hf);

        euint128 triggerSignal = FHE.select(
            FHE.lt(hf, _guardThreshold[user]),
            FHE.asEuint128(1),
            FHE.asEuint128(0)
        );
        FHE.allowThis(triggerSignal);

        euint128 signal = FHE.select(debtIsZero, FHE.asEuint128(0), triggerSignal);
        FHE.allowThis(signal);

        uint256 requestId = _requestDecrypt(signal);
        _pendingGuardChecks[requestId] = user;
    }

    function onGuardCheckDecrypted(uint256 requestId, uint128 result) external onlyCoFHE {
        address user = _pendingGuardChecks[requestId];
        if (user == address(0)) return;

        if (result == 1) {
            emit PositionGuardTriggered(user);
        }

        delete _pendingGuardChecks[requestId];
    }

    // ─── AUDITOR PERMITS ─────────────────────────────────────────────────────
    function grantAuditorPermit(address auditor, uint256 expiry) external onlyOwner {
        require(auditor != address(0), "WalnutLending: zero auditor");
        require(expiry > block.timestamp,  "WalnutLending: expiry in past");

        auditorPermitExpiry[auditor] = expiry;
        emit AuditorPermitGranted(auditor, expiry);
    }

    function revokeAuditorPermit(address auditor) external onlyOwner {
        delete auditorPermitExpiry[auditor];
        emit AuditorPermitRevoked(auditor);
    }

    // ─── CoFHE CALLBACKS ──────────────────────────────────────────────────────
    function onLoanPrincipalDecrypted(uint256 requestId, uint128 result) external onlyCoFHE {
        _handleLoanPrincipalResult(requestId, result);
    }

    function syncLoanPrincipal(uint256 requestId, uint128 result, bytes calldata signature) external {
        require(
            FHE.verifyDecryptResultSafe(requestId, result, signature),
            "WalnutLending: invalid decrypt signature"
        );
        _handleLoanPrincipalResult(requestId, result);
    }

    function _handleLoanPrincipalResult(uint256 requestId, uint128 result) internal {
        PendingSync memory ps = _pendingPrincipalSyncs[requestId];
        if (ps.user == address(0)) return;

        if (ps.loanIndex < loans[ps.user].length) {
            Loan storage loan = loans[ps.user][ps.loanIndex];
            loan.principalPending = false;
            if (result > 0) {
                loan.principal = uint256(result);
                emit LoanPrincipalSynced(ps.user, loan.loanId, loan.principal);
            } else {
                // Mint was silently rejected by FHE LTV check — deactivate loan
                loan.active = false;
            }
        }

        delete _pendingPrincipalSyncs[requestId];
    }

    function onLoanRepayDecrypted(uint256 requestId, uint128 result) external onlyCoFHE {
        _handleLoanRepayResult(requestId, result);
    }

    function syncLoanRepay(uint256 requestId, uint128 result, bytes calldata signature) external {
        require(
            FHE.verifyDecryptResultSafe(requestId, result, signature),
            "WalnutLending: invalid decrypt signature"
        );
        _handleLoanRepayResult(requestId, result);
    }

    function _handleLoanRepayResult(uint256 requestId, uint128 result) internal {
        PendingSync memory ps = _pendingRepaySyncs[requestId];
        if (ps.user == address(0)) return;

        if (ps.loanIndex < loans[ps.user].length) {
            Loan storage loan = loans[ps.user][ps.loanIndex];
            if (result == 1) {
                emit LoanRepaid(ps.user, loan.loanId, loan.principal, 0);
                loan.active    = false;
                loan.principal = 0;
            } else {
                emit LoanRepayFailed(ps.user, loan.loanId, "Insufficient repayment amount");
            }
        }

        delete _pendingRepaySyncs[requestId];
    }

    function requestCreditTierUpdate(address user) external {
        euint128 currentCount = _safeRepaymentCount(user);
        FHE.allowThis(currentCount);
        FHE.allow(currentCount, address(this));
        uint256 requestId = _requestDecrypt(currentCount);
        decryptRequests[requestId] = user;
    }

    function onCreditCountDecrypted(uint256 requestId, uint128 result) external onlyCoFHE {
        _handleCreditCountResult(requestId, result);
    }

    function syncCreditCount(uint256 requestId, uint128 result, bytes calldata signature) external {
        require(
            FHE.verifyDecryptResultSafe(requestId, result, signature),
            "WalnutLending: invalid decrypt signature"
        );
        _handleCreditCountResult(requestId, result);
    }

    function _handleCreditCountResult(uint256 requestId, uint128 result) internal {
        address user = decryptRequests[requestId];
        if (user == address(0)) return;

        creditTier[user] = _tierFromRepaymentCount(result);
        emit CreditTierUpdated(user, creditTier[user]);

        delete decryptRequests[requestId];
    }

    function onWithdrawSafetyDecrypted(uint256 requestId, bool safe) external onlyCoFHE {
        PendingWithdraw memory request = pendingWithdraws[requestId];
        if (request.user == address(0)) return;

        delete pendingWithdraws[requestId];

        if (!safe) {
            emit WithdrawFinalized(request.user, request.token, request.amount, false);
            return;
        }

        _collateral[request.user] = request.newCollateral;
        FHE.allowThis(_collateral[request.user]);
        FHE.allow(_collateral[request.user], request.user);

        SafeERC20.safeTransfer(IERC20(request.token), request.user, request.amount);
        _removeFromVault(request.user, request.token, request.amount);

        emit Withdrawn(request.user, request.token, request.amount);
        emit WithdrawFinalized(request.user, request.token, request.amount, true);
    }

    function onTotalBorrowedDecrypted(uint256 requestId, uint128 result) external onlyCoFHE {
        _handleTotalBorrowedResult(requestId, result);
    }

    function syncTotalBorrowed(uint256 requestId, uint128 result, bytes calldata signature) external {
        require(
            FHE.verifyDecryptResultSafe(requestId, result, signature),
            "WalnutLending: invalid decrypt signature"
        );
        _handleTotalBorrowedResult(requestId, result);
    }

    function _handleTotalBorrowedResult(uint256 requestId, uint128 result) internal {
        uint256 version = pendingTotalBorrowedSyncVersions[requestId];
        if (version == 0) return;

        if (version >= totalBorrowedSyncVersion) {
            totalBorrowedSyncVersion = version;
            totalBorrowed = uint256(result);
            emit TotalBorrowedCacheUpdated(totalBorrowed, version);
        }

        delete pendingTotalBorrowedSyncVersions[requestId];
    }

    // ─── INTEREST CALCULATION ─────────────────────────────────────────────────

    /// @notice Generic interest calc given principal + openedAt timestamp
    function calculateInterestForLoan(uint256 principal, uint256 openedAt)
        public
        view
        returns (uint256 totalInterest, uint256 protocolFee, uint256 lenderPayment)
    {
        if (openedAt == 0 || principal == 0) return (0, 0, 0);

        uint256 elapsed = block.timestamp - openedAt;
        totalInterest = (principal * BORROW_APR * elapsed * PRECISION)
            / (SECONDS_PER_YEAR * 10000 * PRECISION);
        protocolFee   = totalInterest / 4;
        lenderPayment = totalInterest - protocolFee;
    }

    /// @notice Backward-compat: find the matching active loan for this user+principal
    function calculateInterest(address user, uint256 principal)
        public
        view
        returns (uint256 totalInterest, uint256 protocolFee, uint256 lenderPayment)
    {
        uint256 openedAt = 0;
        Loan[] storage userLoans = loans[user];
        for (uint256 i = 0; i < userLoans.length; i++) {
            if (userLoans[i].active && userLoans[i].principal == principal) {
                openedAt = userLoans[i].openedAt;
                break;
            }
        }
        return calculateInterestForLoan(principal, openedAt);
    }

    // ─── VIEW FUNCTIONS ───────────────────────────────────────────────────────
    function utilizationRate() external view returns (uint256) {
        if (totalDeposited == 0) return 0;
        return (totalBorrowed * 10000) / totalDeposited;
    }

    function currentBorrowRate() external view returns (uint256) {
        if (totalDeposited == 0) return 600;
        return 600 + ((totalBorrowed * 600) / totalDeposited);
    }

    function getEncryptedCollateral(address user) external view returns (euint128) {
        return _collateral[user];
    }

    function getEncryptedDebt(address user) external view returns (euint128) {
        return _debt[user];
    }

    function getEncryptedRepaymentCount(address user) external view returns (euint128) {
        return _repaymentCount[user];
    }

    function getEncryptedDefaultCount(address user) external view returns (euint128) {
        return _defaultCount[user];
    }

    function getVaults(address user) external view returns (VaultHolding[] memory) {
        return vaults[user];
    }

    function vaultBalanceOf(address user, address token) external view returns (uint256) {
        return _vaultBalanceOf(user, token);
    }

    /// @notice Returns all loans for a user (active and closed)
    function getLoans(address user) external view returns (Loan[] memory) {
        return loans[user];
    }

    /// @notice Returns only active loans with their indices
    function getActiveLoans(address user)
        external
        view
        returns (Loan[] memory activeLoans, uint256[] memory indices)
    {
        Loan[] storage userLoans = loans[user];
        uint256 count = 0;
        for (uint256 i = 0; i < userLoans.length; i++) {
            if (userLoans[i].active) count++;
        }

        activeLoans = new Loan[](count);
        indices     = new uint256[](count);
        uint256 j   = 0;
        for (uint256 i = 0; i < userLoans.length; i++) {
            if (userLoans[i].active) {
                activeLoans[j] = userLoans[i];
                indices[j]     = i;
                j++;
            }
        }
    }

    /// @notice Returns true if the user has at least one active loan
    function hasActiveLoan(address user) public view returns (bool) {
        Loan[] storage userLoans = loans[user];
        for (uint256 i = 0; i < userLoans.length; i++) {
            if (userLoans[i].active) return true;
        }
        return false;
    }

    /// @notice Returns total principal across active, resolved loans
    function getTotalActivePrincipal(address user) external view returns (uint256 total) {
        Loan[] storage userLoans = loans[user];
        for (uint256 i = 0; i < userLoans.length; i++) {
            if (userLoans[i].active && !userLoans[i].principalPending) {
                total += userLoans[i].principal;
            }
        }
    }

    /// @notice Returns estimated total interest across all active loans
    function getTotalEstimatedInterest(address user) external view returns (uint256 total) {
        Loan[] storage userLoans = loans[user];
        for (uint256 i = 0; i < userLoans.length; i++) {
            if (userLoans[i].active && !userLoans[i].principalPending) {
                (uint256 interest,,) = calculateInterestForLoan(
                    userLoans[i].principal,
                    userLoans[i].openedAt
                );
                total += interest;
            }
        }
    }

    /// @notice Backward compat: returns openedAt of first active loan, or 0
    function borrowTimestamp(address user) external view returns (uint256) {
        Loan[] storage userLoans = loans[user];
        for (uint256 i = 0; i < userLoans.length; i++) {
            if (userLoans[i].active) return userLoans[i].openedAt;
        }
        return 0;
    }

    /// @notice Backward compat: returns total principal across active loans
    function principalDebt(address user) external view returns (uint256) {
        uint256 total = 0;
        Loan[] storage userLoans = loans[user];
        for (uint256 i = 0; i < userLoans.length; i++) {
            if (userLoans[i].active && !userLoans[i].principalPending) {
                total += userLoans[i].principal;
            }
        }
        return total;
    }

    // ─── INTERNAL HELPERS ─────────────────────────────────────────────────────
    function _vaultBalanceOf(address user, address token) internal view returns (uint256 total) {
        VaultHolding[] storage userVaults = vaults[user];
        for (uint256 i = 0; i < userVaults.length; i++) {
            if (userVaults[i].token == token) {
                total += userVaults[i].amount;
            }
        }
    }

    function _removeFromVault(address user, address token, uint256 amount) internal {
        VaultHolding[] storage userVaults = vaults[user];
        for (uint256 i = 0; i < userVaults.length; i++) {
            if (userVaults[i].token == token) {
                if (userVaults[i].amount <= amount) {
                    userVaults[i] = userVaults[userVaults.length - 1];
                    userVaults.pop();
                } else {
                    userVaults[i].amount -= amount;
                }
                break;
            }
        }
    }

    function _requestDecrypt(euint128 value) internal returns (uint256 requestId) {
        requestId = uint256(euint128.unwrap(value));
        FHE.allowPublic(value);
    }

    function _requestLoanPrincipalSync(
        address user,
        uint256 loanIndex,
        euint128 mintedAmount,
        uint256 openedAt
    ) internal {
        uint256 requestId = _requestDecrypt(mintedAmount);
        _pendingPrincipalSyncs[requestId] = PendingSync({ user: user, loanIndex: loanIndex });
        emit BorrowPrincipalSyncRequested(user, requestId, openedAt);
    }

    function _requestLoanRepaySync(
        address user,
        uint256 loanIndex,
        euint128 repaySignal
    ) internal {
        uint256 requestId = _requestDecrypt(repaySignal);
        _pendingRepaySyncs[requestId] = PendingSync({ user: user, loanIndex: loanIndex });
        emit RepayStateSyncRequested(user, requestId, loans[user][loanIndex].loanId);
    }

    function _requestTotalBorrowedSync() internal {
        _totalBorrowedSyncNonce += 1;
        uint256 requestId = _requestDecrypt(_totalBorrowedEncrypted);
        pendingTotalBorrowedSyncVersions[requestId] = _totalBorrowedSyncNonce;
        emit TotalBorrowedSyncRequested(requestId, _totalBorrowedSyncNonce);
    }

    function _tierFromRepaymentCount(uint128 count) internal pure returns (uint8) {
        if (count >= 50) return 4;
        if (count >= 25) return 3;
        if (count >= 10) return 2;
        if (count >= 3)  return 1;
        return 0;
    }

    // ============================================
    // FEATURE 1: SEALED-BID LIQUIDATION AUCTIONS
    // ============================================

    struct LiquidationAuction {
        address borrower;
        address[] bidders;
        euint128[] bids;
        uint256 endTime;
        bool settled;
    }

    mapping(address => LiquidationAuction) public auctions;
    mapping(uint256 => address) private _pendingAuctionSettlements;
    mapping(address => bool) public liquidatable;
    uint256 public constant AUCTION_DURATION = 10 minutes;

    event AuctionOpened(address indexed borrower, uint256 endTime);
    event BidSubmitted(address indexed borrower, address indexed bidder);
    event WinnerSelectionRequested(address indexed borrower);
    event AuctionSettled(address indexed borrower, address indexed winner, uint128 penaltyBps);
    event LiquidationTriggered(address indexed user);

    function openAuction(address borrower) external nonReentrant {
        require(liquidatable[borrower], "WalnutLending: borrower not liquidatable");
        require(auctions[borrower].endTime == 0 || auctions[borrower].settled, "WalnutLending: auction already active");

        delete auctions[borrower];

        LiquidationAuction storage auction = auctions[borrower];
        auction.borrower = borrower;
        auction.endTime  = block.timestamp + AUCTION_DURATION;
        auction.settled  = false;

        emit AuctionOpened(borrower, auction.endTime);
    }

    function submitBid(address borrower, InEuint128 calldata encryptedPenalty) external nonReentrant {
        require(liquidatable[borrower], "WalnutLending: borrower not liquidatable");

        LiquidationAuction storage auction = auctions[borrower];
        require(auction.borrower == borrower && auction.endTime != 0, "WalnutLending: auction not open");
        require(!auction.settled, "WalnutLending: auction settled");
        require(block.timestamp < auction.endTime, "WalnutLending: bidding closed");

        for (uint256 i = 0; i < auction.bidders.length; i++) {
            require(auction.bidders[i] != msg.sender, "WalnutLending: bidder already submitted");
        }

        euint128 bid = FHE.asEuint128(encryptedPenalty);
        FHE.allowThis(bid);

        auction.bids.push(bid);
        auction.bidders.push(msg.sender);

        emit BidSubmitted(borrower, msg.sender);
    }

    function selectWinningBid(address borrower) external nonReentrant returns (uint256 requestId) {
        LiquidationAuction storage auction = auctions[borrower];
        require(auction.borrower == borrower && auction.endTime != 0, "WalnutLending: auction not found");
        require(block.timestamp >= auction.endTime,  "WalnutLending: auction not ended");
        require(!auction.settled, "WalnutLending: auction already settled");
        require(auction.bids.length > 0, "WalnutLending: no bids submitted");

        euint128 minBid = auction.bids[0];
        FHE.allowThis(minBid);

        euint128 winnerIdx = FHE.asEuint128(0);
        FHE.allowThis(winnerIdx);

        for (uint256 i = 1; i < auction.bids.length; i++) {
            ebool isLower = FHE.lte(auction.bids[i], minBid);
            FHE.allowThis(isLower);

            euint128 nextMinBid = FHE.select(isLower, auction.bids[i], minBid);
            FHE.allowThis(nextMinBid);
            minBid = nextMinBid;

            euint128 iEnc = FHE.asEuint128(i);
            FHE.allowThis(iEnc);
            euint128 nextWinnerIdx = FHE.select(isLower, iEnc, winnerIdx);
            FHE.allowThis(nextWinnerIdx);
            winnerIdx = nextWinnerIdx;
        }

        requestId = _requestDecrypt(winnerIdx);
        _pendingAuctionSettlements[requestId] = borrower;

        emit WinnerSelectionRequested(borrower);
    }

    function onWinnerSelected(uint256 requestId, uint128 result) external onlyCoFHE {
        address borrower = _pendingAuctionSettlements[requestId];
        if (borrower == address(0)) return;

        LiquidationAuction storage auction = auctions[borrower];
        if (auction.settled) {
            delete _pendingAuctionSettlements[requestId];
            return;
        }

        uint256 winnerIndex = uint256(result);
        if (winnerIndex >= auction.bidders.length) {
            delete _pendingAuctionSettlements[requestId];
            return;
        }

        auction.settled = true;
        liquidatable[borrower] = false;

        emit AuctionSettled(borrower, auction.bidders[winnerIndex], result);

        delete _pendingAuctionSettlements[requestId];
    }

    function requestLiquidationCheck(address user) external returns (uint256 requestId) {
        euint128 healthFactor = _computeHealthFactor(user);
        requestId = _requestDecrypt(healthFactor);
        _pendingGuardChecks[requestId] = user;
    }

    function onLiquidationResult(uint256 requestId, uint128 result) external onlyCoFHE {
        address user = _pendingGuardChecks[requestId];
        if (user == address(0)) return;

        if (result < LIQUIDATION_THRESHOLD) {
            liquidatable[user] = true;

            euint128 currentDefaultCount  = _safeDefaultCount(user);
            euint128 updatedDefaultCount  = FHE.add(currentDefaultCount, FHE.asEuint128(1));
            FHE.allowThis(updatedDefaultCount);
            _defaultCount[user] = updatedDefaultCount;
            FHE.allowThis(_defaultCount[user]);
            FHE.allow(_defaultCount[user], user);

            emit LiquidationTriggered(user);
        }

        delete _pendingGuardChecks[requestId];
    }

    function getAuctionSummary(address borrower)
        external
        view
        returns (address auctionBorrower, uint256 endTime, uint256 bidCount, bool settled, bool active)
    {
        LiquidationAuction storage auction = auctions[borrower];
        bool isActive = auction.borrower != address(0) && !auction.settled && block.timestamp < auction.endTime;
        return (auction.borrower, auction.endTime, auction.bids.length, auction.settled, isActive);
    }

    function _computeHealthFactor(address user) internal returns (euint128) {
        euint128 zero = FHE.asEuint128(0);
        FHE.allowThis(zero);
        euint128 one = FHE.asEuint128(1);
        FHE.allowThis(one);

        euint128 currentDebt = _safeDebt(user);
        ebool debtIsZero     = FHE.eq(currentDebt, zero);
        FHE.allowThis(debtIsZero);

        euint128 safeDebt = FHE.select(debtIsZero, one, currentDebt);
        FHE.allowThis(safeDebt);

        euint128 currentCollateral = _safeCollateral(user);
        euint128 scaledCollateral  = FHE.mul(currentCollateral, FHE.asEuint128(10000));
        FHE.allowThis(scaledCollateral);

        euint128 healthFactor = FHE.div(scaledCollateral, safeDebt);
        FHE.allowThis(healthFactor);

        return healthFactor;
    }

    // ============================================
    // FEATURE 2: ENS MULTI-WALLET AGGREGATION
    // ============================================

    mapping(address => address[]) public linkedWallets;
    mapping(address => address)   public walletToPrimary;

    event WalletLinked(address indexed primary, address indexed linked);
    event WalletUnlinked(address indexed primary, address indexed linked);
    event AggregatedCollateralHandle(address indexed primaryWallet, uint256 ctHash);

    function registerLinkedWallet(address additionalWallet) external {
        require(additionalWallet != address(0),  "WalnutLending: zero address");
        require(additionalWallet != msg.sender,  "WalnutLending: cannot link self");
        require(walletToPrimary[additionalWallet] == address(0), "WalnutLending: wallet already linked");

        linkedWallets[msg.sender].push(additionalWallet);
        walletToPrimary[additionalWallet] = msg.sender;

        FHE.allow(_collateral[additionalWallet], msg.sender);

        emit WalletLinked(msg.sender, additionalWallet);
    }

    function getAggregatedCollateral(address primaryWallet) external returns (euint128) {
        euint128 aggregated = _safeCollateral(primaryWallet);
        FHE.allowThis(aggregated);

        address[] storage linked = linkedWallets[primaryWallet];
        for (uint256 i = 0; i < linked.length; i++) {
            euint128 nextCollateral  = _safeCollateral(linked[i]);
            euint128 nextAggregated = FHE.add(aggregated, nextCollateral);
            FHE.allowThis(nextAggregated);
            aggregated = nextAggregated;
        }

        FHE.allow(aggregated, msg.sender);

        emit AggregatedCollateralHandle(primaryWallet, uint256(euint128.unwrap(aggregated)));

        return aggregated;
    }

    function getLinkedWallets(address primaryWallet) external view returns (address[] memory) {
        return linkedWallets[primaryWallet];
    }

    function removeLinkedWallet(address wallet) external {
        require(walletToPrimary[wallet] == msg.sender, "WalnutLending: not your linked wallet");

        address[] storage linked = linkedWallets[msg.sender];
        for (uint256 i = 0; i < linked.length; i++) {
            if (linked[i] == wallet) {
                linked[i] = linked[linked.length - 1];
                linked.pop();
                break;
            }
        }

        delete walletToPrimary[wallet];

        emit WalletUnlinked(msg.sender, wallet);
    }

    // ============================================
    // FEATURE 3: P2P ENCRYPTED LENDING
    // ============================================

    struct LoanOffer {
        address lender;
        euint128 encryptedAPR;
        euint128 encryptedSize;
        euint128 encryptedTenorDays;
        bool matched;
        address borrower;
    }

    mapping(uint256 => LoanOffer) public loanOffers;
    uint256 public offerCount;

    event OfferPosted(uint256 indexed offerId, address indexed lender);
    event OfferMatched(uint256 indexed offerId, address indexed borrower);
    event OfferCancelled(uint256 indexed offerId);
    event P2PSettlementIntent(uint256 indexed offerId, address indexed lender, address indexed borrower);

    function postLoanOffer(
        InEuint128 calldata encryptedAPR,
        InEuint128 calldata encryptedSize,
        InEuint128 calldata encryptedTenorDays
    ) external nonReentrant returns (uint256 offerId) {
        offerId = offerCount;
        offerCount += 1;

        LoanOffer storage offer = loanOffers[offerId];
        offer.lender = msg.sender;

        offer.encryptedAPR = FHE.asEuint128(encryptedAPR);
        FHE.allowThis(offer.encryptedAPR);
        offer.encryptedSize = FHE.asEuint128(encryptedSize);
        FHE.allowThis(offer.encryptedSize);
        offer.encryptedTenorDays = FHE.asEuint128(encryptedTenorDays);
        FHE.allowThis(offer.encryptedTenorDays);

        offer.matched = false;

        FHE.allow(offer.encryptedAPR,       msg.sender);
        FHE.allow(offer.encryptedSize,      msg.sender);
        FHE.allow(offer.encryptedTenorDays, msg.sender);

        emit OfferPosted(offerId, msg.sender);
    }

    function matchOffer(uint256 offerId) external nonReentrant {
        LoanOffer storage offer = loanOffers[offerId];
        require(!offer.matched,              "WalnutLending: offer already matched");
        require(offer.lender != address(0),  "WalnutLending: offer does not exist");
        require(offer.lender != msg.sender,  "WalnutLending: lender cannot self-match");

        offer.matched  = true;
        offer.borrower = msg.sender;

        FHE.allow(offer.encryptedAPR,       msg.sender);
        FHE.allow(offer.encryptedSize,      msg.sender);
        FHE.allow(offer.encryptedTenorDays, msg.sender);

        emit OfferMatched(offerId, msg.sender);
        emit P2PSettlementIntent(offerId, offer.lender, msg.sender);
    }

    function cancelOffer(uint256 offerId) external {
        LoanOffer storage offer = loanOffers[offerId];
        require(offer.lender == msg.sender, "WalnutLending: not your offer");
        require(!offer.matched,             "WalnutLending: offer already matched");

        delete loanOffers[offerId];

        emit OfferCancelled(offerId);
    }

    function getOfferCount() external view returns (uint256) {
        return offerCount;
    }
}
