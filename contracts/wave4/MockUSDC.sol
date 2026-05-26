// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice MockUSDC: Testnet Collateral Token Contract

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice Testnet USDC token with open minting for testing purposes
 * @dev Extends OpenZeppelin ERC20 with 6 decimals (matching real USDC)
 * 
 * Requirements:
 * - 6 decimals (USDC standard)
 * - Public mint function with no access control
 * - Name: "Mock USDC", Symbol: "USDC"
 * - Standard ERC20 operations (transfer, approve, transferFrom)
 */
contract MockUSDC is ERC20 {
    /**
     * @notice Initializes the MockUSDC token
     * @dev Sets name to "Mock USDC" and symbol to "USDC"
     */
    constructor() ERC20("Mock USDC", "USDC") {}

    /**
     * @notice Returns the number of decimals used by the token
     * @dev Overrides ERC20 default (18) to return 6 (USDC standard)
     * @return uint8 The number of decimals (6)
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /**
     * @notice Mints new tokens to a specified address
     * @dev Public function with no access control for testnet convenience
     * @param to The address to receive the minted tokens
     * @param amount The amount of tokens to mint (in 6 decimal precision)
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
