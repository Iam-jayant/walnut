// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {FHE, ebool, euint128} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {InEuint128} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";

contract WalnutWave2 {
    struct EncryptedValue {
        uint256 ctHash;
        uint8 utype;
    }

    mapping(address => euint128) private collateral;
    mapping(address => euint128) private debt;
    mapping(address => bool) public liquidatable;
    mapping(uint256 => address) private pendingLiquidationChecks;

    uint256 public constant LIQUIDATION_THRESHOLD = 10500;
    uint256 public constant LTV_LIMIT = 8000;

    event DepositSubmitted(address indexed user);
    event BorrowSubmitted(address indexed user);
    event RepaySubmitted(address indexed user);
    event WithdrawSubmitted(address indexed user);
    event LiquidationCheckRequested(address indexed user, uint256 requestId);
    event LiquidationTriggered(address indexed user);
    event RepaymentSettlementIntent(address indexed user, uint256 timestamp);

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
        euint128 scaledCollateral = FHE.mul(collateral[user], FHE.asEuint128(10000));
        euint128 healthFactor = FHE.div(scaledCollateral, debt[user]);
        
        FHE.allow(healthFactor, msg.sender);
        
        return healthFactor;
    }

    function requestLiquidationCheck(address user) external returns (bytes32) {
        euint128 scaledCollateral = FHE.mul(collateral[user], FHE.asEuint128(10000));
        euint128 healthFactor = FHE.div(scaledCollateral, debt[user]);
        
        uint256 ctHash = euint128.unwrap(healthFactor);
        FHE.allowGlobal(healthFactor);
        FHE.decrypt(healthFactor);
        
        pendingLiquidationChecks[ctHash] = user;
        
        emit LiquidationCheckRequested(user, ctHash);
        
        return bytes32(ctHash);
    }

    function submitLiquidationCheck(
        bytes32 ctHash,
        bytes calldata signature
    ) external {
        address user = pendingLiquidationChecks[uint256(ctHash)];
        require(user != address(0), "No pending check");

        // Signature is kept in the function signature for frontend compatibility.
        // Validation uses CoFHE mock decrypt task result in local/testing environments.
        signature;

        (uint256 decryptedResult, bool isReady) = FHE.getDecryptResultSafe(uint256(ctHash));
        require(isReady, "Decrypt result not ready");

        onLiquidationCheckResult(user, uint128(decryptedResult));
        
        delete pendingLiquidationChecks[uint256(ctHash)];
    }

    function onLiquidationCheckResult(address user, uint128 result) internal {
        if (result < LIQUIDATION_THRESHOLD) {
            liquidatable[user] = true;
            emit LiquidationTriggered(user);
        }
    }

    function getEncryptedCollateral(address user) external view returns (EncryptedValue memory) {
        return EncryptedValue({ctHash: uint256(euint128.unwrap(collateral[user])), utype: 6});
    }

    function getEncryptedDebt(address user) external view returns (EncryptedValue memory) {
        return EncryptedValue({ctHash: uint256(euint128.unwrap(debt[user])), utype: 6});
    }
}
