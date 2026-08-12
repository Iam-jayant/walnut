// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { FHERC20ERC20Wrapper } from "fhenix-confidential-contracts/contracts/FHERC20/extensions/FHERC20ERC20Wrapper.sol";
import { IERC20 } from "@openzeppelin/contracts/interfaces/IERC20.sol";
import { FHERC20 } from "fhenix-confidential-contracts/contracts/FHERC20/FHERC20.sol";

/**
 * @title WalnutVaultWrapper
 * @notice Wrapper for USDC to create confidential wUSDC (Walnut Wrapped USDC).
 * Uses fhenix-confidential-contracts FHERC20ERC20Wrapper extension.
 */
contract WalnutVaultWrapper is FHERC20ERC20Wrapper {
    constructor(
        address underlyingAsset
    ) 
        FHERC20("Walnut Wrapped USDC", "wUSDC", 6, "") 
        FHERC20ERC20Wrapper(IERC20(underlyingAsset))
    {}
}
