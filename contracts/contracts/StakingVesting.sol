// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/**
 * @title StakingVesting
 * @notice Multi-purpose staking and vesting contract for team, DAO, and contributors
 * @dev Supports:
 *      - Team vesting: 1yr cliff, 2yr linear
 *      - DAO vesting: 6mo cliff, 2yr linear
 *      - Airdrop locks: unlock on contribution or 6 months
 *      - Staking tiers for task access
 *      - Cooldown and penalties on unstake
 */
contract StakingVesting is ERC2771Context, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============ Constants ============
    bytes32 public constant VESTING_ADMIN = keccak256("VESTING_ADMIN");
    bytes32 public constant CONTRIBUTION_VERIFIER = keccak256("CONTRIBUTION_VERIFIER");
    
    uint256 public constant TEAM_CLIFF = 365 days;
    uint256 public constant TEAM_VESTING = 730 days; // 2 years
    uint256 public constant DAO_CLIFF = 180 days; // 6 months
    uint256 public constant DAO_VESTING = 730 days;
    uint256 public constant AIRDROP_LOCK = 180 days;
    
    uint256 public constant UNSTAKE_COOLDOWN = 7 days;
    uint256 public constant EARLY_UNSTAKE_PENALTY = 5; // 5%
    uint256 public constant PERCENTAGE_BASE = 100;
    
    // Staking tiers (token amounts)
    uint256 public constant TIER_1 = 1_000 * 10**18;   // 1K tokens
    uint256 public constant TIER_2 = 5_000 * 10**18;   // 5K tokens
    uint256 public constant TIER_3 = 10_000 * 10**18;  // 10K tokens
    uint256 public constant TIER_4 = 25_000 * 10**18;  // 25K tokens
    
    // ============ Enums ============
    enum VestingType { TEAM, DAO, AIRDROP }
    
    // ============ Structs ============
    struct VestingSchedule {
        uint256 totalAmount;
        uint256 startTime;
        uint256 cliffDuration;
        uint256 vestingDuration;
        uint256 claimed;
        VestingType vestType;
        bool contributionUnlocked; // For airdrop: true if contribution made
    }
    
    struct StakeInfo {
        uint256 amount;
        uint256 stakedAt;
        uint256 unstakeRequestedAt;
        uint256 pendingUnstake;
    }
    
    // ============ State ============
    IERC20 public immutable token;
    address public penaltyDestination;
    
    // Vesting
    mapping(address => VestingSchedule[]) public vestingSchedules;
    uint256 public totalVested;
    uint256 public totalVestingClaimed;
    
    // Staking
    mapping(address => StakeInfo) public stakes;
    uint256 public totalStaked;
    
    // Rewards pool (non-inflationary)
    uint256 public rewardsPool;
    uint256 public rewardRate; // tokens per second per staked token (scaled by 1e18)
    mapping(address => uint256) public rewardDebt;
    uint256 public accRewardPerShare;
    uint256 public lastRewardTime;
    
    // ============ Events ============
    event VestingScheduleCreated(
        address indexed beneficiary,
        uint256 amount,
        VestingType vestType,
        uint256 cliff,
        uint256 vestingDuration
    );
    event VestingReleased(address indexed beneficiary, uint256 amount);
    event ContributionVerified(address indexed beneficiary, uint256 scheduleIndex);
    
    event StakeDeposited(address indexed staker, uint256 amount, uint256 tier);
    event StakeWithdrawn(address indexed staker, uint256 amount, uint256 penalty);
    event UnstakeRequested(address indexed staker, uint256 amount, uint256 unlockTime);
    event RewardsAdded(uint256 amount);
    event RewardsClaimed(address indexed staker, uint256 amount);
    
    // ============ Constructor ============
    constructor(
        address trustedForwarder,
        address tokenAddress,
        address admin
    ) ERC2771Context(trustedForwarder) {
        require(tokenAddress != address(0), "Invalid token");
        require(admin != address(0), "Invalid admin");
        
        token = IERC20(tokenAddress);
        penaltyDestination = admin;
        lastRewardTime = block.timestamp;
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VESTING_ADMIN, admin);
        _grantRole(CONTRIBUTION_VERIFIER, admin);
    }
    
    // ============ Vesting Functions ============
    
    /**
     * @notice Create a vesting schedule for beneficiary
     */
    function createVestingSchedule(
        address beneficiary,
        uint256 amount,
        VestingType vestType
    ) external onlyRole(VESTING_ADMIN) nonReentrant {
        require(beneficiary != address(0), "Invalid beneficiary");
        require(amount > 0, "Amount must be positive");
        
        token.safeTransferFrom(_msgSender(), address(this), amount);
        
        uint256 cliff;
        uint256 vesting;
        
        if (vestType == VestingType.TEAM) {
            cliff = TEAM_CLIFF;
            vesting = TEAM_VESTING;
        } else if (vestType == VestingType.DAO) {
            cliff = DAO_CLIFF;
            vesting = DAO_VESTING;
        } else {
            cliff = AIRDROP_LOCK;
            vesting = 0; // No linear vesting for airdrop
        }
        
        vestingSchedules[beneficiary].push(VestingSchedule({
            totalAmount: amount,
            startTime: block.timestamp,
            cliffDuration: cliff,
            vestingDuration: vesting,
            claimed: 0,
            vestType: vestType,
            contributionUnlocked: false
        }));
        
        totalVested += amount;
        
        emit VestingScheduleCreated(beneficiary, amount, vestType, cliff, vesting);
    }
    
    /**
     * @notice Verify contribution to unlock airdrop early
     */
    function verifyContribution(
        address beneficiary,
        uint256 scheduleIndex
    ) external onlyRole(CONTRIBUTION_VERIFIER) {
        require(scheduleIndex < vestingSchedules[beneficiary].length, "Invalid index");
        VestingSchedule storage schedule = vestingSchedules[beneficiary][scheduleIndex];
        require(schedule.vestType == VestingType.AIRDROP, "Not airdrop");
        require(!schedule.contributionUnlocked, "Already unlocked");
        
        schedule.contributionUnlocked = true;
        
        emit ContributionVerified(beneficiary, scheduleIndex);
    }
    
    /**
     * @notice Claim vested tokens
     */
    function claimVested() external nonReentrant {
        address beneficiary = _msgSender();
        VestingSchedule[] storage schedules = vestingSchedules[beneficiary];
        
        uint256 totalClaimable = 0;
        
        for (uint256 i = 0; i < schedules.length; i++) {
            uint256 claimable = _getVestedAmount(schedules[i]) - schedules[i].claimed;
            if (claimable > 0) {
                schedules[i].claimed += claimable;
                totalClaimable += claimable;
            }
        }
        
        require(totalClaimable > 0, "Nothing to claim");
        
        totalVested -= totalClaimable;
        totalVestingClaimed += totalClaimable;
        
        token.safeTransfer(beneficiary, totalClaimable);
        
        emit VestingReleased(beneficiary, totalClaimable);
    }
    
    function _getVestedAmount(VestingSchedule storage schedule) internal view returns (uint256) {
        uint256 elapsed = block.timestamp - schedule.startTime;
        
        // Special case: Airdrop with contribution unlock
        if (schedule.vestType == VestingType.AIRDROP && schedule.contributionUnlocked) {
            return schedule.totalAmount;
        }
        
        // Check cliff
        if (elapsed < schedule.cliffDuration) {
            return 0;
        }
        
        // If no linear vesting (airdrop after cliff)
        if (schedule.vestingDuration == 0) {
            return schedule.totalAmount;
        }
        
        // Linear vesting calculation
        uint256 vestingElapsed = elapsed - schedule.cliffDuration;
        if (vestingElapsed >= schedule.vestingDuration) {
            return schedule.totalAmount;
        }
        
        return (schedule.totalAmount * vestingElapsed) / schedule.vestingDuration;
    }
    
    // ============ Staking Functions ============
    
    /**
     * @notice Stake tokens to access higher-tier tasks
     */
    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be positive");
        
        address staker = _msgSender();
        _updateRewards();
        _harvestRewards(staker);
        
        token.safeTransferFrom(staker, address(this), amount);
        
        stakes[staker].amount += amount;
        stakes[staker].stakedAt = block.timestamp;
        totalStaked += amount;
        
        rewardDebt[staker] = (stakes[staker].amount * accRewardPerShare) / 1e18;
        
        uint256 tier = getStakingTier(staker);
        
        emit StakeDeposited(staker, amount, tier);
    }
    
    /**
     * @notice Request unstake (starts cooldown)
     */
    function requestUnstake(uint256 amount) external nonReentrant {
        address staker = _msgSender();
        StakeInfo storage stakeInfo = stakes[staker];
        
        require(amount > 0, "Amount must be positive");
        require(stakeInfo.amount >= amount, "Insufficient stake");
        require(stakeInfo.pendingUnstake == 0, "Unstake already pending");
        
        _updateRewards();
        _harvestRewards(staker);
        
        stakeInfo.pendingUnstake = amount;
        stakeInfo.unstakeRequestedAt = block.timestamp;
        stakeInfo.amount -= amount;
        
        rewardDebt[staker] = (stakeInfo.amount * accRewardPerShare) / 1e18;
        
        emit UnstakeRequested(staker, amount, block.timestamp + UNSTAKE_COOLDOWN);
    }
    
    /**
     * @notice Complete unstake after cooldown
     */
    function completeUnstake() external nonReentrant {
        address staker = _msgSender();
        StakeInfo storage stakeInfo = stakes[staker];
        
        require(stakeInfo.pendingUnstake > 0, "No pending unstake");
        
        uint256 amount = stakeInfo.pendingUnstake;
        uint256 penalty = 0;
        
        // Check if cooldown passed
        if (block.timestamp < stakeInfo.unstakeRequestedAt + UNSTAKE_COOLDOWN) {
            // Early unstake - apply penalty
            penalty = (amount * EARLY_UNSTAKE_PENALTY) / PERCENTAGE_BASE;
            if (penalty > 0) {
                token.safeTransfer(penaltyDestination, penalty);
            }
        }
        
        stakeInfo.pendingUnstake = 0;
        stakeInfo.unstakeRequestedAt = 0;
        totalStaked -= amount;
        
        uint256 toTransfer = amount - penalty;
        token.safeTransfer(staker, toTransfer);
        
        emit StakeWithdrawn(staker, toTransfer, penalty);
    }
    
    /**
     * @notice Emergency unstake with penalty
     */
    function emergencyUnstake() external nonReentrant {
        address staker = _msgSender();
        StakeInfo storage stakeInfo = stakes[staker];
        
        uint256 amount = stakeInfo.amount + stakeInfo.pendingUnstake;
        require(amount > 0, "Nothing to unstake");
        
        uint256 penalty = (amount * EARLY_UNSTAKE_PENALTY) / PERCENTAGE_BASE;
        
        stakeInfo.amount = 0;
        stakeInfo.pendingUnstake = 0;
        stakeInfo.unstakeRequestedAt = 0;
        totalStaked -= (amount - stakeInfo.pendingUnstake);
        
        if (penalty > 0) {
            token.safeTransfer(penaltyDestination, penalty);
        }
        
        uint256 toTransfer = amount - penalty;
        token.safeTransfer(staker, toTransfer);
        
        emit StakeWithdrawn(staker, toTransfer, penalty);
    }
    
    // ============ Rewards Functions ============
    
    /**
     * @notice Add tokens to rewards pool (non-inflationary)
     */
    function addRewards(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        require(amount > 0, "Amount must be positive");
        
        token.safeTransferFrom(_msgSender(), address(this), amount);
        rewardsPool += amount;
        
        emit RewardsAdded(amount);
    }
    
    /**
     * @notice Set reward rate
     */
    function setRewardRate(uint256 rate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _updateRewards();
        rewardRate = rate;
    }
    
    /**
     * @notice Claim staking rewards
     */
    function claimRewards() external nonReentrant {
        address staker = _msgSender();
        _updateRewards();
        _harvestRewards(staker);
    }
    
    function _updateRewards() internal {
        if (totalStaked == 0 || rewardRate == 0) {
            lastRewardTime = block.timestamp;
            return;
        }
        
        uint256 elapsed = block.timestamp - lastRewardTime;
        uint256 rewards = (elapsed * rewardRate * totalStaked) / 1e18;
        
        if (rewards > rewardsPool) {
            rewards = rewardsPool;
        }
        
        if (rewards > 0) {
            rewardsPool -= rewards;
            accRewardPerShare += (rewards * 1e18) / totalStaked;
        }
        
        lastRewardTime = block.timestamp;
    }
    
    function _harvestRewards(address staker) internal {
        uint256 pending = pendingRewards(staker);
        
        if (pending > 0) {
            token.safeTransfer(staker, pending);
            emit RewardsClaimed(staker, pending);
        }
        
        rewardDebt[staker] = (stakes[staker].amount * accRewardPerShare) / 1e18;
    }
    
    // ============ View Functions ============
    
    function getStakingTier(address staker) public view returns (uint256) {
        uint256 staked = stakes[staker].amount;
        
        if (staked >= TIER_4) return 4;
        if (staked >= TIER_3) return 3;
        if (staked >= TIER_2) return 2;
        if (staked >= TIER_1) return 1;
        return 0;
    }
    
    function pendingRewards(address staker) public view returns (uint256) {
        uint256 acc = accRewardPerShare;
        
        if (totalStaked > 0 && rewardRate > 0) {
            uint256 elapsed = block.timestamp - lastRewardTime;
            uint256 rewards = (elapsed * rewardRate * totalStaked) / 1e18;
            if (rewards > rewardsPool) rewards = rewardsPool;
            acc += (rewards * 1e18) / totalStaked;
        }
        
        uint256 staked = stakes[staker].amount;
        return (staked * acc) / 1e18 - rewardDebt[staker];
    }
    
    function getVestingScheduleCount(address beneficiary) external view returns (uint256) {
        return vestingSchedules[beneficiary].length;
    }
    
    function getClaimableVested(address beneficiary) external view returns (uint256) {
        VestingSchedule[] storage schedules = vestingSchedules[beneficiary];
        uint256 total = 0;
        
        for (uint256 i = 0; i < schedules.length; i++) {
            uint256 vested = _getVestedAmount(schedules[i]);
            if (vested > schedules[i].claimed) {
                total += vested - schedules[i].claimed;
            }
        }
        
        return total;
    }
    
    // ============ Admin ============
    
    function setPenaltyDestination(address destination) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(destination != address(0), "Invalid destination");
        penaltyDestination = destination;
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
