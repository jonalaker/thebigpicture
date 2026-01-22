// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Minimal Uniswap V2 Router interface
interface IUniswapV2Router02 {
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);
    
    function factory() external view returns (address);
}

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

/**
 * @title LiquidityManager
 * @notice Manages DEX liquidity: LP locking, anti-sniper launch mode
 * @dev Designed for ICO readiness with 15% supply allocation for DEX
 */
contract LiquidityManager is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============ Constants ============
    bytes32 public constant LIQUIDITY_ADMIN = keccak256("LIQUIDITY_ADMIN");
    
    uint256 public constant MIN_LOCK_DURATION = 365 days; // 12 months minimum
    
    // ============ State ============
    IUniswapV2Router02 public router;
    address public immutable pinn44Token;
    
    // Anti-sniper
    bool public launchModeEnabled;
    uint256 public launchModeEndTime;
    uint256 public constant LAUNCH_MODE_DURATION = 48 hours;
    
    // LP Locks
    struct LPLock {
        address lpToken;
        uint256 amount;
        uint256 unlockTime;
        address owner;
        bool withdrawn;
    }
    
    mapping(uint256 => LPLock) public lpLocks;
    uint256 public lockCount;
    
    // Stats
    uint256 public totalLPLocked;
    
    // ============ Events ============
    event LiquidityAdded(address indexed pool, uint256 tokenAmount, uint256 pairedAssetAmount, uint256 lpAmount);
    event LPLocked(address indexed locker, address lpToken, uint256 amount, uint256 unlockTime);
    event LPWithdrawn(address indexed owner, uint256 lockId, uint256 amount);
    event LaunchModeEnabled(uint256 endTime);
    event LaunchModeDisabled();
    
    // ============ Constructor ============
    constructor(
        address tokenAddress,
        address routerAddress,
        address admin
    ) {
        require(tokenAddress != address(0), "Invalid token");
        require(routerAddress != address(0), "Invalid router");
        require(admin != address(0), "Invalid admin");
        
        pinn44Token = tokenAddress;
        router = IUniswapV2Router02(routerAddress);
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(LIQUIDITY_ADMIN, admin);
    }
    
    // ============ Anti-Sniper Launch Mode ============
    
    /**
     * @notice Enable launch mode before adding liquidity
     */
    function enableLaunchMode() external onlyRole(LIQUIDITY_ADMIN) {
        require(!launchModeEnabled, "Already enabled");
        
        launchModeEnabled = true;
        launchModeEndTime = block.timestamp + LAUNCH_MODE_DURATION;
        
        emit LaunchModeEnabled(launchModeEndTime);
    }
    
    /**
     * @notice Disable launch mode (after 24-48 hours)
     */
    function disableLaunchMode() external onlyRole(LIQUIDITY_ADMIN) {
        require(launchModeEnabled, "Not enabled");
        require(block.timestamp >= launchModeEndTime, "Too early");
        
        launchModeEnabled = false;
        
        emit LaunchModeDisabled();
    }
    
    /**
     * @notice Force disable launch mode (emergency)
     */
    function forceDisableLaunchMode() external onlyRole(DEFAULT_ADMIN_ROLE) {
        launchModeEnabled = false;
        emit LaunchModeDisabled();
    }
    
    function isLaunchModeActive() public view returns (bool) {
        return launchModeEnabled && block.timestamp < launchModeEndTime;
    }
    
    // ============ Liquidity Functions ============
    
    /**
     * @notice Add liquidity to DEX and lock LP tokens
     * @param pairedToken Token to pair with (e.g., USDC, WMATIC)
     * @param tokenAmount Amount of PINN44 tokens
     * @param pairedAmount Amount of paired token
     * @param lockDuration How long to lock LP tokens (min 12 months)
     */
    function addLiquidityAndLock(
        address pairedToken,
        uint256 tokenAmount,
        uint256 pairedAmount,
        uint256 lockDuration
    ) external onlyRole(LIQUIDITY_ADMIN) nonReentrant returns (uint256 lockId) {
        require(lockDuration >= MIN_LOCK_DURATION, "Lock too short");
        require(tokenAmount > 0 && pairedAmount > 0, "Invalid amounts");
        
        // Transfer tokens to this contract
        IERC20(pinn44Token).safeTransferFrom(msg.sender, address(this), tokenAmount);
        IERC20(pairedToken).safeTransferFrom(msg.sender, address(this), pairedAmount);
        
        // Approve router
        IERC20(pinn44Token).forceApprove(address(router), tokenAmount);
        IERC20(pairedToken).forceApprove(address(router), pairedAmount);
        
        // Add liquidity
        (uint256 amountA, uint256 amountB, uint256 liquidity) = router.addLiquidity(
            pinn44Token,
            pairedToken,
            tokenAmount,
            pairedAmount,
            (tokenAmount * 95) / 100, // 5% slippage
            (pairedAmount * 95) / 100,
            address(this),
            block.timestamp + 300
        );
        
        // Get LP token address
        address factory = router.factory();
        address lpToken = IUniswapV2Factory(factory).getPair(pinn44Token, pairedToken);
        require(lpToken != address(0), "Pair not created");
        
        // Create lock
        lockCount++;
        lockId = lockCount;
        
        lpLocks[lockId] = LPLock({
            lpToken: lpToken,
            amount: liquidity,
            unlockTime: block.timestamp + lockDuration,
            owner: msg.sender,
            withdrawn: false
        });
        
        totalLPLocked += liquidity;
        
        // Refund excess tokens
        uint256 tokenRefund = tokenAmount - amountA;
        uint256 pairedRefund = pairedAmount - amountB;
        
        if (tokenRefund > 0) {
            IERC20(pinn44Token).safeTransfer(msg.sender, tokenRefund);
        }
        if (pairedRefund > 0) {
            IERC20(pairedToken).safeTransfer(msg.sender, pairedRefund);
        }
        
        emit LiquidityAdded(lpToken, amountA, amountB, liquidity);
        emit LPLocked(msg.sender, lpToken, liquidity, block.timestamp + lockDuration);
        
        return lockId;
    }
    
    /**
     * @notice Lock existing LP tokens
     */
    function lockLPTokens(
        address lpToken,
        uint256 amount,
        uint256 lockDuration
    ) external nonReentrant returns (uint256 lockId) {
        require(lockDuration >= MIN_LOCK_DURATION, "Lock too short");
        require(amount > 0, "Invalid amount");
        
        IERC20(lpToken).safeTransferFrom(msg.sender, address(this), amount);
        
        lockCount++;
        lockId = lockCount;
        
        lpLocks[lockId] = LPLock({
            lpToken: lpToken,
            amount: amount,
            unlockTime: block.timestamp + lockDuration,
            owner: msg.sender,
            withdrawn: false
        });
        
        totalLPLocked += amount;
        
        emit LPLocked(msg.sender, lpToken, amount, block.timestamp + lockDuration);
        
        return lockId;
    }
    
    /**
     * @notice Extend lock duration
     */
    function extendLock(uint256 lockId, uint256 additionalTime) external {
        LPLock storage lock = lpLocks[lockId];
        require(lock.owner == msg.sender, "Not owner");
        require(!lock.withdrawn, "Already withdrawn");
        
        lock.unlockTime += additionalTime;
        
        emit LPLocked(msg.sender, lock.lpToken, lock.amount, lock.unlockTime);
    }
    
    /**
     * @notice Withdraw LP tokens after lock expires
     */
    function withdrawLP(uint256 lockId) external nonReentrant {
        LPLock storage lock = lpLocks[lockId];
        
        require(lock.owner == msg.sender, "Not owner");
        require(!lock.withdrawn, "Already withdrawn");
        require(block.timestamp >= lock.unlockTime, "Still locked");
        
        lock.withdrawn = true;
        totalLPLocked -= lock.amount;
        
        IERC20(lock.lpToken).safeTransfer(msg.sender, lock.amount);
        
        emit LPWithdrawn(msg.sender, lockId, lock.amount);
    }
    
    // ============ View Functions ============
    
    function getLock(uint256 lockId) external view returns (
        address lpToken,
        uint256 amount,
        uint256 unlockTime,
        address owner,
        bool withdrawn,
        bool canWithdraw
    ) {
        LPLock storage lock = lpLocks[lockId];
        return (
            lock.lpToken,
            lock.amount,
            lock.unlockTime,
            lock.owner,
            lock.withdrawn,
            !lock.withdrawn && block.timestamp >= lock.unlockTime
        );
    }
    
    function getTimeToUnlock(uint256 lockId) external view returns (uint256) {
        LPLock storage lock = lpLocks[lockId];
        if (block.timestamp >= lock.unlockTime) return 0;
        return lock.unlockTime - block.timestamp;
    }
    
    // ============ Admin ============
    
    function setRouter(address newRouter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newRouter != address(0), "Invalid router");
        router = IUniswapV2Router02(newRouter);
    }
    
    /**
     * @notice Emergency withdraw stuck tokens (not LP locks)
     */
    function emergencyWithdraw(
        address token,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}
