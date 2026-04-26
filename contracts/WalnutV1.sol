// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {FHE, ebool, euint128, TASK_MANAGER_ADDRESS} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {InEuint128, ITaskManager} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";

contract WalnutV1 {
    struct EncryptedValue {
        uint256 ctHash;
        uint8 utype;
    }

    struct LiquidationAuction {
        address borrower;
        euint128[] bids;
        address[] bidders;
        uint256 endTime;
        bool settled;
    }

    struct LoanOffer {
        address lender;
        euint128 encryptedAPR;
        euint128 encryptedSize;
        euint128 encryptedTenor;
        bool active;
        address matchedBorrower;
    }

    uint8 private constant EUINT128_UTYPE = 6;
    uint256 public constant LIQUIDATION_THRESHOLD = 10500;
    uint256 public constant BID_WINDOW = 10 minutes;

    address public owner;
    bool public paused;

    mapping(address => euint128) private collateral;
    mapping(address => euint128) private debt;
    mapping(address => bool) public liquidatable;

    euint128 private totalPoolCollateral;
    euint128 private totalPoolDebt;

    mapping(uint256 => address) private pendingLiquidationChecks;

    mapping(address => LiquidationAuction) public auctions;
    mapping(uint256 => address) private pendingWinnerChecks;
    mapping(address => uint256) public pendingWinnerRequestByBorrower;
    address[] private auctionBorrowers;
    mapping(address => bool) private hasAuctionHistory;

    mapping(address => euint128) private repaymentCount;
    mapping(address => euint128) private defaultCount;
    mapping(address => uint8) public creditTier;
    uint256[5] public TIER_LTV = [7000, 7500, 8000, 8500, 9000];
    mapping(uint256 => address) private pendingCreditUpdates;

    mapping(uint256 => LoanOffer) private offers;
    uint256 public offerCount;

    mapping(address => address[]) public ensWallets;
    mapping(address => address) public walletToENS;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(address indexed by);
    event Unpaused(address indexed by);

    event DepositSubmitted(address indexed user);
    event BorrowSubmitted(address indexed user);
    event RepaySubmitted(address indexed user);
    event WithdrawSubmitted(address indexed user);
    event RepaymentSettlementIntent(address indexed user, uint256 timestamp);

    event LiquidationCheckRequested(address indexed user, uint256 requestId);
    event LiquidationTriggered(address indexed user);

    event AuctionOpened(address indexed borrower, uint256 endTime);
    event BidSubmitted(address indexed borrower, address indexed bidder);
    event SelectionRequested(address indexed borrower, uint256 requestId);
    event AuctionSettled(address indexed borrower, address indexed winner);

    event CreditTierUpdateRequested(address indexed user, uint256 requestId);
    event CreditTierUpdated(address indexed user, uint8 tier);

    event OfferPosted(uint256 indexed offerId, address indexed lender);
    event OfferMatched(uint256 indexed offerId, address indexed borrower);

    event ENSWalletAdded(address indexed primary, address indexed additional, string ensName);
    event HealthFactorHandle(address indexed user, uint256 ctHash);
    event AggregatedCollateralHandle(address indexed primaryWallet, uint256 ctHash);

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Protocol paused");
        _;
    }

    modifier onlyCoFHE() {
        require(msg.sender == TASK_MANAGER_ADDRESS, "Only CoFHE coprocessor");
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function deposit(InEuint128 memory encryptedAmount) external whenNotPaused {
        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);

        euint128 updatedCollateral = FHE.add(collateral[msg.sender], amount);
        FHE.allowThis(updatedCollateral);
        collateral[msg.sender] = updatedCollateral;

        FHE.allowThis(collateral[msg.sender]);
        FHE.allow(collateral[msg.sender], msg.sender);

        euint128 updatedPoolCollateral = FHE.add(totalPoolCollateral, amount);
        FHE.allowThis(updatedPoolCollateral);
        totalPoolCollateral = updatedPoolCollateral;
        FHE.allowThis(totalPoolCollateral);

        emit DepositSubmitted(msg.sender);
    }

    function borrow(InEuint128 memory encryptedAmount) external whenNotPaused {
        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);

        euint128 ltvLimit = FHE.asEuint128(_getLTVForUser(msg.sender));
        FHE.allowThis(ltvLimit);

        euint128 maxBorrowScaled = FHE.mul(collateral[msg.sender], ltvLimit);
        FHE.allowThis(maxBorrowScaled);
        euint128 maxBorrow = FHE.div(maxBorrowScaled, FHE.asEuint128(10000));
        FHE.allowThis(maxBorrow);

        euint128 candidateDebt = FHE.add(debt[msg.sender], amount);
        FHE.allowThis(candidateDebt);
        ebool withinLTV = FHE.lte(candidateDebt, maxBorrow);
        FHE.allowThis(withinLTV);

        euint128 updatedDebt = FHE.select(withinLTV, candidateDebt, debt[msg.sender]);
        FHE.allowThis(updatedDebt);
        debt[msg.sender] = updatedDebt;

        FHE.allowThis(debt[msg.sender]);
        FHE.allow(debt[msg.sender], msg.sender);

        euint128 acceptedDebtDelta = FHE.select(withinLTV, amount, FHE.asEuint128(0));
        FHE.allowThis(acceptedDebtDelta);
        euint128 updatedPoolDebt = FHE.add(totalPoolDebt, acceptedDebtDelta);
        FHE.allowThis(updatedPoolDebt);
        totalPoolDebt = updatedPoolDebt;
        FHE.allowThis(totalPoolDebt);

        emit BorrowSubmitted(msg.sender);
    }

    function repay(InEuint128 memory encryptedAmount) external {
        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);

        euint128 debtBefore = debt[msg.sender];
        ebool withinDebt = FHE.lte(amount, debtBefore);
        FHE.allowThis(withinDebt);

        euint128 newDebtCandidate = FHE.sub(debtBefore, amount);
        FHE.allowThis(newDebtCandidate);
        euint128 zero = FHE.asEuint128(0);
        FHE.allowThis(zero);

        euint128 updatedDebt = FHE.select(withinDebt, newDebtCandidate, zero);
        FHE.allowThis(updatedDebt);
        debt[msg.sender] = updatedDebt;

        FHE.allowThis(debt[msg.sender]);
        FHE.allow(debt[msg.sender], msg.sender);

        euint128 repaidAmount = FHE.select(withinDebt, amount, debtBefore);
        FHE.allowThis(repaidAmount);
        _decreasePoolDebt(repaidAmount);

        ebool hasRepayment = FHE.gt(repaidAmount, zero);
        FHE.allowThis(hasRepayment);
        euint128 incrementedRepaymentCount = FHE.add(repaymentCount[msg.sender], FHE.asEuint128(1));
        FHE.allowThis(incrementedRepaymentCount);

        euint128 updatedRepaymentCount = FHE.select(
            hasRepayment,
            incrementedRepaymentCount,
            repaymentCount[msg.sender]
        );
        FHE.allowThis(updatedRepaymentCount);
        repaymentCount[msg.sender] = updatedRepaymentCount;

        FHE.allowThis(repaymentCount[msg.sender]);
        FHE.allow(repaymentCount[msg.sender], msg.sender);

        emit RepaySubmitted(msg.sender);
        emit RepaymentSettlementIntent(msg.sender, block.timestamp);
    }

    function withdraw(InEuint128 memory encryptedAmount) external {
        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);

        ebool withinCollateral = FHE.lte(amount, collateral[msg.sender]);
        FHE.allowThis(withinCollateral);

        euint128 nextCollateralCandidate = FHE.sub(collateral[msg.sender], amount);
        FHE.allowThis(nextCollateralCandidate);

        euint128 updatedCollateral = FHE.select(
            withinCollateral,
            nextCollateralCandidate,
            collateral[msg.sender]
        );
        FHE.allowThis(updatedCollateral);
        collateral[msg.sender] = updatedCollateral;

        FHE.allowThis(collateral[msg.sender]);
        FHE.allow(collateral[msg.sender], msg.sender);

        euint128 withdrawnAmount = FHE.select(withinCollateral, amount, FHE.asEuint128(0));
        FHE.allowThis(withdrawnAmount);
        _decreasePoolCollateral(withdrawnAmount);

        emit WithdrawSubmitted(msg.sender);
    }

    function getHealthFactor(address user) external returns (euint128) {
        euint128 healthFactor = _computeHealthFactor(user);
        FHE.allow(healthFactor, msg.sender);

        emit HealthFactorHandle(user, uint256(euint128.unwrap(healthFactor)));

        return healthFactor;
    }

    function requestLiquidationCheck(address user) external returns (uint256 requestId) {
        euint128 healthFactor = _computeHealthFactor(user);
        requestId = _requestDecrypt(healthFactor);
        pendingLiquidationChecks[requestId] = user;

        emit LiquidationCheckRequested(user, requestId);
    }

    function onLiquidationResult(uint256 requestId, uint128 result) external onlyCoFHE {
        address user = pendingLiquidationChecks[requestId];
        require(user != address(0), "No pending check");

        if (result < LIQUIDATION_THRESHOLD) {
            liquidatable[user] = true;

            euint128 updatedDefaultCount = FHE.add(defaultCount[user], FHE.asEuint128(1));
            FHE.allowThis(updatedDefaultCount);
            defaultCount[user] = updatedDefaultCount;
            FHE.allowThis(defaultCount[user]);
            FHE.allow(defaultCount[user], user);

            emit LiquidationTriggered(user);
        }

        delete pendingLiquidationChecks[requestId];
    }

    function openAuction(address borrower) external {
        require(liquidatable[borrower], "Borrower not liquidatable");

        LiquidationAuction storage current = auctions[borrower];
        bool hasUnsettledAuction = current.borrower != address(0) && !current.settled;
        require(!hasUnsettledAuction, "Auction already exists");

        delete auctions[borrower];

        LiquidationAuction storage auction = auctions[borrower];
        auction.borrower = borrower;
        auction.endTime = block.timestamp + BID_WINDOW;
        auction.settled = false;

        if (!hasAuctionHistory[borrower]) {
            hasAuctionHistory[borrower] = true;
            auctionBorrowers.push(borrower);
        }

        emit AuctionOpened(borrower, auction.endTime);
    }

    function submitBid(address borrower, InEuint128 memory encryptedPenalty) external {
        require(liquidatable[borrower], "Borrower not liquidatable");

        LiquidationAuction storage auction = auctions[borrower];
        require(auction.borrower == borrower && auction.endTime != 0, "Auction not open");
        require(!auction.settled, "Auction settled");
        require(block.timestamp < auction.endTime, "Bidding closed");

        uint256 bidderCount = auction.bidders.length;
        for (uint256 i = 0; i < bidderCount; i++) {
            require(auction.bidders[i] != msg.sender, "Bidder already submitted");
        }

        euint128 bid = FHE.asEuint128(encryptedPenalty);
        FHE.allowThis(bid);

        auction.bids.push(bid);
        auction.bidders.push(msg.sender);

        emit BidSubmitted(borrower, msg.sender);
    }

    function selectWinningBid(address borrower) external returns (uint256 requestId) {
        LiquidationAuction storage auction = auctions[borrower];
        require(auction.borrower == borrower && auction.endTime != 0, "Auction not found");
        require(block.timestamp >= auction.endTime, "Auction not ended");
        require(!auction.settled, "Auction already settled");
        require(auction.bids.length > 0, "No bids submitted");

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
        pendingWinnerChecks[requestId] = borrower;
        pendingWinnerRequestByBorrower[borrower] = requestId;

        emit SelectionRequested(borrower, requestId);
    }

    function onWinnerSelected(uint256 requestId, uint128 result) external onlyCoFHE {
        address borrower = pendingWinnerChecks[requestId];
        require(borrower != address(0), "No pending winner check");

        LiquidationAuction storage auction = auctions[borrower];
        require(!auction.settled, "Auction already settled");

        uint256 winnerIndex = uint256(result);
        require(winnerIndex < auction.bidders.length, "Invalid winner index");

        auction.settled = true;
        liquidatable[borrower] = false;

        emit AuctionSettled(borrower, auction.bidders[winnerIndex]);

        delete pendingWinnerChecks[requestId];
        delete pendingWinnerRequestByBorrower[borrower];
    }

    function requestCreditTierUpdate(address user) external returns (uint256 requestId) {
        euint128 count = repaymentCount[user];
        FHE.allowThis(count);

        requestId = _requestDecrypt(count);
        pendingCreditUpdates[requestId] = user;

        emit CreditTierUpdateRequested(user, requestId);
    }

    function onCreditCountDecrypted(uint256 requestId, uint128 result) external onlyCoFHE {
        address user = pendingCreditUpdates[requestId];
        require(user != address(0), "No pending credit update");

        uint8 tier = _tierFromRepaymentCount(result);
        creditTier[user] = tier;

        emit CreditTierUpdated(user, tier);

        delete pendingCreditUpdates[requestId];
    }

    function postOffer(
        InEuint128 memory encAPR,
        InEuint128 memory encSize,
        InEuint128 memory encTenor
    ) external returns (uint256 offerId) {
        offerId = offerCount;
        offerCount = offerCount + 1;

        LoanOffer storage offer = offers[offerId];
        offer.lender = msg.sender;

        offer.encryptedAPR = FHE.asEuint128(encAPR);
        FHE.allowThis(offer.encryptedAPR);
        offer.encryptedSize = FHE.asEuint128(encSize);
        FHE.allowThis(offer.encryptedSize);
        offer.encryptedTenor = FHE.asEuint128(encTenor);
        FHE.allowThis(offer.encryptedTenor);

        offer.active = true;

        FHE.allow(offer.encryptedAPR, msg.sender);
        FHE.allow(offer.encryptedSize, msg.sender);
        FHE.allow(offer.encryptedTenor, msg.sender);

        emit OfferPosted(offerId, msg.sender);
    }

    function matchOffer(uint256 offerId) external {
        LoanOffer storage offer = offers[offerId];
        require(offer.active, "Offer not active");
        require(offer.matchedBorrower == address(0), "Already matched");
        require(offer.lender != msg.sender, "Lender cannot self-match");

        offer.active = false;
        offer.matchedBorrower = msg.sender;

        FHE.allow(offer.encryptedAPR, msg.sender);
        FHE.allow(offer.encryptedSize, msg.sender);
        FHE.allow(offer.encryptedTenor, msg.sender);

        emit OfferMatched(offerId, msg.sender);
    }

    function registerENSWallet(string memory ensName, address additionalWallet) external {
        require(bytes(ensName).length > 0, "ENS name required");
        require(additionalWallet != address(0), "Invalid wallet");
        require(additionalWallet != msg.sender, "Cannot link self");
        require(walletToENS[additionalWallet] == address(0), "Wallet already linked");

        address[] storage linkedWallets = ensWallets[msg.sender];
        for (uint256 i = 0; i < linkedWallets.length; i++) {
            require(linkedWallets[i] != additionalWallet, "Wallet already added");
        }

        linkedWallets.push(additionalWallet);
        walletToENS[additionalWallet] = msg.sender;

        emit ENSWalletAdded(msg.sender, additionalWallet, ensName);
    }

    function getAggregatedCollateral(address primaryWallet) external returns (euint128) {
        euint128 aggregated = collateral[primaryWallet];
        FHE.allowThis(aggregated);

        address[] storage linkedWallets = ensWallets[primaryWallet];
        for (uint256 i = 0; i < linkedWallets.length; i++) {
            euint128 nextAggregated = FHE.add(aggregated, collateral[linkedWallets[i]]);
            FHE.allowThis(nextAggregated);
            aggregated = nextAggregated;
        }

        FHE.allow(aggregated, msg.sender);

        emit AggregatedCollateralHandle(primaryWallet, uint256(euint128.unwrap(aggregated)));

        return aggregated;
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

    function getAuctionBidCount(address borrower) external view returns (uint256) {
        return auctions[borrower].bids.length;
    }

    function getAuctionBidder(address borrower, uint256 index) external view returns (address) {
        LiquidationAuction storage auction = auctions[borrower];
        require(index < auction.bidders.length, "Bidder index out of bounds");

        return auction.bidders[index];
    }

    function getAuctionBorrowers() external view returns (address[] memory) {
        return auctionBorrowers;
    }

    function getPendingWinnerRequestId(address borrower) external view returns (uint256) {
        return pendingWinnerRequestByBorrower[borrower];
    }

    function getLinkedWalletCount(address primaryWallet) external view returns (uint256) {
        return ensWallets[primaryWallet].length;
    }

    function getLinkedWallets(address primaryWallet) external view returns (address[] memory) {
        return ensWallets[primaryWallet];
    }

    function getOfferMeta(uint256 offerId)
        external
        view
        returns (address lender, bool active, address matchedBorrower)
    {
        LoanOffer storage offer = offers[offerId];
        return (offer.lender, offer.active, offer.matchedBorrower);
    }

    function getEncryptedOfferAPR(uint256 offerId) external view returns (EncryptedValue memory) {
        return EncryptedValue({ctHash: uint256(euint128.unwrap(offers[offerId].encryptedAPR)), utype: EUINT128_UTYPE});
    }

    function getEncryptedOfferSize(uint256 offerId) external view returns (EncryptedValue memory) {
        return EncryptedValue({ctHash: uint256(euint128.unwrap(offers[offerId].encryptedSize)), utype: EUINT128_UTYPE});
    }

    function getEncryptedOfferTenor(uint256 offerId) external view returns (EncryptedValue memory) {
        return EncryptedValue({ctHash: uint256(euint128.unwrap(offers[offerId].encryptedTenor)), utype: EUINT128_UTYPE});
    }

    function getEncryptedCollateral(address user) external view returns (EncryptedValue memory) {
        return EncryptedValue({ctHash: uint256(euint128.unwrap(collateral[user])), utype: EUINT128_UTYPE});
    }

    function getEncryptedDebt(address user) external view returns (EncryptedValue memory) {
        return EncryptedValue({ctHash: uint256(euint128.unwrap(debt[user])), utype: EUINT128_UTYPE});
    }

    function getEncryptedRepaymentCount(address user) external view returns (EncryptedValue memory) {
        return EncryptedValue({ctHash: uint256(euint128.unwrap(repaymentCount[user])), utype: EUINT128_UTYPE});
    }

    function getEncryptedDefaultCount(address user) external view returns (EncryptedValue memory) {
        return EncryptedValue({ctHash: uint256(euint128.unwrap(defaultCount[user])), utype: EUINT128_UTYPE});
    }

    function getEncryptedTotalPoolCollateral() external view returns (EncryptedValue memory) {
        return EncryptedValue({ctHash: uint256(euint128.unwrap(totalPoolCollateral)), utype: EUINT128_UTYPE});
    }

    function getEncryptedTotalPoolDebt() external view returns (EncryptedValue memory) {
        return EncryptedValue({ctHash: uint256(euint128.unwrap(totalPoolDebt)), utype: EUINT128_UTYPE});
    }

    function _requestDecrypt(euint128 value) internal returns (uint256 requestId) {
        requestId = uint256(euint128.unwrap(value));
        FHE.allowGlobal(value);
        ITaskManager(TASK_MANAGER_ADDRESS).createDecryptTask(requestId, address(this));
    }

    function _computeHealthFactor(address user) internal returns (euint128) {
        euint128 zero = FHE.asEuint128(0);
        FHE.allowThis(zero);
        euint128 one = FHE.asEuint128(1);
        FHE.allowThis(one);

        ebool debtIsZero = FHE.eq(debt[user], zero);
        FHE.allowThis(debtIsZero);

        euint128 safeDebt = FHE.select(debtIsZero, one, debt[user]);
        FHE.allowThis(safeDebt);

        euint128 scaledCollateral = FHE.mul(collateral[user], FHE.asEuint128(10000));
        FHE.allowThis(scaledCollateral);

        euint128 healthFactor = FHE.div(scaledCollateral, safeDebt);
        FHE.allowThis(healthFactor);

        return healthFactor;
    }

    function _decreasePoolCollateral(euint128 amount) internal {
        euint128 zero = FHE.asEuint128(0);
        FHE.allowThis(zero);

        ebool enoughCollateral = FHE.lte(amount, totalPoolCollateral);
        FHE.allowThis(enoughCollateral);

        euint128 reducedPoolCollateral = FHE.sub(totalPoolCollateral, amount);
        FHE.allowThis(reducedPoolCollateral);

        euint128 updatedPoolCollateral = FHE.select(enoughCollateral, reducedPoolCollateral, zero);
        FHE.allowThis(updatedPoolCollateral);
        totalPoolCollateral = updatedPoolCollateral;

        FHE.allowThis(totalPoolCollateral);
    }

    function _decreasePoolDebt(euint128 amount) internal {
        euint128 zero = FHE.asEuint128(0);
        FHE.allowThis(zero);

        ebool enoughDebt = FHE.lte(amount, totalPoolDebt);
        FHE.allowThis(enoughDebt);

        euint128 reducedPoolDebt = FHE.sub(totalPoolDebt, amount);
        FHE.allowThis(reducedPoolDebt);

        euint128 updatedPoolDebt = FHE.select(enoughDebt, reducedPoolDebt, zero);
        FHE.allowThis(updatedPoolDebt);
        totalPoolDebt = updatedPoolDebt;

        FHE.allowThis(totalPoolDebt);
    }

    function _getLTVForUser(address user) internal view returns (uint256) {
        return TIER_LTV[creditTier[user]];
    }

    function _tierFromRepaymentCount(uint128 count) internal pure returns (uint8) {
        if (count >= 10) return 4;
        if (count >= 7) return 3;
        if (count >= 4) return 2;
        if (count >= 2) return 1;
        return 0;
    }
}
