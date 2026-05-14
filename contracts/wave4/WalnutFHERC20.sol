// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {FHE, ebool, euint128} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {InEuint128} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";

/**
 * @title WalnutFHERC20
 * @notice Encrypted ERC20 token (wUSDC) with FHE-based privacy
 * @dev Implements ERC20 interface with encrypted balances using CoFHE primitives
 * 
 * Key Features:
 * - All balances are encrypted (euint128)
 * - Minting/burning restricted to WalnutV2 contract
 * - Standard ERC20 operations with encrypted amounts
 * - Owner can update minter address (solves deployment order problem)
 * 
 * Requirements:
 * - Minter role for WalnutV2 contract
 * - Name: "Walnut USD Coin", Symbol: "wUSDC"
 * - Support encrypted transfer, approve, transferFrom
 */
contract WalnutFHERC20 {
    // Token metadata
    string public constant name = "Walnut USD Coin";
    string public constant symbol = "wUSDC";
    uint8 public constant decimals = 6; // Match USDC precision
    
    // Access control
    address public owner;
    address public minter;
    
    // Encrypted state
    mapping(address => euint128) private balances;
    mapping(address => mapping(address => euint128)) private allowances;
    euint128 private totalSupply;
    
    // Events (amounts are encrypted, so we don't emit them)
    event Transfer(address indexed from, address indexed to);
    event Approval(address indexed owner, address indexed spender);
    event MinterUpdated(address indexed oldMinter, address indexed newMinter);
    
    /**
     * @notice Initializes the WalnutFHERC20 token
     * @dev Sets deployer as owner and initial minter (to be updated after WalnutV2 deployment)
     */
    constructor() {
        owner = msg.sender;
        minter = msg.sender; // Temporary, will be updated via setMinter()
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier onlyMinter() {
        require(msg.sender == minter, "Only minter");
        _;
    }
    
    /**
     * @notice Updates the minter address
     * @dev Only owner can call. Used to set WalnutV2 as minter after deployment
     * @param _minter The new minter address (should be WalnutV2 contract)
     */
    function setMinter(address _minter) external onlyOwner {
        require(_minter != address(0), "Invalid minter");
        address oldMinter = minter;
        minter = _minter;
        emit MinterUpdated(oldMinter, _minter);
    }
    
    /**
     * @notice Mints encrypted tokens to a recipient
     * @dev Only minter (WalnutV2) can call
     * @param to The recipient address
     * @param encryptedAmount The encrypted amount to mint
     */
    function mint(address to, InEuint128 calldata encryptedAmount) external onlyMinter {
        require(to != address(0), "Mint to zero address");
        
        euint128 amount = FHE.asEuint128(encryptedAmount);
        _mintInternal(to, amount);
    }
    
    /**
     * @notice Internal mint function accepting euint128
     * @dev Used by WalnutV2 for conditional minting with FHE.select
     * @param to The recipient address
     * @param amount The encrypted amount to mint (euint128)
     */
    function mintInternal(address to, euint128 amount) external onlyMinter {
        require(to != address(0), "Mint to zero address");
        _mintInternal(to, amount);
    }
    
    /**
     * @notice Internal mint implementation
     * @param to The recipient address
     * @param amount The encrypted amount to mint
     */
    function _mintInternal(address to, euint128 amount) private {
        // Update recipient balance
        euint128 newBalance = FHE.add(balances[to], amount);
        FHE.allowThis(newBalance);
        balances[to] = newBalance;
        
        // Update total supply
        euint128 newTotalSupply = FHE.add(totalSupply, amount);
        FHE.allowThis(newTotalSupply);
        totalSupply = newTotalSupply;
        
        // Grant permissions
        FHE.allow(balances[to], to);
        FHE.allow(balances[to], address(this));
        
        emit Transfer(address(0), to);
    }
    
    /**
     * @notice Burns encrypted tokens from an account
     * @dev Only minter (WalnutV2) can call
     * @param from The account to burn from
     * @param encryptedAmount The encrypted amount to burn
     */
    function burn(address from, InEuint128 calldata encryptedAmount) external onlyMinter {
        require(from != address(0), "Burn from zero address");
        
        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);
        
        // Check sufficient balance using FHE comparison
        ebool hasSufficientBalance = FHE.gte(balances[from], amount);
        
        // Conditionally update balance (only if sufficient)
        euint128 newBalance = FHE.select(
            hasSufficientBalance,
            FHE.sub(balances[from], amount),
            balances[from] // No change if insufficient
        );
        FHE.allowThis(newBalance);
        balances[from] = newBalance;
        
        // Conditionally update total supply
        euint128 burnAmount = FHE.select(hasSufficientBalance, amount, FHE.asEuint128(0));
        FHE.allowThis(burnAmount);
        
        euint128 newTotalSupply = FHE.sub(totalSupply, burnAmount);
        FHE.allowThis(newTotalSupply);
        totalSupply = newTotalSupply;
        
        // Grant permissions
        FHE.allow(balances[from], from);
        FHE.allow(balances[from], address(this));
        
        emit Transfer(from, address(0));
    }
    
    /**
     * @notice Transfers encrypted tokens to another address
     * @dev Uses FHE.select to conditionally update balances (no revert for privacy)
     * @param to The recipient address
     * @param encryptedAmount The encrypted amount to transfer
     */
    function transfer(address to, InEuint128 calldata encryptedAmount) external {
        require(to != address(0), "Transfer to zero address");
        
        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);
        
        // Check sufficient balance
        ebool hasSufficientBalance = FHE.gte(balances[msg.sender], amount);
        
        // Conditionally update sender balance
        euint128 newSenderBalance = FHE.select(
            hasSufficientBalance,
            FHE.sub(balances[msg.sender], amount),
            balances[msg.sender]
        );
        FHE.allowThis(newSenderBalance);
        balances[msg.sender] = newSenderBalance;
        
        // Conditionally update recipient balance
        euint128 transferAmount = FHE.select(hasSufficientBalance, amount, FHE.asEuint128(0));
        FHE.allowThis(transferAmount);
        
        euint128 newRecipientBalance = FHE.add(balances[to], transferAmount);
        FHE.allowThis(newRecipientBalance);
        balances[to] = newRecipientBalance;
        
        // Grant permissions
        FHE.allow(balances[msg.sender], msg.sender);
        FHE.allow(balances[msg.sender], address(this));
        FHE.allow(balances[to], to);
        FHE.allow(balances[to], address(this));
        
        emit Transfer(msg.sender, to);
    }
    
    /**
     * @notice Approves a spender to transfer encrypted tokens
     * @param spender The address authorized to spend
     * @param encryptedAmount The encrypted amount approved
     */
    function approve(address spender, InEuint128 calldata encryptedAmount) external {
        require(spender != address(0), "Approve to zero address");
        
        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);
        
        allowances[msg.sender][spender] = amount;
        
        FHE.allow(allowances[msg.sender][spender], msg.sender);
        FHE.allow(allowances[msg.sender][spender], spender);
        FHE.allow(allowances[msg.sender][spender], address(this));
        
        emit Approval(msg.sender, spender);
    }
    
    /**
     * @notice Transfers tokens from one address to another using allowance
     * @dev Uses FHE.select for conditional updates (privacy-preserving)
     * @param from The address to transfer from
     * @param to The recipient address
     * @param encryptedAmount The encrypted amount to transfer
     */
    function transferFrom(
        address from,
        address to,
        InEuint128 calldata encryptedAmount
    ) external {
        require(from != address(0), "Transfer from zero address");
        require(to != address(0), "Transfer to zero address");
        
        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);
        
        // Check sufficient balance and allowance
        ebool hasSufficientBalance = FHE.gte(balances[from], amount);
        ebool hasSufficientAllowance = FHE.gte(allowances[from][msg.sender], amount);
        ebool canTransfer = FHE.and(hasSufficientBalance, hasSufficientAllowance);
        
        // Conditionally update sender balance
        euint128 newFromBalance = FHE.select(
            canTransfer,
            FHE.sub(balances[from], amount),
            balances[from]
        );
        FHE.allowThis(newFromBalance);
        balances[from] = newFromBalance;
        
        // Conditionally update recipient balance
        euint128 transferAmount = FHE.select(canTransfer, amount, FHE.asEuint128(0));
        FHE.allowThis(transferAmount);
        
        euint128 newToBalance = FHE.add(balances[to], transferAmount);
        FHE.allowThis(newToBalance);
        balances[to] = newToBalance;
        
        // Conditionally update allowance
        euint128 newAllowance = FHE.select(
            canTransfer,
            FHE.sub(allowances[from][msg.sender], amount),
            allowances[from][msg.sender]
        );
        FHE.allowThis(newAllowance);
        allowances[from][msg.sender] = newAllowance;
        
        // Grant permissions
        FHE.allow(balances[from], from);
        FHE.allow(balances[from], address(this));
        FHE.allow(balances[to], to);
        FHE.allow(balances[to], address(this));
        FHE.allow(allowances[from][msg.sender], from);
        FHE.allow(allowances[from][msg.sender], msg.sender);
        FHE.allow(allowances[from][msg.sender], address(this));
        
        emit Transfer(from, to);
    }
    
    /**
     * @notice Returns the encrypted balance of an account
     * @dev Caller must have FHE permission to decrypt
     * @param account The account to query
     * @return The encrypted balance
     */
    function balanceOf(address account) external view returns (euint128) {
        return balances[account];
    }
    
    /**
     * @notice Returns the encrypted allowance
     * @dev Caller must have FHE permission to decrypt
     * @param _owner The token owner
     * @param spender The spender
     * @return The encrypted allowance
     */
    function allowance(address _owner, address spender) external view returns (euint128) {
        return allowances[_owner][spender];
    }
    
    /**
     * @notice Returns the encrypted total supply
     * @dev Caller must have FHE permission to decrypt
     * @return The encrypted total supply
     */
    function getTotalSupply() external view returns (euint128) {
        return totalSupply;
    }
}
