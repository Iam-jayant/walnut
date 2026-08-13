// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice WalnutFHERC20: Encrypted Stablecoin (cUSDC) Contract

import {FHE, ebool, euint128} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {InEuint128} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";

contract WalnutFHERC20 {
    string public constant name = "Walnut Confidential USDC";
    string public constant symbol = "cUSDC";
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

    mapping(address => bool) public isMinter;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyMinter() {
        require(msg.sender == minter || isMinter[msg.sender], "Only minter");
        _;
    }

    function setMinter(address _minter) external onlyOwner {
        require(_minter != address(0), "Invalid minter");
        address oldMinter = minter;
        minter = _minter;
        isMinter[_minter] = true;
        emit MinterUpdated(oldMinter, _minter);
    }

    // ─── Safe FHE helpers ────────────────────────────────────────────────────
    // FHE operations on a zero (uninitialized) handle revert with ACLNotAllowed.
    // These helpers substitute a properly-allowed zero euint128 for any slot
    // that has never been written.

    function _safeBalance(address account) internal returns (euint128) {
        if (!FHE.isInitialized(balances[account])) {
            euint128 zero = FHE.asEuint128(0);
            FHE.allowThis(zero);
            return zero;
        }
        return balances[account];
    }

    function _safeTotalSupply() internal returns (euint128) {
        if (!FHE.isInitialized(totalSupply)) {
            euint128 zero = FHE.asEuint128(0);
            FHE.allowThis(zero);
            return zero;
        }
        return totalSupply;
    }

    function _safeAllowance(address _owner, address spender) internal returns (euint128) {
        if (!FHE.isInitialized(allowances[_owner][spender])) {
            euint128 zero = FHE.asEuint128(0);
            FHE.allowThis(zero);
            return zero;
        }
        return allowances[_owner][spender];
    }

    // ─── Mint ────────────────────────────────────────────────────────────────

    function mint(address to, InEuint128 calldata encryptedAmount) external onlyMinter {
        require(to != address(0), "Mint to zero address");
        euint128 amount = FHE.asEuint128(encryptedAmount);
        _mintInternal(to, amount);
    }

    function mintInternal(address to, euint128 amount) external onlyMinter {
        require(to != address(0), "Mint to zero address");
        FHE.allowThis(amount);
        _mintInternal(to, amount);
    }

    function _mintInternal(address to, euint128 amount) private {
        euint128 currentBalance = _safeBalance(to);
        euint128 newBalance = FHE.add(currentBalance, amount);
        FHE.allowThis(newBalance);
        balances[to] = newBalance;

        euint128 currentTotalSupply = _safeTotalSupply();
        euint128 newTotalSupply = FHE.add(currentTotalSupply, amount);
        FHE.allowThis(newTotalSupply);
        totalSupply = newTotalSupply;

        FHE.allow(balances[to], to);
        FHE.allow(balances[to], address(this));

        emit Transfer(address(0), to);
    }

    // ─── Burn ────────────────────────────────────────────────────────────────

    function burn(address from, InEuint128 calldata encryptedAmount) external onlyMinter {
        require(from != address(0), "Burn from zero address");
        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);
        _burnInternal(from, amount);
    }

    function burnInternal(address from, euint128 amount) external onlyMinter returns (ebool) {
        require(from != address(0), "Burn from zero address");
        FHE.allowThis(amount);
        ebool success = _burnInternal(from, amount);
        FHE.allow(success, msg.sender);
        return success;
    }

    function _burnInternal(address from, euint128 amount) private returns (ebool) {
        euint128 currentBalance = _safeBalance(from);
        ebool hasSufficientBalance = FHE.gte(currentBalance, amount);
        euint128 newBalance = FHE.select(
            hasSufficientBalance,
            FHE.sub(currentBalance, amount),
            currentBalance
        );
        FHE.allowThis(newBalance);
        balances[from] = newBalance;

        euint128 zero = FHE.asEuint128(0);
        FHE.allowThis(zero);
        euint128 burnAmount = FHE.select(hasSufficientBalance, amount, zero);
        FHE.allowThis(burnAmount);

        euint128 currentTotalSupply = _safeTotalSupply();
        euint128 newTotalSupply = FHE.sub(currentTotalSupply, burnAmount);
        FHE.allowThis(newTotalSupply);
        totalSupply = newTotalSupply;

        FHE.allow(balances[from], from);
        FHE.allow(balances[from], address(this));

        emit Transfer(from, address(0));
        return hasSufficientBalance;
    }

    // ─── Transfer ────────────────────────────────────────────────────────────

    function transfer(address to, InEuint128 calldata encryptedAmount) external {
        require(to != address(0), "Transfer to zero address");
        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);

        euint128 senderBalance = _safeBalance(msg.sender);
        ebool hasSufficientBalance = FHE.gte(senderBalance, amount);
        euint128 newSenderBalance = FHE.select(
            hasSufficientBalance,
            FHE.sub(senderBalance, amount),
            senderBalance
        );
        FHE.allowThis(newSenderBalance);
        balances[msg.sender] = newSenderBalance;

        euint128 zero = FHE.asEuint128(0);
        FHE.allowThis(zero);
        euint128 transferAmount = FHE.select(hasSufficientBalance, amount, zero);
        FHE.allowThis(transferAmount);

        euint128 recipientBalance = _safeBalance(to);
        euint128 newRecipientBalance = FHE.add(recipientBalance, transferAmount);
        FHE.allowThis(newRecipientBalance);
        balances[to] = newRecipientBalance;

        FHE.allow(balances[msg.sender], msg.sender);
        FHE.allow(balances[msg.sender], address(this));
        FHE.allow(balances[to], to);
        FHE.allow(balances[to], address(this));

        emit Transfer(msg.sender, to);
    }

    // ─── Approve / transferFrom ───────────────────────────────────────────────

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

        euint128 fromBalance = _safeBalance(from);
        euint128 fromAllowance = _safeAllowance(from, msg.sender);

        ebool hasSufficientBalance = FHE.gte(fromBalance, amount);
        ebool hasSufficientAllowance = FHE.gte(fromAllowance, amount);
        ebool canTransfer = FHE.and(hasSufficientBalance, hasSufficientAllowance);

        euint128 newFromBalance = FHE.select(
            canTransfer,
            FHE.sub(fromBalance, amount),
            fromBalance
        );
        FHE.allowThis(newFromBalance);
        balances[from] = newFromBalance;

        euint128 zero = FHE.asEuint128(0);
        FHE.allowThis(zero);
        euint128 transferAmount = FHE.select(canTransfer, amount, zero);
        FHE.allowThis(transferAmount);

        euint128 toBalance = _safeBalance(to);
        euint128 newToBalance = FHE.add(toBalance, transferAmount);
        FHE.allowThis(newToBalance);
        balances[to] = newToBalance;

        euint128 newAllowance = FHE.select(
            canTransfer,
            FHE.sub(fromAllowance, amount),
            fromAllowance
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

    // ─── Views ────────────────────────────────────────────────────────────────

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
