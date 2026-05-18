// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {FHE, ebool, euint128, TASK_MANAGER_ADDRESS} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {InEuint128, ITaskManager} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IWalnutFHERC20 {
    function mint(address to, InEuint128 calldata encryptedAmount) external;
    function mintInternal(address to, euint128 amount) external;
    function burn(address from, InEuint128 calldata encryptedAmount) external;
    function burnInternal(address from, euint128 amount) external;
}

interface IWalnutPriceOracle {
    function getUSDValue(address token, uint256 amount) external view returns (uint256);
}

contract WalnutV2 {
    using SafeERC20 for IERC20;

    IWalnutFHERC20 public immutable wUSDC;
    IWalnutPriceOracle public immutable oracle;
    address public immutable treasury;
    
    mapping(address => euint128) private _collateral;
    mapping(address => euint128) private _debt;
    mapping(address => euint128) private _repaymentCount;
    mapping(address => euint128) private _defaultCount;
    
    struct VaultHolding {
        address token;
        uint256 amount;
    }
    mapping(address => VaultHolding[]) public vaults;

    struct PendingWithdraw {
        address user;
        address token;
        uint256 amount;
        euint128 newCollateral;
    }
    mapping(uint256 => PendingWithdraw) public pendingWithdraws;
    
    mapping(address => uint256) public borrowTimestamp;
    
    mapping(address => uint8) public creditTier;
    uint16[5] public tierLTVs;
    
    uint256 public constant BORROW_APR = 800;
    uint256 public constant PROTOCOL_FEE_APR = 200;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant PRECISION = 1e6;
    
    bool public paused;
    address public owner;
    
    mapping(uint256 => address) public decryptRequests;
    
    event DepositSubmitted(address indexed user, address indexed token, uint256 amount);
    event BorrowSubmitted(address indexed user, uint256 timestamp);
    event RepaymentSettlementIntent(
        address indexed user,
        uint256 principal,
        uint256 interest,
        uint256 protocolFee
    );
    event WithdrawSubmitted(address indexed user, address indexed token, uint256 amount);
    event WithdrawRequested(address indexed user, address indexed token, uint256 amount, uint256 requestId);
    event WithdrawFinalized(address indexed user, address indexed token, uint256 amount, bool approved);
    event CreditTierUpdated(address indexed user, uint8 tier);
    
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    constructor(
        address _wUSDC,
        address _oracle,
        address _treasury
    ) {
        require(_wUSDC != address(0), "Invalid wUSDC");
        require(_oracle != address(0), "Invalid oracle");
        require(_treasury != address(0), "Invalid treasury");
        
        wUSDC = IWalnutFHERC20(_wUSDC);
        oracle = IWalnutPriceOracle(_oracle);
        treasury = _treasury;
        
        owner = msg.sender;
        
        tierLTVs[0] = 7000;
        tierLTVs[1] = 7500;
        tierLTVs[2] = 8000;
        tierLTVs[3] = 8500;
        tierLTVs[4] = 9000;
        
        emit OwnershipTransferred(address(0), msg.sender);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Protocol paused");
        _;
    }
    
    modifier onlyCoFHE() {
        require(msg.sender == TASK_MANAGER_ADDRESS, "Only CoFHE coprocessor");
        _;
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function _getLTVForUser(address user) internal view returns (uint256) {
        return tierLTVs[creditTier[user]];
    }

    function _tierFromRepaymentCount(uint128 count) internal pure returns (uint8) {
        if (count >= 50) return 4;
        if (count >= 25) return 3;
        if (count >= 10) return 2;
        if (count >= 3) return 1;
        return 0;
    }

    function _requestDecrypt(euint128 value) internal returns (uint256 requestId) {
        requestId = uint256(euint128.unwrap(value));
        FHE.allowGlobal(value);
        ITaskManager(TASK_MANAGER_ADDRESS).createDecryptTask(requestId, address(this));
    }
    
    function deposit(address token, uint256 amount) external whenNotPaused {
        SafeERC20.safeTransferFrom(IERC20(token), msg.sender, address(this), amount);
        uint256 usdValue = oracle.getUSDValue(token, amount);
        euint128 encryptedValue = FHE.asEuint128(usdValue);
        FHE.allowThis(encryptedValue);
        euint128 updatedCollateral = FHE.add(_collateral[msg.sender], encryptedValue);
        FHE.allowThis(updatedCollateral);
        _collateral[msg.sender] = updatedCollateral;
        vaults[msg.sender].push(VaultHolding(token, amount));
        FHE.allow(_collateral[msg.sender], msg.sender);
        emit DepositSubmitted(msg.sender, token, amount);
    }
    
    function borrow(InEuint128 calldata encryptedAmount) external whenNotPaused {
        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);
        uint16 ltv = tierLTVs[creditTier[msg.sender]];
        euint128 ltvEncrypted = FHE.asEuint128(ltv);
        FHE.allowThis(ltvEncrypted);
        
        euint128 collateralTimesLTV = FHE.mul(_collateral[msg.sender], ltvEncrypted);
        FHE.allowThis(collateralTimesLTV);
        
        euint128 divisor = FHE.asEuint128(10000);
        FHE.allowThis(divisor);
        
        euint128 maxBorrow = FHE.div(collateralTimesLTV, divisor);
        FHE.allowThis(maxBorrow);
        euint128 candidateDebt = FHE.add(_debt[msg.sender], amount);
        FHE.allowThis(candidateDebt);

        ebool withinLimit = FHE.lte(candidateDebt, maxBorrow);
        FHE.allowThis(withinLimit);
        
        euint128 updatedDebt = FHE.select(withinLimit, candidateDebt, _debt[msg.sender]);
        FHE.allowThis(updatedDebt);
        _debt[msg.sender] = updatedDebt;
        euint128 mintAmount = FHE.select(withinLimit, amount, FHE.asEuint128(0));
        FHE.allowThis(mintAmount);
        FHE.allow(mintAmount, address(wUSDC));
        
        wUSDC.mintInternal(msg.sender, mintAmount);
        borrowTimestamp[msg.sender] = block.timestamp;
        FHE.allow(_debt[msg.sender], msg.sender);
        emit BorrowSubmitted(msg.sender, block.timestamp);
    }
    
    function requestCreditTierUpdate(address user) external {
        FHE.allow(_repaymentCount[user], address(this));
        uint256 reqId = _requestDecrypt(_repaymentCount[user]);
        decryptRequests[reqId] = user;
    }
    
    function onCreditCountDecrypted(uint256 requestId, uint128 result) external onlyCoFHE {
        address user = decryptRequests[requestId];
        if (user == address(0)) return;
        
        creditTier[user] = _tierFromRepaymentCount(result);
        emit CreditTierUpdated(user, creditTier[user]);
        delete decryptRequests[requestId];
    }
    
    function calculateInterest(address user, uint256 principal) 
        public 
        view 
        returns (uint256 totalInterest, uint256 protocolFee, uint256 lenderPayment) 
    {
        uint256 elapsed = block.timestamp - borrowTimestamp[user];
        if (elapsed == 0 || principal == 0) {
            return (0, 0, 0);
        }
        totalInterest = (principal * BORROW_APR * elapsed * PRECISION) / (SECONDS_PER_YEAR * 10000 * PRECISION);
        protocolFee = totalInterest / 4;
        lenderPayment = totalInterest - protocolFee;
        
        return (totalInterest, protocolFee, lenderPayment);
    }
    
    function repay(InEuint128 calldata encryptedAmount) external whenNotPaused {
        euint128 amount = FHE.asEuint128(encryptedAmount);
        FHE.allowThis(amount);
        uint256 principal = 0;
        (uint256 totalInterest, uint256 protocolFee, ) = 
            calculateInterest(msg.sender, principal);
        euint128 requiredAmount = FHE.add(_debt[msg.sender], FHE.asEuint128(totalInterest));
        FHE.allowThis(requiredAmount);
        ebool sufficient = FHE.gte(amount, requiredAmount);
        FHE.allowThis(sufficient);
        _debt[msg.sender] = FHE.select(sufficient, FHE.asEuint128(0), _debt[msg.sender]);
        FHE.allowThis(_debt[msg.sender]);
        euint128 incrementedCount = FHE.add(_repaymentCount[msg.sender], FHE.asEuint128(1));
        FHE.allowThis(incrementedCount);
        
        _repaymentCount[msg.sender] = FHE.select(
            sufficient, 
            incrementedCount, 
            _repaymentCount[msg.sender]
        );
        FHE.allowThis(_repaymentCount[msg.sender]);
        
        euint128 burnAmount = FHE.select(sufficient, requiredAmount, FHE.asEuint128(0));
        FHE.allowThis(burnAmount);
        FHE.allow(burnAmount, address(wUSDC));
        wUSDC.burnInternal(msg.sender, burnAmount);
        FHE.allow(_debt[msg.sender], msg.sender);
        FHE.allow(_repaymentCount[msg.sender], msg.sender);
        emit RepaymentSettlementIntent(
            msg.sender,
            principal,
            totalInterest,
            protocolFee
        );
    }
    
    function withdraw(address token, uint256 amount) external whenNotPaused {
        require(amount > 0, "Invalid amount");
        require(borrowTimestamp[msg.sender] == 0, "Open debt withdraw unsupported");
        require(_vaultBalanceOf(msg.sender, token) >= amount, "Insufficient vault");

        uint256 usdValue = oracle.getUSDValue(token, amount);
        euint128 encryptedValue = FHE.asEuint128(usdValue);
        FHE.allowThis(encryptedValue);

        euint128 newCollateral = FHE.sub(_collateral[msg.sender], encryptedValue);
        FHE.allowThis(newCollateral);

        _collateral[msg.sender] = newCollateral;
        FHE.allowThis(_collateral[msg.sender]);
        FHE.allow(_collateral[msg.sender], msg.sender);

        SafeERC20.safeTransfer(IERC20(token), msg.sender, amount);
        _removeFromVault(msg.sender, token, amount);

        emit WithdrawSubmitted(msg.sender, token, amount);
        emit WithdrawFinalized(msg.sender, token, amount, true);
    }

    function onWithdrawSafetyDecrypted(uint256 requestId, bool safe) external onlyCoFHE {
        PendingWithdraw memory request = pendingWithdraws[requestId];
        if (request.user == address(0)) return;

        delete pendingWithdraws[requestId];

        if (!safe) {
            emit WithdrawFinalized(request.user, request.token, request.amount, false);
            return;
        }

        _collateral[request.user] = request.newCollateral;
        FHE.allowThis(_collateral[request.user]);
        FHE.allow(_collateral[request.user], request.user);

        SafeERC20.safeTransfer(IERC20(request.token), request.user, request.amount);
        _removeFromVault(request.user, request.token, request.amount);

        emit WithdrawSubmitted(request.user, request.token, request.amount);
        emit WithdrawFinalized(request.user, request.token, request.amount, true);
    }
    
    function _removeFromVault(address user, address token, uint256 amount) internal {
        VaultHolding[] storage userVaults = vaults[user];
        
        for (uint256 i = 0; i < userVaults.length; i++) {
            if (userVaults[i].token == token) {
                if (userVaults[i].amount <= amount) {
                    userVaults[i] = userVaults[userVaults.length - 1];
                    userVaults.pop();
                } else {
                    userVaults[i].amount -= amount;
                }
                break;
            }
        }
    }

    function _vaultBalanceOf(address user, address token) internal view returns (uint256 total) {
        VaultHolding[] storage userVaults = vaults[user];

        for (uint256 i = 0; i < userVaults.length; i++) {
            if (userVaults[i].token == token) {
                total += userVaults[i].amount;
            }
        }
    }
    
    function getEncryptedCollateral(address user) external view returns (euint128) {
        return _collateral[user];
    }
    
    function getEncryptedDebt(address user) external view returns (euint128) {
        return _debt[user];
    }
    
    function getEncryptedRepaymentCount(address user) external view returns (euint128) {
        return _repaymentCount[user];
    }
    
    function getEncryptedDefaultCount(address user) external view returns (euint128) {
        return _defaultCount[user];
    }
    
    function grantReadPermissions() external {
        FHE.allow(_collateral[msg.sender], msg.sender);
        FHE.allow(_debt[msg.sender], msg.sender);
        FHE.allow(_repaymentCount[msg.sender], msg.sender);
        FHE.allow(_defaultCount[msg.sender], msg.sender);
    }
    
    function grantReadPermissionsFor(address user) external {
        FHE.allow(_collateral[user], user);
        FHE.allow(_debt[user], user);
        FHE.allow(_repaymentCount[user], user);
        FHE.allow(_defaultCount[user], user);
    }
}
