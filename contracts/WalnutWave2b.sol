// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {FHE, ebool, euint128} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {InEuint128} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";

contract WalnutWave2b {
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

    mapping(address => euint128) private collateral;
    mapping(address => euint128) private debt;
    mapping(address => bool) public liquidatable;
    mapping(uint256 => address) private pendingLiquidationChecks;

    mapping(address => LiquidationAuction) public auctions;
    mapping(uint256 => address) private pendingWinnerChecks;
    mapping(address => uint256) public pendingWinnerRequestByBorrower;
    address[] private auctionBorrowers;
    mapping(address => bool) private hasAuctionHistory;

    mapping(address => address[]) public ensWallets;
    mapping(address => address) public walletToENS;

    uint256 public constant LIQUIDATION_THRESHOLD = 10500;
    uint256 public constant LTV_LIMIT = 8000;
    uint256 public constant BID_WINDOW = 10 minutes;

    event DepositSubmitted(address indexed user);
    event BorrowSubmitted(address indexed user);
    event RepaySubmitted(address indexed user);
    event WithdrawSubmitted(address indexed user);
    event LiquidationCheckRequested(address indexed user, uint256 requestId);
    event LiquidationTriggered(address indexed user);
    event RepaymentSettlementIntent(address indexed user, uint256 timestamp);

    event AuctionOpened(address indexed borrower, uint256 endTime);
    event BidSubmitted(address indexed borrower, address indexed bidder);
    event SelectionRequested(address indexed borrower);
    event AuctionSettled(address indexed borrower, address indexed winner);

    event ENSWalletAdded(address indexed primary, address indexed additional, string ensName);
    event HealthFactorHandle(address indexed user, uint256 ctHash);
    event AggregatedCollateralHandle(address indexed primaryWallet, uint256 ctHash);

    function deposit(InEuint128 memory encryptedAmount) external {
        euint128 amount = FHE.asEuint128(encryptedAmount);
        collateral[msg.sender] = FHE.add(collateral[msg.sender], amount);

        FHE.allowThis(collateral[msg.sender]);
        FHE.allow(collateral[msg.sender], msg.sender);

        emit DepositSubmitted(msg.sender);
    }

    function borrow(InEuint128 memory encryptedAmount) external {
        euint128 amount = FHE.asEuint128(encryptedAmount);

        euint128 maxBorrowScaled = FHE.mul(collateral[msg.sender], FHE.asEuint128(LTV_LIMIT));
        euint128 maxBorrow = FHE.div(maxBorrowScaled, FHE.asEuint128(10000));

        euint128 candidateDebt = FHE.add(debt[msg.sender], amount);
        ebool withinLTV = FHE.lte(candidateDebt, maxBorrow);

        debt[msg.sender] = FHE.select(withinLTV, candidateDebt, debt[msg.sender]);

        FHE.allowThis(debt[msg.sender]);
        FHE.allow(debt[msg.sender], msg.sender);

        emit BorrowSubmitted(msg.sender);
    }

    function repay(InEuint128 memory encryptedAmount) external {
        euint128 amount = FHE.asEuint128(encryptedAmount);

        ebool withinDebt = FHE.lte(amount, debt[msg.sender]);
        euint128 newDebt = FHE.sub(debt[msg.sender], amount);
        euint128 zeroDebt = FHE.asEuint128(0);

        debt[msg.sender] = FHE.select(withinDebt, newDebt, zeroDebt);

        FHE.allowThis(debt[msg.sender]);
        FHE.allow(debt[msg.sender], msg.sender);

        emit RepaySubmitted(msg.sender);
        emit RepaymentSettlementIntent(msg.sender, block.timestamp);
    }

    function withdraw(InEuint128 memory encryptedAmount) external {
        euint128 amount = FHE.asEuint128(encryptedAmount);

        euint128 available = FHE.sub(collateral[msg.sender], debt[msg.sender]);
        ebool withinAvailable = FHE.lte(amount, available);

        euint128 newCollateral = FHE.sub(collateral[msg.sender], amount);
        collateral[msg.sender] = FHE.select(withinAvailable, newCollateral, collateral[msg.sender]);

        FHE.allowThis(collateral[msg.sender]);
        FHE.allow(collateral[msg.sender], msg.sender);

        emit WithdrawSubmitted(msg.sender);
    }

    function getHealthFactor(address user) external returns (euint128) {
        euint128 safeDebt = FHE.select(
            FHE.eq(debt[user], FHE.asEuint128(0)),
            FHE.asEuint128(1),
            debt[user]
        );
        euint128 scaledCollateral = FHE.mul(collateral[user], FHE.asEuint128(10000));
        euint128 healthFactor = FHE.div(scaledCollateral, safeDebt);

        FHE.allow(healthFactor, msg.sender);

        emit HealthFactorHandle(user, uint256(euint128.unwrap(healthFactor)));

        return healthFactor;
    }

    function requestLiquidationCheck(address user) external returns (bytes32) {
        euint128 safeDebt = FHE.select(
            FHE.eq(debt[user], FHE.asEuint128(0)),
            FHE.asEuint128(1),
            debt[user]
        );
        euint128 scaledCollateral = FHE.mul(collateral[user], FHE.asEuint128(10000));
        euint128 healthFactor = FHE.div(scaledCollateral, safeDebt);

        uint256 ctHash = euint128.unwrap(healthFactor);
        FHE.allowGlobal(healthFactor);
        FHE.decrypt(healthFactor);

        pendingLiquidationChecks[ctHash] = user;

        emit LiquidationCheckRequested(user, ctHash);

        return bytes32(ctHash);
    }

    function submitLiquidationCheck(bytes32 ctHash) external {
        address user = pendingLiquidationChecks[uint256(ctHash)];
        require(user != address(0), "No pending check");

        (uint256 decryptedResult, bool isReady) = FHE.getDecryptResultSafe(uint256(ctHash));
        require(isReady, "Decrypt result not ready");

        onLiquidationCheckResult(user, uint128(decryptedResult));

        delete pendingLiquidationChecks[uint256(ctHash)];
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

    function selectWinningBid(address borrower) external {
        LiquidationAuction storage auction = auctions[borrower];
        require(auction.borrower == borrower && auction.endTime != 0, "Auction not found");
        require(block.timestamp >= auction.endTime, "Auction not ended");
        require(!auction.settled, "Auction already settled");
        require(auction.bids.length > 0, "No bids submitted");

        euint128 minBid = auction.bids[0];
        euint128 winnerIdx = FHE.asEuint128(0);

        for (uint256 i = 1; i < auction.bids.length; i++) {
            ebool isLower = FHE.lte(auction.bids[i], minBid);
            minBid = FHE.select(isLower, auction.bids[i], minBid);
            FHE.allowThis(minBid);
            winnerIdx = FHE.select(isLower, FHE.asEuint128(i), winnerIdx);
            FHE.allowThis(winnerIdx);
        }

        uint256 reqId = euint128.unwrap(winnerIdx);
        FHE.allowGlobal(winnerIdx);
        FHE.decrypt(winnerIdx);

        pendingWinnerChecks[reqId] = borrower;
        pendingWinnerRequestByBorrower[borrower] = reqId;

        emit SelectionRequested(borrower);
    }

    function finalizeWinnerSelection(uint256 reqId) external {
        address borrower = pendingWinnerChecks[reqId];
        require(borrower != address(0), "No pending winner check");

        (uint256 decryptedResult, bool isReady) = FHE.getDecryptResultSafe(reqId);
        require(isReady, "Decrypt result not ready");

        this.onWinnerSelected(reqId, uint128(decryptedResult));
    }

    function onWinnerSelected(uint256 reqId, uint128 result) external {
        require(msg.sender == address(this), "Only self");

        address borrower = pendingWinnerChecks[reqId];
        require(borrower != address(0), "No pending winner check");

        LiquidationAuction storage auction = auctions[borrower];
        require(!auction.settled, "Auction already settled");

        uint256 winnerIndex = uint256(result);
        require(winnerIndex < auction.bidders.length, "Invalid winner index");

        auction.settled = true;
        liquidatable[borrower] = false;

        emit AuctionSettled(borrower, auction.bidders[winnerIndex]);

        delete pendingWinnerChecks[reqId];
        delete pendingWinnerRequestByBorrower[borrower];
    }

    function registerENSWallet(string memory ensName, address additionalWallet) external {
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

        address[] storage linkedWallets = ensWallets[primaryWallet];
        for (uint256 i = 0; i < linkedWallets.length; i++) {
            aggregated = FHE.add(aggregated, collateral[linkedWallets[i]]);
            FHE.allowThis(aggregated);
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

    function getEncryptedCollateral(address user) external view returns (EncryptedValue memory) {
        return EncryptedValue({ctHash: uint256(euint128.unwrap(collateral[user])), utype: 6}); // FheTypes.Uint128 = 6 per @cofhe/sdk FheTypes enum
    }

    function getEncryptedDebt(address user) external view returns (EncryptedValue memory) {
        return EncryptedValue({ctHash: uint256(euint128.unwrap(debt[user])), utype: 6}); // FheTypes.Uint128 = 6 per @cofhe/sdk FheTypes enum
    }

    function onLiquidationCheckResult(address user, uint128 result) internal {
        if (result < LIQUIDATION_THRESHOLD) {
            liquidatable[user] = true;
            emit LiquidationTriggered(user);
        }
    }
}
