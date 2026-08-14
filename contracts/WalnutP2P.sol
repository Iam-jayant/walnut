// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title WalnutP2P — Confidential P2P Lending Marketplace
/// @notice Enables peer-to-peer loan term matching with zero plaintext disclosure.
///         Principal, interest rate, and duration are encrypted end-to-end (euint128).
///         Matching is performed homomorphically via FHE.eq.
/// @dev Requires @fhenixprotocol/cofhe-contracts ^0.5, @openzeppelin/contracts ^5.

import {FHE, ebool, euint128, TASK_MANAGER_ADDRESS} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {InEuint128, ITaskManager} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IWalnutStablecoin {
    function mintInternal(address to, euint128 amount) external;
    function burnInternal(address from, euint128 amount) external returns (ebool);
}

contract WalnutP2P is ReentrancyGuard {
    enum OfferType { LEND, BORROW }
    enum OfferState { OPEN, MATCH_PENDING, FILLED, CANCELLED }

    struct P2POffer {
        uint256 offerId;
        address creator;
        OfferType offerType;
        OfferState state;
        euint128 encPrincipal;
        euint128 encInterestRate;
        euint128 encDuration;
        uint256 createdAt;
    }

    /// @notice Public ABI-safe view struct for P2P offers (ctHashes only).
    struct P2POfferInfo {
        uint256 offerId;
        address creator;
        OfferType offerType;
        OfferState state;
        uint256 principalHandle;
        uint256 rateHandle;
        uint256 durationHandle;
        uint256 createdAt;
    }

    struct PendingMatch {
        uint256 offerId;
        address counterparty;
        euint128 matchPrincipal;
    }

    IWalnutStablecoin public immutable stablecoin;
    address public owner;
    bool public paused;
    uint256 public offerCounter;

    mapping(uint256 => P2POffer) private _offers;
    mapping(uint256 => PendingMatch) private _pendingMatches;

    // ─── Events (Privacy-Safe: NO plaintext financial amounts) ─────────────────
    event OfferCreated(uint256 indexed offerId, address indexed creator, OfferType offerType);
    event MatchRequested(uint256 indexed offerId, address indexed counterparty, uint256 requestId);
    event OfferMatched(uint256 indexed offerId, address indexed creator, address indexed counterparty);
    event MatchFailed(uint256 indexed offerId, address indexed counterparty);
    event OfferCancelled(uint256 indexed offerId, address indexed creator);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Marketplace paused");
        _;
    }

    constructor(address _stablecoin) {
        require(_stablecoin != address(0), "Invalid stablecoin");
        stablecoin = IWalnutStablecoin(_stablecoin);
        owner = msg.sender;
    }

    /// @notice Create a confidential P2P offer (Lend or Borrow) with encrypted terms.
    function createOffer(
        OfferType offerType,
        InEuint128 calldata encPrincipalInput,
        InEuint128 calldata encRateInput,
        InEuint128 calldata encDurationInput
    ) external nonReentrant whenNotPaused returns (uint256) {
        euint128 principal = FHE.asEuint128(encPrincipalInput);
        euint128 rate = FHE.asEuint128(encRateInput);
        euint128 duration = FHE.asEuint128(encDurationInput);

        FHE.allowThis(principal);
        FHE.allowThis(rate);
        FHE.allowThis(duration);

        // Allow creator to decrypt their own terms
        FHE.allow(principal, msg.sender);
        FHE.allow(rate, msg.sender);
        FHE.allow(duration, msg.sender);

        // If LEND offer, escrow principal by burning from lender
        if (offerType == OfferType.LEND) {
            FHE.allowTransient(principal, address(stablecoin));
            ebool burnSuccess = stablecoin.burnInternal(msg.sender, principal);
            FHE.allowThis(burnSuccess);
        }

        uint256 offerId = offerCounter++;
        _offers[offerId] = P2POffer({
            offerId: offerId,
            creator: msg.sender,
            offerType: offerType,
            state: OfferState.OPEN,
            encPrincipal: principal,
            encInterestRate: rate,
            encDuration: duration,
            createdAt: block.timestamp
        });

        emit OfferCreated(offerId, msg.sender, offerType);
        return offerId;
    }

    /// @notice Attempt to match an open P2P offer by submitting matching encrypted terms.
    function matchOffer(
        uint256 offerId,
        InEuint128 calldata matchPrincipalInput,
        InEuint128 calldata matchRateInput,
        InEuint128 calldata matchDurationInput
    ) external nonReentrant whenNotPaused {
        P2POffer storage offer = _offers[offerId];
        require(offer.state == OfferState.OPEN, "Offer not open");
        require(offer.creator != msg.sender, "Cannot match own offer");

        euint128 matchPrincipal = FHE.asEuint128(matchPrincipalInput);
        euint128 matchRate = FHE.asEuint128(matchRateInput);
        euint128 matchDuration = FHE.asEuint128(matchDurationInput);

        FHE.allowThis(matchPrincipal);
        FHE.allowThis(matchRate);
        FHE.allowThis(matchDuration);

        // If BORROW offer counterparty (acting as Lender), escrow principal
        if (offer.offerType == OfferType.BORROW) {
            FHE.allowTransient(matchPrincipal, address(stablecoin));
            ebool burnSuccess = stablecoin.burnInternal(msg.sender, matchPrincipal);
            FHE.allowThis(burnSuccess);
        }

        // Perform homomorphic term equality check
        ebool principalMatch = FHE.eq(offer.encPrincipal, matchPrincipal);
        ebool rateMatch = FHE.eq(offer.encInterestRate, matchRate);
        ebool durationMatch = FHE.eq(offer.encDuration, matchDuration);

        ebool fullMatch = FHE.and(principalMatch, FHE.and(rateMatch, durationMatch));
        FHE.allowThis(fullMatch);

        offer.state = OfferState.MATCH_PENDING;

        // Decrypt SINGLE BOOLEAN (fullMatch) to execute settlement
        euint128 match128 = FHE.asEuint128(fullMatch);
        FHE.allowThis(match128);

        uint256 requestId = _requestDecrypt(match128);
        _pendingMatches[requestId] = PendingMatch({
            offerId: offerId,
            counterparty: msg.sender,
            matchPrincipal: matchPrincipal
        });

        emit MatchRequested(offerId, msg.sender, requestId);
    }

    /// @notice Create a P2P offer with plaintext amounts (TEST ONLY / OWNER ONLY).
    function createOfferPlaintext(
        OfferType offerType,
        uint128 principalVal,
        uint128 rateVal,
        uint128 durationVal
    ) external onlyOwner nonReentrant whenNotPaused returns (uint256) {
        euint128 principal = FHE.asEuint128(principalVal);
        euint128 rate = FHE.asEuint128(rateVal);
        euint128 duration = FHE.asEuint128(durationVal);

        FHE.allowThis(principal);
        FHE.allowThis(rate);
        FHE.allowThis(duration);

        FHE.allow(principal, msg.sender);
        FHE.allow(rate, msg.sender);
        FHE.allow(duration, msg.sender);

        if (offerType == OfferType.LEND) {
            FHE.allowTransient(principal, address(stablecoin));
            ebool burnSuccess = stablecoin.burnInternal(msg.sender, principal);
            FHE.allowThis(burnSuccess);
        }

        uint256 offerId = offerCounter++;
        _offers[offerId] = P2POffer({
            offerId: offerId,
            creator: msg.sender,
            offerType: offerType,
            state: OfferState.OPEN,
            encPrincipal: principal,
            encInterestRate: rate,
            encDuration: duration,
            createdAt: block.timestamp
        });

        emit OfferCreated(offerId, msg.sender, offerType);
        return offerId;
    }

    /// @notice Match an open P2P offer using plaintext amounts (TEST ONLY / OWNER ONLY).
    function matchOfferPlaintext(
        uint256 offerId,
        uint128 matchPrincipalVal,
        uint128 matchRateVal,
        uint128 matchDurationVal
    ) external onlyOwner nonReentrant whenNotPaused {
        P2POffer storage offer = _offers[offerId];
        require(offer.state == OfferState.OPEN, "Offer not open");
        require(offer.creator != msg.sender, "Cannot match own offer");

        euint128 matchPrincipal = FHE.asEuint128(matchPrincipalVal);
        euint128 matchRate = FHE.asEuint128(matchRateVal);
        euint128 matchDuration = FHE.asEuint128(matchDurationVal);

        FHE.allowThis(matchPrincipal);
        FHE.allowThis(matchRate);
        FHE.allowThis(matchDuration);

        if (offer.offerType == OfferType.BORROW) {
            FHE.allowTransient(matchPrincipal, address(stablecoin));
            ebool burnSuccess = stablecoin.burnInternal(msg.sender, matchPrincipal);
            FHE.allowThis(burnSuccess);
        }

        ebool principalMatch = FHE.eq(offer.encPrincipal, matchPrincipal);
        ebool rateMatch = FHE.eq(offer.encInterestRate, matchRate);
        ebool durationMatch = FHE.eq(offer.encDuration, matchDuration);

        ebool fullMatch = FHE.and(principalMatch, FHE.and(rateMatch, durationMatch));
        FHE.allowThis(fullMatch);

        offer.state = OfferState.MATCH_PENDING;

        euint128 match128 = FHE.asEuint128(fullMatch);
        FHE.allowThis(match128);

        uint256 requestId = _requestDecrypt(match128);
        _pendingMatches[requestId] = PendingMatch({
            offerId: offerId,
            counterparty: msg.sender,
            matchPrincipal: matchPrincipal
        });

        emit MatchRequested(offerId, msg.sender, requestId);
    }

    /// @notice CoFHE callback: finalize P2P match settlement based on single-boolean decrypt.
    function syncMatchSettlement(
        bytes32 ciphertext,
        uint128 result,
        bytes calldata signature
    ) external nonReentrant {
        uint256 requestId = uint256(ciphertext);
        PendingMatch memory pending = _pendingMatches[requestId];
        require(pending.counterparty != address(0), "Unknown match request");
        delete _pendingMatches[requestId];

        ITaskManager(TASK_MANAGER_ADDRESS).verifyDecryptResult(uint256(ciphertext), uint256(result), signature);

        P2POffer storage offer = _offers[pending.offerId];

        if (result == 1) {
            // Terms matched 100% in ciphertext! Finalize P2P loan settlement
            offer.state = OfferState.FILLED;

            address lender = offer.offerType == OfferType.LEND ? offer.creator : pending.counterparty;
            address borrower = offer.offerType == OfferType.LEND ? pending.counterparty : offer.creator;

            // Grant both parties access to view encrypted terms
            FHE.allow(offer.encPrincipal, lender);
            FHE.allow(offer.encPrincipal, borrower);
            FHE.allow(offer.encInterestRate, lender);
            FHE.allow(offer.encInterestRate, borrower);
            FHE.allow(offer.encDuration, lender);
            FHE.allow(offer.encDuration, borrower);

            // Transfer principal cUSDC to borrower
            FHE.allowTransient(offer.encPrincipal, address(stablecoin));
            stablecoin.mintInternal(borrower, offer.encPrincipal);

            emit OfferMatched(pending.offerId, offer.creator, pending.counterparty);
        } else {
            // Term mismatch — refund escrowed principal and return offer to OPEN
            offer.state = OfferState.OPEN;

            if (offer.offerType == OfferType.BORROW) {
                // Refund counterparty (Lender)
                FHE.allowTransient(pending.matchPrincipal, address(stablecoin));
                stablecoin.mintInternal(pending.counterparty, pending.matchPrincipal);
            }

            emit MatchFailed(pending.offerId, pending.counterparty);
        }
    }

    /// @notice Cancel an open P2P offer.
    function cancelOffer(uint256 offerId) external nonReentrant {
        P2POffer storage offer = _offers[offerId];
        require(offer.creator == msg.sender, "Not offer creator");
        require(offer.state == OfferState.OPEN, "Offer not open");

        offer.state = OfferState.CANCELLED;

        // Refund escrowed principal if LEND offer
        if (offer.offerType == OfferType.LEND) {
            FHE.allowTransient(offer.encPrincipal, address(stablecoin));
            stablecoin.mintInternal(msg.sender, offer.encPrincipal);
        }

        emit OfferCancelled(offerId, msg.sender);
    }

    /// @notice Get public-safe offer handles for frontend decryption via CoFHE permit.
    function getOfferInfo(uint256 offerId) external view returns (P2POfferInfo memory) {
        P2POffer storage offer = _offers[offerId];
        return P2POfferInfo({
            offerId: offer.offerId,
            creator: offer.creator,
            offerType: offer.offerType,
            state: offer.state,
            principalHandle: uint256(euint128.unwrap(offer.encPrincipal)),
            rateHandle: uint256(euint128.unwrap(offer.encInterestRate)),
            durationHandle: uint256(euint128.unwrap(offer.encDuration)),
            createdAt: offer.createdAt
        });
    }

    function _requestDecrypt(euint128 value) internal returns (uint256) {
        FHE.allowThis(value);
        FHE.allow(value, msg.sender);
        return uint256(euint128.unwrap(value));
    }

    function pause() external onlyOwner {
        paused = true;
    }

    function unpause() external onlyOwner {
        paused = false;
    }
}
