// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/**
 * @title ContributorVault
 * @notice Payment splitter + lockbox for contributor rewards
 * @dev Automates reward distribution: 50% immediate, 50% locked for 90 days
 *      Supports optional linear vesting and early withdrawal slashing
 */
contract ContributorVault is ERC2771Context, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============ Constants ============
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");
    
    uint256 public constant DEFAULT_LOCK_DURATION = 90 days;
    uint256 public constant DEFAULT_VESTING_DURATION = 90 days; // 3 months post-cliff
    uint256 public constant SLASH_PERCENTAGE = 20; // 20% penalty for early unlock
    uint256 public constant PERCENTAGE_BASE = 100;
    
    // ============ State ============
    IERC20 public immutable token;
    address public slashDestination; // DAO or burn address
    bool public vestingEnabled;
    
    struct Lock {
        uint256 amount;
        uint256 releaseTime;
        uint256 vestingEnd; // 0 if no vesting, otherwise end of linear vest
        uint256 claimed;
    }
    
    // Contributor => array of locks
    mapping(address => Lock[]) public locks;
    
    // Stats
    uint256 public totalDistributed;
    uint256 public totalLocked;
    uint256 public totalClaimed;
    uint256 public totalSlashed;
    
    // ============ Events ============
    event RewardDistributed(
        address indexed contributor,
        uint256 total,
        uint256 immediate,
        uint256 locked,
        uint256 releaseTime
    );
    event LockedClaimed(address indexed contributor, uint256 amount);
    event Slashed(address indexed contributor, uint256 amount, address destination);
    event VestingEnabledChanged(bool enabled);
    event SlashDestinationChanged(address newDestination);
    
    // ============ Constructor ============
    constructor(
        address trustedForwarder,
        address tokenAddress,
        address admin,
        address dao
    ) ERC2771Context(trustedForwarder) {
        require(tokenAddress != address(0), "Invalid token");
        require(admin != address(0), "Invalid admin");
        require(dao != address(0), "Invalid DAO");
        
        token = IERC20(tokenAddress);
        slashDestination = dao;
        vestingEnabled = true;
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(DISTRIBUTOR_ROLE, admin);
        _grantRole(DAO_ROLE, dao);
    }
    
    // ============ Distribution ============
    
    /**
     * @notice Distribute reward to a contributor
     * @param contributor Address to receive the reward
     * @param totalAmount Total reward amount
     * @dev 50% transferred immediately, 50% locked for DEFAULT_LOCK_DURATION
     */
    function distributeReward(
        address contributor,
        uint256 totalAmount
    ) external onlyRole(DISTRIBUTOR_ROLE) nonReentrant {
        _distributeReward(contributor, totalAmount, DEFAULT_LOCK_DURATION);
    }
    
    /**
     * @notice Distribute reward with custom lock duration
     * @param contributor Address to receive the reward
     * @param totalAmount Total reward amount
     * @param lockDuration Custom lock duration in seconds
     */
    function distributeRewardCustom(
        address contributor,
        uint256 totalAmount,
        uint256 lockDuration
    ) external onlyRole(DISTRIBUTOR_ROLE) nonReentrant {
        _distributeReward(contributor, totalAmount, lockDuration);
    }
    
    function _distributeReward(
        address contributor,
        uint256 totalAmount,
        uint256 lockDuration
    ) internal {
        require(contributor != address(0), "Invalid contributor");
        require(totalAmount > 0, "Amount must be positive");
        
        // Calculate split
        uint256 immediate = totalAmount / 2;
        uint256 locked = totalAmount - immediate;
        
        // Transfer immediate portion
        token.safeTransferFrom(_msgSender(), contributor, immediate);
        
        // Transfer locked portion to this contract
        token.safeTransferFrom(_msgSender(), address(this), locked);
        
        // Create lock entry
        uint256 releaseTime = block.timestamp + lockDuration;
        uint256 vestingEnd = vestingEnabled ? releaseTime + DEFAULT_VESTING_DURATION : 0;
        
        locks[contributor].push(Lock({
            amount: locked,
            releaseTime: releaseTime,
            vestingEnd: vestingEnd,
            claimed: 0
        }));
        
        totalDistributed += totalAmount;
        totalLocked += locked;
        
        emit RewardDistributed(contributor, totalAmount, immediate, locked, releaseTime);
    }
    
    // ============ Claiming ============
    
    /**
     * @notice Claim all available locked tokens
     * @dev Iterates through all locks and claims vested amounts
     */
    function claimLockedTokens() external nonReentrant {
        address contributor = _msgSender();
        Lock[] storage contributorLocks = locks[contributor];
        
        uint256 totalClaimable = 0;
        
        for (uint256 i = 0; i < contributorLocks.length; i++) {
            uint256 claimable = _getClaimable(contributorLocks[i]);
            if (claimable > 0) {
                contributorLocks[i].claimed += claimable;
                totalClaimable += claimable;
            }
        }
        
        require(totalClaimable > 0, "Nothing to claim");
        
        totalLocked -= totalClaimable;
        totalClaimed += totalClaimable;
        
        token.safeTransfer(contributor, totalClaimable);
        
        emit LockedClaimed(contributor, totalClaimable);
    }
    
    /**
     * @notice Claim specific lock with optional early withdrawal (slashing)
     * @param lockIndex Index of the lock to claim
     * @param allowSlash If true, allows early withdrawal with penalty
     */
    function claimLock(uint256 lockIndex, bool allowSlash) external nonReentrant {
        address contributor = _msgSender();
        require(lockIndex < locks[contributor].length, "Invalid lock index");
        
        Lock storage lock = locks[contributor][lockIndex];
        uint256 remaining = lock.amount - lock.claimed;
        require(remaining > 0, "Lock fully claimed");
        
        uint256 claimable = _getClaimable(lock);
        uint256 slashAmount = 0;
        
        if (claimable < remaining && allowSlash) {
            // Early withdrawal - apply slash
            uint256 earlyAmount = remaining - claimable;
            slashAmount = (earlyAmount * SLASH_PERCENTAGE) / PERCENTAGE_BASE;
            uint256 afterSlash = earlyAmount - slashAmount;
            claimable += afterSlash;
            
            // Send slashed tokens to DAO/burn
            if (slashAmount > 0) {
                token.safeTransfer(slashDestination, slashAmount);
                totalSlashed += slashAmount;
                emit Slashed(contributor, slashAmount, slashDestination);
            }
        }
        
        require(claimable > 0, "Nothing to claim");
        
        lock.claimed = lock.amount; // Mark as fully claimed
        totalLocked -= remaining;
        totalClaimed += claimable;
        
        token.safeTransfer(contributor, claimable);
        
        emit LockedClaimed(contributor, claimable);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get total claimable amount for a contributor
     */
    function getClaimable(address contributor) external view returns (uint256) {
        Lock[] storage contributorLocks = locks[contributor];
        uint256 total = 0;
        
        for (uint256 i = 0; i < contributorLocks.length; i++) {
            total += _getClaimable(contributorLocks[i]);
        }
        
        return total;
    }
    
    /**
     * @notice Get total locked amount for a contributor
     */
    function getLockedBalance(address contributor) external view returns (uint256) {
        Lock[] storage contributorLocks = locks[contributor];
        uint256 total = 0;
        
        for (uint256 i = 0; i < contributorLocks.length; i++) {
            total += contributorLocks[i].amount - contributorLocks[i].claimed;
        }
        
        return total;
    }
    
    /**
     * @notice Get number of locks for a contributor
     */
    function getLockCount(address contributor) external view returns (uint256) {
        return locks[contributor].length;
    }
    
    /**
     * @notice Get lock details
     */
    function getLock(address contributor, uint256 index) external view returns (
        uint256 amount,
        uint256 releaseTime,
        uint256 vestingEnd,
        uint256 claimed,
        uint256 claimable
    ) {
        require(index < locks[contributor].length, "Invalid index");
        Lock storage lock = locks[contributor][index];
        return (
            lock.amount,
            lock.releaseTime,
            lock.vestingEnd,
            lock.claimed,
            _getClaimable(lock)
        );
    }
    
    function _getClaimable(Lock storage lock) internal view returns (uint256) {
        if (block.timestamp < lock.releaseTime) {
            return 0;
        }
        
        uint256 remaining = lock.amount - lock.claimed;
        
        // If no vesting, all is claimable after cliff
        if (lock.vestingEnd == 0 || block.timestamp >= lock.vestingEnd) {
            return remaining;
        }
        
        // Linear vesting calculation
        uint256 vestingDuration = lock.vestingEnd - lock.releaseTime;
        uint256 timePassed = block.timestamp - lock.releaseTime;
        uint256 vested = (lock.amount * timePassed) / vestingDuration;
        
        if (vested > lock.claimed) {
            return vested - lock.claimed;
        }
        
        return 0;
    }
    
    // ============ Admin Functions ============
    
    function setVestingEnabled(bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        vestingEnabled = enabled;
        emit VestingEnabledChanged(enabled);
    }
    
    function setSlashDestination(address destination) external onlyRole(DAO_ROLE) {
        require(destination != address(0), "Invalid destination");
        slashDestination = destination;
        emit SlashDestinationChanged(destination);
    }
    
    // ============ ERC2771 Overrides ============
    
    function _msgSender() internal view virtual override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }
    
    function _msgData() internal view virtual override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }
    
    function _contextSuffixLength() internal view virtual override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }
}
