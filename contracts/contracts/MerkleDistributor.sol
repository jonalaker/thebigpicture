// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/**
 * @title MerkleDistributor
 * @notice Gas-efficient airdrop distribution using Merkle proofs
 * @dev Supports multiple epochs with replay protection via bitmap
 *      Routes claimed tokens to lock module (90% locked, 10% immediate)
 */
contract MerkleDistributor is ERC2771Context, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============ Constants ============
    bytes32 public constant AIRDROP_ADMIN = keccak256("AIRDROP_ADMIN");
    
    uint256 public constant IMMEDIATE_PERCENTAGE = 10; // 10% immediate
    uint256 public constant LOCKED_PERCENTAGE = 90;    // 90% locked
    uint256 public constant PERCENTAGE_BASE = 100;
    
    // ============ State ============
    IERC20 public immutable token;
    address public lockModule; // StakingVesting contract for locked tokens
    
    struct Epoch {
        bytes32 merkleRoot;
        uint256 startTime;
        uint256 endTime; // 0 = no expiry
        uint256 totalAmount;
        uint256 claimedAmount;
        bool active;
    }
    
    mapping(uint256 => Epoch) public epochs;
    uint256 public currentEpoch;
    
    // Bitmap for tracking claims: epoch => (wordIndex => bitmap)
    mapping(uint256 => mapping(uint256 => uint256)) private claimedBitmap;
    
    // Stats
    uint256 public totalDistributed;
    
    // ============ Events ============
    event AirdropRootSet(uint256 indexed epoch, bytes32 root, uint256 totalAmount);
    event AirdropClaimed(address indexed account, uint256 amount, uint256 indexed epoch);
    event EpochDeactivated(uint256 indexed epoch);
    event LockModuleUpdated(address newModule);
    
    // ============ Constructor ============
    constructor(
        address trustedForwarder,
        address tokenAddress,
        address admin
    ) ERC2771Context(trustedForwarder) {
        require(tokenAddress != address(0), "Invalid token");
        require(admin != address(0), "Invalid admin");
        
        token = IERC20(tokenAddress);
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(AIRDROP_ADMIN, admin);
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Set the lock module address
     */
    function setLockModule(address module) external onlyRole(DEFAULT_ADMIN_ROLE) {
        lockModule = module;
        emit LockModuleUpdated(module);
    }
    
    /**
     * @notice Create a new airdrop epoch with merkle root
     * @param merkleRoot Root of the merkle tree
     * @param totalAmount Total tokens allocated for this epoch
     * @param endTime End time for claims (0 = no expiry)
     */
    function setAirdropRoot(
        bytes32 merkleRoot,
        uint256 totalAmount,
        uint256 endTime
    ) external onlyRole(AIRDROP_ADMIN) nonReentrant {
        require(merkleRoot != bytes32(0), "Invalid root");
        require(totalAmount > 0, "Amount must be positive");
        
        // Transfer tokens for this epoch
        token.safeTransferFrom(_msgSender(), address(this), totalAmount);
        
        currentEpoch++;
        
        epochs[currentEpoch] = Epoch({
            merkleRoot: merkleRoot,
            startTime: block.timestamp,
            endTime: endTime,
            totalAmount: totalAmount,
            claimedAmount: 0,
            active: true
        });
        
        emit AirdropRootSet(currentEpoch, merkleRoot, totalAmount);
    }
    
    /**
     * @notice Deactivate an epoch
     */
    function deactivateEpoch(uint256 epochId) external onlyRole(AIRDROP_ADMIN) {
        require(epochs[epochId].active, "Epoch not active");
        epochs[epochId].active = false;
        emit EpochDeactivated(epochId);
    }
    
    /**
     * @notice Recover unclaimed tokens from expired/deactivated epoch
     */
    function recoverTokens(
        uint256 epochId,
        address to
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        Epoch storage epoch = epochs[epochId];
        require(!epoch.active, "Epoch still active");
        require(epoch.endTime > 0 && block.timestamp > epoch.endTime, "Not expired");
        
        uint256 remaining = epoch.totalAmount - epoch.claimedAmount;
        require(remaining > 0, "Nothing to recover");
        
        epoch.claimedAmount = epoch.totalAmount; // Prevent double recovery
        token.safeTransfer(to, remaining);
    }
    
    // ============ Claim Functions ============
    
    /**
     * @notice Claim airdrop tokens
     * @param index Index in the merkle tree
     * @param account Address to receive tokens
     * @param amount Amount of tokens to claim
     * @param merkleProof Proof for the claim
     */
    function claim(
        uint256 index,
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external nonReentrant {
        _claim(currentEpoch, index, account, amount, merkleProof);
    }
    
    /**
     * @notice Claim airdrop tokens from specific epoch
     */
    function claimFromEpoch(
        uint256 epochId,
        uint256 index,
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external nonReentrant {
        _claim(epochId, index, account, amount, merkleProof);
    }
    
    function _claim(
        uint256 epochId,
        uint256 index,
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) internal {
        Epoch storage epoch = epochs[epochId];
        
        require(epoch.active, "Epoch not active");
        require(epoch.merkleRoot != bytes32(0), "Root not set");
        require(epoch.endTime == 0 || block.timestamp <= epoch.endTime, "Epoch expired");
        require(!isClaimed(epochId, index), "Already claimed");
        
        // Verify merkle proof
        bytes32 node = keccak256(abi.encodePacked(index, account, amount));
        require(MerkleProof.verify(merkleProof, epoch.merkleRoot, node), "Invalid proof");
        
        // Mark as claimed
        _setClaimed(epochId, index);
        
        epoch.claimedAmount += amount;
        totalDistributed += amount;
        
        // Route tokens: 10% immediate, 90% to lock module
        uint256 immediate = (amount * IMMEDIATE_PERCENTAGE) / PERCENTAGE_BASE;
        uint256 locked = amount - immediate;
        
        // Transfer immediate portion
        token.safeTransfer(account, immediate);
        
        // Transfer locked portion to lock module (if set)
        if (lockModule != address(0) && locked > 0) {
            token.safeTransfer(lockModule, locked);
            // Note: Lock module should have logic to handle incoming tokens
            // This is a simplified version - in production, call a specific function
        } else {
            // Fallback: send all to user
            token.safeTransfer(account, locked);
        }
        
        emit AirdropClaimed(account, amount, epochId);
    }
    
    // ============ Bitmap Functions ============
    
    function isClaimed(uint256 epochId, uint256 index) public view returns (bool) {
        uint256 wordIndex = index / 256;
        uint256 bitIndex = index % 256;
        uint256 word = claimedBitmap[epochId][wordIndex];
        uint256 mask = 1 << bitIndex;
        return word & mask != 0;
    }
    
    function _setClaimed(uint256 epochId, uint256 index) internal {
        uint256 wordIndex = index / 256;
        uint256 bitIndex = index % 256;
        claimedBitmap[epochId][wordIndex] |= (1 << bitIndex);
    }
    
    // ============ View Functions ============
    
    function getEpochInfo(uint256 epochId) external view returns (
        bytes32 merkleRoot,
        uint256 startTime,
        uint256 endTime,
        uint256 totalAmount,
        uint256 claimedAmount,
        bool active
    ) {
        Epoch storage epoch = epochs[epochId];
        return (
            epoch.merkleRoot,
            epoch.startTime,
            epoch.endTime,
            epoch.totalAmount,
            epoch.claimedAmount,
            epoch.active
        );
    }
    
    function getRemainingAmount(uint256 epochId) external view returns (uint256) {
        Epoch storage epoch = epochs[epochId];
        return epoch.totalAmount - epoch.claimedAmount;
    }
    
    /**
     * @notice Verify if a claim is valid (for frontend)
     */
    function verifyClaim(
        uint256 epochId,
        uint256 index,
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external view returns (bool valid, string memory reason) {
        Epoch storage epoch = epochs[epochId];
        
        if (!epoch.active) return (false, "Epoch not active");
        if (epoch.merkleRoot == bytes32(0)) return (false, "Root not set");
        if (epoch.endTime > 0 && block.timestamp > epoch.endTime) return (false, "Epoch expired");
        if (isClaimed(epochId, index)) return (false, "Already claimed");
        
        bytes32 node = keccak256(abi.encodePacked(index, account, amount));
        if (!MerkleProof.verify(merkleProof, epoch.merkleRoot, node)) {
            return (false, "Invalid proof");
        }
        
        return (true, "");
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
