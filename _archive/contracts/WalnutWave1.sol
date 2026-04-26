// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {FHE, ebool, euint128} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {InEuint128} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";

contract WalnutWave1 {
    struct EncryptedValue {
        uint256 ctHash;
        uint8 utype;
    }

    mapping(address => euint128) private collateral;
    mapping(address => euint128) private debt;

    // Events intentionally avoid ciphertext payloads because ciphertext metadata is still observable.
    event DepositSubmitted(address indexed user);
    event BorrowSubmitted(address indexed user);

    function deposit(InEuint128 memory encryptedAmount) external {
        euint128 amount = FHE.asEuint128(encryptedAmount);
        collateral[msg.sender] = FHE.add(collateral[msg.sender], amount);

        FHE.allowThis(collateral[msg.sender]);
        FHE.allow(collateral[msg.sender], msg.sender);

        emit DepositSubmitted(msg.sender);
    }

    function borrow(InEuint128 memory encryptedAmount) external {
        euint128 amount = FHE.asEuint128(encryptedAmount);
        euint128 candidateDebt = FHE.add(debt[msg.sender], amount);
        ebool withinCollateral = FHE.lte(candidateDebt, collateral[msg.sender]);

        // Guardrail: debt only advances when encrypted comparison passes.
        debt[msg.sender] = FHE.select(withinCollateral, candidateDebt, debt[msg.sender]);

        FHE.allowThis(debt[msg.sender]);
        FHE.allow(debt[msg.sender], msg.sender);

        emit BorrowSubmitted(msg.sender);
    }

    function getEncryptedCollateral(address user) external view returns (EncryptedValue memory) {
        return EncryptedValue({ctHash: uint256(euint128.unwrap(collateral[user])), utype: 6});
    }

    function getEncryptedDebt(address user) external view returns (EncryptedValue memory) {
        return EncryptedValue({ctHash: uint256(euint128.unwrap(debt[user])), utype: 6});
    }
}
