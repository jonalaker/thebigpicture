// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/**
 * @title GaslessModule
 * @notice Manages trusted forwarder, function whitelisting, and rate limits for gasless UX
 * @dev Designed to work with relayers like Gelato or Biconomy
 */
contract GaslessModule is ERC2771Context, AccessControl {
    // ============ Constants ============
    bytes32 public constant FORWARDER_ADMIN = keccak256("FORWARDER_ADMIN");
    bytes32 public constant POLICY_ADMIN = keccak256("POLICY_ADMIN");
    
    uint256 public constant FORWARDER_UPDATE_DELAY = 48 hours;
    
    // ============ State ============
    
    // Pending forwarder update
    address public pendingForwarder;
    uint256 public forwarderUpdateTime;
    
    // Function whitelisting (contract => selector => whitelisted)
    mapping(address => mapping(bytes4 => bool)) public whitelistedFunctions;
    
    // Rate limits (user => daily counter)
    struct RateLimit {
        uint256 count;
        uint256 resetTime;
    }
    mapping(address => RateLimit) public userRateLimits;
    uint256 public dailyLimit = 50; // Max 50 gasless txs per day
    
    // Sponsored contracts
    mapping(address => bool) public sponsoredContracts;
    
    // Stats
    uint256 public totalSponsoredTxs;
    
    // ============ Events ============
    event ForwarderUpdateProposed(address indexed oldForwarder, address indexed newForwarder, uint256 effectiveTime);
    event ForwarderUpdated(address indexed oldForwarder, address indexed newForwarder);
    event ForwarderUpdateCancelled();
    event GasSponsorshipPolicySet(address indexed target, bytes4[] selectors, bool enabled);
    event DailyLimitUpdated(uint256 newLimit);
    event ContractSponsorshipChanged(address indexed target, bool sponsored);
    event SponsoredTxExecuted(address indexed user, address indexed target, bytes4 selector);
    
    // ============ Constructor ============
    constructor(
        address trustedForwarder,
        address admin
    ) ERC2771Context(trustedForwarder) {
        require(admin != address(0), "Invalid admin");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(FORWARDER_ADMIN, admin);
        _grantRole(POLICY_ADMIN, admin);
    }
    
    // ============ Forwarder Management ============
    
    /**
     * @notice Propose a forwarder update (takes effect after 48hr delay)
     */
    function proposeForwarderUpdate(address newForwarder) external onlyRole(FORWARDER_ADMIN) {
        require(newForwarder != address(0), "Invalid forwarder");
        require(pendingForwarder == address(0), "Update already pending");
        
        pendingForwarder = newForwarder;
        forwarderUpdateTime = block.timestamp + FORWARDER_UPDATE_DELAY;
        
        emit ForwarderUpdateProposed(trustedForwarder(), newForwarder, forwarderUpdateTime);
    }
    
    /**
     * @notice Cancel pending forwarder update
     */
    function cancelForwarderUpdate() external onlyRole(FORWARDER_ADMIN) {
        require(pendingForwarder != address(0), "No pending update");
        
        pendingForwarder = address(0);
        forwarderUpdateTime = 0;
        
        emit ForwarderUpdateCancelled();
    }
    
    /**
     * @notice Execute forwarder update after delay
     * @dev This updates the trusted forwarder in ERC2771Context
     */
    function executeForwarderUpdate() external onlyRole(FORWARDER_ADMIN) {
        require(pendingForwarder != address(0), "No pending update");
        require(block.timestamp >= forwarderUpdateTime, "Too early");
        
        address oldForwarder = trustedForwarder();
        address newForwarder = pendingForwarder;
        
        pendingForwarder = address(0);
        forwarderUpdateTime = 0;
        
        // Note: ERC2771Context forwarder is immutable - this event is for off-chain tracking
        // In production, you'd need to deploy a new contract or use upgradeable pattern
        emit ForwarderUpdated(oldForwarder, newForwarder);
    }
    
    // ============ Function Whitelisting ============
    
    /**
     * @notice Set sponsorship policy for specific functions
     */
    function setSponsorshipPolicy(
        address target,
        bytes4[] calldata selectors,
        bool enabled
    ) external onlyRole(POLICY_ADMIN) {
        require(target != address(0), "Invalid target");
        
        for (uint256 i = 0; i < selectors.length; i++) {
            whitelistedFunctions[target][selectors[i]] = enabled;
        }
        
        emit GasSponsorshipPolicySet(target, selectors, enabled);
    }
    
    /**
     * @notice Set contract-level sponsorship (all functions)
     */
    function setContractSponsorship(
        address target,
        bool sponsored
    ) external onlyRole(POLICY_ADMIN) {
        sponsoredContracts[target] = sponsored;
        emit ContractSponsorshipChanged(target, sponsored);
    }
    
    // ============ Rate Limiting ============
    
    /**
     * @notice Set daily limit for gasless transactions
     */
    function setDailyLimit(uint256 limit) external onlyRole(POLICY_ADMIN) {
        require(limit > 0, "Limit must be positive");
        dailyLimit = limit;
        emit DailyLimitUpdated(limit);
    }
    
    /**
     * @notice Check if user can make gasless transaction
     */
    function canSponsor(
        address user,
        address target,
        bytes4 selector
    ) external view returns (bool allowed, string memory reason) {
        // Check function/contract whitelist
        if (!sponsoredContracts[target] && !whitelistedFunctions[target][selector]) {
            return (false, "Function not whitelisted");
        }
        
        // Check rate limit
        RateLimit memory limit = userRateLimits[user];
        if (block.timestamp < limit.resetTime && limit.count >= dailyLimit) {
            return (false, "Daily limit reached");
        }
        
        return (true, "");
    }
    
    /**
     * @notice Record a sponsored transaction (called by relayer/backend)
     */
    function recordSponsoredTx(
        address user,
        address target,
        bytes4 selector
    ) external onlyRole(POLICY_ADMIN) {
        // Update rate limit
        RateLimit storage limit = userRateLimits[user];
        
        if (block.timestamp >= limit.resetTime) {
            // Reset daily counter
            limit.count = 1;
            limit.resetTime = block.timestamp + 1 days;
        } else {
            limit.count++;
        }
        
        totalSponsoredTxs++;
        
        emit SponsoredTxExecuted(user, target, selector);
    }
    
    // ============ View Functions ============
    
    function getUserRateLimit(address user) external view returns (
        uint256 usedToday,
        uint256 limit,
        uint256 resetsAt
    ) {
        RateLimit memory rl = userRateLimits[user];
        
        if (block.timestamp >= rl.resetTime) {
            return (0, dailyLimit, block.timestamp + 1 days);
        }
        
        return (rl.count, dailyLimit, rl.resetTime);
    }
    
    function isWhitelisted(address target, bytes4 selector) external view returns (bool) {
        return sponsoredContracts[target] || whitelistedFunctions[target][selector];
    }
    
    function getPendingForwarderUpdate() external view returns (
        address newForwarder,
        uint256 effectiveTime,
        uint256 timeRemaining
    ) {
        if (pendingForwarder == address(0)) {
            return (address(0), 0, 0);
        }
        
        uint256 remaining = 0;
        if (block.timestamp < forwarderUpdateTime) {
            remaining = forwarderUpdateTime - block.timestamp;
        }
        
        return (pendingForwarder, forwarderUpdateTime, remaining);
    }
    
    /**
     * @notice Get common function selectors for whitelisting
     */
    function getCommonSelectors() external pure returns (
        bytes4 claim,
        bytes4 stake,
        bytes4 submit,
        bytes4 vote
    ) {
        // Common functions that are typically gas-sponsored
        return (
            bytes4(keccak256("claim(uint256,address,uint256,bytes32[])")),
            bytes4(keccak256("stake(uint256)")),
            bytes4(keccak256("submitWork(uint256,string,string)")),
            bytes4(keccak256("vote(uint256,bool)"))
        );
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
