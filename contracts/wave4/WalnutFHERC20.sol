// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {FHE, ebool, euint128} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {InEuint128} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";

contract WalnutFHERC20 {
    string public constant name = "Walnut USD Coin";
    string public constant symbol = "wUSDC";
    uint8 public constant decimals = 6;
    address public owner;
    address public minter;
    mapping(address => euint128) private balances;
    mapping(address => mapping(address => euint128)) private allowances;
    euint128 private totalSupply;
    event Transfer(address indexed from, address indexed to);
    event Approval(address indexed owner, address indexed spender);
    event MinterUpdated(address indexed oldMinter, address indexed newMinter);
    
    constructor() {
        owner = msg.sender;
        minter = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier onlyMinter() {
        require(msg.sender == minter, "Only minter");
        _;
    }
    
    function setMinter(address _minter) external onlyOwner {
        require(_minter != address(0), "Invalid minter");
        address oldMinter = minter;
        minter = _minter;
        emit MinterUpdated(oldMinter, _minter);
    }
    
    function mint(address to, InEuint128 calldata encryptedAmount) external onlyMinter {
        require(to != address(0), "Mint to zero address");
        
        euint128 amount = FHE.asEuint128(encryptedAmount);
        _mintInternal(to, amount);
    }
    
    function mintInternal(address to, euint128 amount) external onlyMinter {
        require(to != address(0), "Mint to zero address");
        _mintInternal(to, amount);
    }
    
    function _mintInternal(address to, euint128 amount) private {
        euint128 newBalance = FHE.add(balances[to], amount);
        FHE.allowThis(newBalance);
        balances[to] = newBalance;
        euint128 newTotalSupply = FHE.add(totalSupply, amount);
        FHE.allowThis(newTotalSupply);
        totalSupply = newTotalSupply;
        FHE.allow(balances[to], to);
        FHE.allow(balances[to], address(this));
        
        emit Transfer(address(0), to);
    }
    
    function burn(address from, InEuint128 calldata encryptedAmount) external onlyMinter {
        require(from != address(0), "Burn from zero address");
        
        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);

        _burnInternal(from, amount);
    }

    function burnInternal(address from, euint128 amount) external onlyMinter {
        require(from != address(0), "Burn from zero address");
        FHE.allowThis(amount);
        _burnInternal(from, amount);
    }

    function _burnInternal(address from, euint128 amount) private {
        ebool hasSufficientBalance = FHE.gte(balances[from], amount);
        euint128 newBalance = FHE.select(
            hasSufficientBalance,
            FHE.sub(balances[from], amount),
            balances[from]
        );
        FHE.allowThis(newBalance);
        balances[from] = newBalance;
        euint128 burnAmount = FHE.select(hasSufficientBalance, amount, FHE.asEuint128(0));
        FHE.allowThis(burnAmount);
        
        euint128 newTotalSupply = FHE.sub(totalSupply, burnAmount);
        FHE.allowThis(newTotalSupply);
        totalSupply = newTotalSupply;
        FHE.allow(balances[from], from);
        FHE.allow(balances[from], address(this));
        
        emit Transfer(from, address(0));
    }
    
    function transfer(address to, InEuint128 calldata encryptedAmount) external {
        require(to != address(0), "Transfer to zero address");
        
        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);
        ebool hasSufficientBalance = FHE.gte(balances[msg.sender], amount);
        euint128 newSenderBalance = FHE.select(
            hasSufficientBalance,
            FHE.sub(balances[msg.sender], amount),
            balances[msg.sender]
        );
        FHE.allowThis(newSenderBalance);
        balances[msg.sender] = newSenderBalance;
        euint128 transferAmount = FHE.select(hasSufficientBalance, amount, FHE.asEuint128(0));
        FHE.allowThis(transferAmount);
        
        euint128 newRecipientBalance = FHE.add(balances[to], transferAmount);
        FHE.allowThis(newRecipientBalance);
        balances[to] = newRecipientBalance;
        FHE.allow(balances[msg.sender], msg.sender);
        FHE.allow(balances[msg.sender], address(this));
        FHE.allow(balances[to], to);
        FHE.allow(balances[to], address(this));
        
        emit Transfer(msg.sender, to);
    }
    
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
    
    function transferFrom(
        address from,
        address to,
        InEuint128 calldata encryptedAmount
    ) external {
        require(from != address(0), "Transfer from zero address");
        require(to != address(0), "Transfer to zero address");
        
        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);
        ebool hasSufficientBalance = FHE.gte(balances[from], amount);
        ebool hasSufficientAllowance = FHE.gte(allowances[from][msg.sender], amount);
        ebool canTransfer = FHE.and(hasSufficientBalance, hasSufficientAllowance);
        euint128 newFromBalance = FHE.select(
            canTransfer,
            FHE.sub(balances[from], amount),
            balances[from]
        );
        FHE.allowThis(newFromBalance);
        balances[from] = newFromBalance;
        euint128 transferAmount = FHE.select(canTransfer, amount, FHE.asEuint128(0));
        FHE.allowThis(transferAmount);
        
        euint128 newToBalance = FHE.add(balances[to], transferAmount);
        FHE.allowThis(newToBalance);
        balances[to] = newToBalance;
        euint128 newAllowance = FHE.select(
            canTransfer,
            FHE.sub(allowances[from][msg.sender], amount),
            allowances[from][msg.sender]
        );
        FHE.allowThis(newAllowance);
        allowances[from][msg.sender] = newAllowance;
        FHE.allow(balances[from], from);
        FHE.allow(balances[from], address(this));
        FHE.allow(balances[to], to);
        FHE.allow(balances[to], address(this));
        FHE.allow(allowances[from][msg.sender], from);
        FHE.allow(allowances[from][msg.sender], msg.sender);
        FHE.allow(allowances[from][msg.sender], address(this));
        
        emit Transfer(from, to);
    }
    
    function balanceOf(address account) external view returns (euint128) {
        return balances[account];
    }
    
    function allowance(address _owner, address spender) external view returns (euint128) {
        return allowances[_owner][spender];
    }
    
    function getTotalSupply() external view returns (euint128) {
        return totalSupply;
    }
}
