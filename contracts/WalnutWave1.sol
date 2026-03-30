// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {FHE, euint128} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {InEuint128} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";

contract WalnutWave1 {
    mapping(address => euint128) private collateral;
    mapping(address => euint128) private debt;

    event Deposited(address indexed user, bytes32 encryptedAmount, bytes32 newEncryptedCollateral);
    event Borrowed(address indexed user, bytes32 encryptedAmount, bytes32 newEncryptedDebt);

    function deposit(InEuint128 memory encryptedAmount) external {
        euint128 amount = FHE.asEuint128(encryptedAmount);
        collateral[msg.sender] = FHE.add(collateral[msg.sender], amount);

        emit Deposited(msg.sender, euint128.unwrap(amount), euint128.unwrap(collateral[msg.sender]));
    }

    function borrow(InEuint128 memory encryptedAmount) external {
        euint128 amount = FHE.asEuint128(encryptedAmount);
        debt[msg.sender] = FHE.add(debt[msg.sender], amount);

        emit Borrowed(msg.sender, euint128.unwrap(amount), euint128.unwrap(debt[msg.sender]));
    }

    function getEncryptedCollateral(address user) external view returns (bytes32) {
        return euint128.unwrap(collateral[user]);
    }

    function getEncryptedDebt(address user) external view returns (bytes32) {
        return euint128.unwrap(debt[user]);
    }
}
