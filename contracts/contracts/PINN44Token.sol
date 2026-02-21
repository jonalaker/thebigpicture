// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "./interfaces/IPINN44Token.sol";

/**
 * @title PINN44Token
 * @notice ERC-20 token with fixed 10M supply, gasless approvals, meta-transactions,
 *         anti-bot protections, and burn capability for buyback programs.
 * @dev Implements ERC20Permit for gasless approvals and ERC2771Context for meta-transactions
 */
contract PINN44Token is 
    ERC2771Context,
    ERC20,
    ERC20Permit,
    ERC20Burnable,
    AccessControl
{
    // ============ Constants ============
    uint256 public constant TOTAL_SUPPLY = 1_000_000 * 10**18; // 1 million tokens
    uint256 public constant INITIAL_MAX_TX = TOTAL_SUPPLY * 5 / 1000; // 0.5% of supply
    uint256 public constant INITIAL_MAX_WALLET = TOTAL_SUPPLY * 2 / 100; // 2% of supply
    uint256 public constant INITIAL_COOLDOWN = 3; // 3 blocks
    
    // ============ Roles ============
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant ANTI_BOT_ADMIN = keccak256("ANTI_BOT_ADMIN");
    
    // ============ Anti-Bot State ============
    bool public antiBotEnabled;
    uint256 public maxTxAmount;
    uint256 public maxWalletAmount;
    uint256 public cooldownBlocks;
    mapping(address => bool) public isExcludedFromLimits;
    mapping(address => uint256) public lastTxBlock;
    
    // ============ Events ============
    event TokenInitialized(uint256 supply, address owner, address forwarder);
    event AntiBotStatusChanged(bool active);
    event MaxTxUpdated(uint256 newLimit);
    event MaxWalletUpdated(uint256 newLimit);
    event TokensBurned(uint256 amount, address caller);
    event CooldownUpdated(uint256 newCooldown);
    event ExcludedFromLimits(address account, bool excluded);
    
    // ============ Constructor ============
    /**
     * @notice Deploys the PINN44 token with all extensions
     * @param trustedForwarder Address of the trusted forwarder for meta-transactions
     * @param owner Initial owner and admin address
     * @param treasury Treasury address for TREASURY_ROLE
     */
    constructor(
        address trustedForwarder,
        address owner,
        address treasury
    ) 
        ERC2771Context(trustedForwarder)
        ERC20("PINN44", "PINN44")
        ERC20Permit("PINN44")
    {
        require(owner != address(0), "Invalid owner");
        require(treasury != address(0), "Invalid treasury");
        
        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, owner);
        _grantRole(TREASURY_ROLE, treasury);
        _grantRole(ANTI_BOT_ADMIN, owner);
        
        // Initialize anti-bot with defaults
        antiBotEnabled = true;
        maxTxAmount = INITIAL_MAX_TX;
        maxWalletAmount = INITIAL_MAX_WALLET;
        cooldownBlocks = INITIAL_COOLDOWN;
        
        // Exclude owner, treasury, and this contract from limits
        isExcludedFromLimits[owner] = true;
        isExcludedFromLimits[treasury] = true;
        isExcludedFromLimits[address(this)] = true;
        
        // Mint entire supply to owner (one-time mint)
        _mint(owner, TOTAL_SUPPLY);
        
        emit TokenInitialized(TOTAL_SUPPLY, owner, trustedForwarder);
        emit AntiBotStatusChanged(true);
    }
    
    // ============ Anti-Bot Controls ============
    
    /**
     * @notice Enable or disable anti-bot protections
     * @param enabled New anti-bot status
     */
    function setAntiBotEnabled(bool enabled) external onlyRole(ANTI_BOT_ADMIN) {
        antiBotEnabled = enabled;
        emit AntiBotStatusChanged(enabled);
    }
    
    /**
     * @notice Update maximum transaction amount
     * @param amount New max transaction amount (in wei)
     */
    function setMaxTxAmount(uint256 amount) external onlyRole(ANTI_BOT_ADMIN) {
        require(amount >= TOTAL_SUPPLY / 1000, "Max tx too low"); // Min 0.1%
        require(amount <= TOTAL_SUPPLY, "Max tx too high");
        maxTxAmount = amount;
        emit MaxTxUpdated(amount);
    }
    
    /**
     * @notice Update maximum wallet holding amount
     * @param amount New max wallet amount (in wei)
     */
    function setMaxWalletAmount(uint256 amount) external onlyRole(ANTI_BOT_ADMIN) {
        require(amount >= TOTAL_SUPPLY / 100, "Max wallet too low"); // Min 1%
        require(amount <= TOTAL_SUPPLY, "Max wallet too high");
        maxWalletAmount = amount;
        emit MaxWalletUpdated(amount);
    }
    
    /**
     * @notice Update cooldown period between transactions
     * @param blocks Number of blocks for cooldown
     */
    function setCooldownBlocks(uint256 blocks) external onlyRole(ANTI_BOT_ADMIN) {
        require(blocks <= 10, "Cooldown too long"); // Max 10 blocks
        cooldownBlocks = blocks;
        emit CooldownUpdated(blocks);
    }
    
    /**
     * @notice Exclude or include an address from anti-bot limits
     * @param account Address to update
     * @param excluded True to exclude, false to include
     */
    function excludeFromLimits(address account, bool excluded) external onlyRole(ANTI_BOT_ADMIN) {
        isExcludedFromLimits[account] = excluded;
        emit ExcludedFromLimits(account, excluded);
    }
    
    // ============ Transfer Overrides ============
    
    /**
     * @dev Override _update to implement anti-bot checks
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        // Skip checks for minting/burning
        if (from != address(0) && to != address(0)) {
            _antiBotCheck(from, to, amount);
        }
        
        super._update(from, to, amount);
        
        // Update last tx block for sender
        if (from != address(0) && !isExcludedFromLimits[from]) {
            lastTxBlock[from] = block.number;
        }
    }
    
    /**
     * @dev Internal anti-bot validation
     */
    function _antiBotCheck(address from, address to, uint256 amount) internal view {
        if (!antiBotEnabled) return;
        
        // Check max transaction amount
        if (!isExcludedFromLimits[from] && !isExcludedFromLimits[to]) {
            require(amount <= maxTxAmount, "Exceeds max tx");
        }
        
        // Check max wallet holding for receiver
        if (!isExcludedFromLimits[to] && maxWalletAmount > 0) {
            require(
                balanceOf(to) + amount <= maxWalletAmount,
                "Exceeds max wallet"
            );
        }
        
        // Check cooldown for sender
        if (!isExcludedFromLimits[from] && cooldownBlocks > 0) {
            require(
                block.number >= lastTxBlock[from] + cooldownBlocks,
                "Cooldown active"
            );
        }
    }
    
    // ============ Burn Functions ============
    
    /**
     * @notice Burn tokens from caller's balance
     * @dev Overrides ERC20Burnable to emit custom event
     */
    function burn(uint256 amount) public virtual override {
        super.burn(amount);
        emit TokensBurned(amount, _msgSender());
    }
    
    /**
     * @notice Burn tokens from another account (requires approval)
     * @dev Overrides ERC20Burnable to emit custom event
     */
    function burnFrom(address account, uint256 amount) public virtual override {
        super.burnFrom(account, amount);
        emit TokensBurned(amount, _msgSender());
    }
    
    // ============ ERC2771 Overrides ============
    
    /**
     * @dev Returns the sender of the transaction, supporting meta-transactions
     */
    function _msgSender() internal view virtual override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }
    
    /**
     * @dev Returns the calldata of the transaction, supporting meta-transactions
     */
    function _msgData() internal view virtual override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }
    
    /**
     * @dev Returns the context suffix length for ERC2771
     */
    function _contextSuffixLength() internal view virtual override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Check if an address can transfer a given amount
     * @param from Sender address
     * @param amount Transfer amount
     * @return canTransfer True if transfer would succeed
     * @return reason Failure reason if applicable
     */
    function checkTransfer(address from, uint256 amount) external view returns (bool canTransfer, string memory reason) {
        if (!antiBotEnabled) {
            return (true, "");
        }
        
        if (!isExcludedFromLimits[from] && amount > maxTxAmount) {
            return (false, "Exceeds max tx");
        }
        
        if (!isExcludedFromLimits[from] && cooldownBlocks > 0) {
            if (block.number < lastTxBlock[from] + cooldownBlocks) {
                return (false, "Cooldown active");
            }
        }
        
        return (true, "");
    }
    
    /**
     * @notice Check if receiving a transfer would exceed max wallet
     * @param to Receiver address
     * @param amount Transfer amount
     * @return withinLimit True if balance + amount is within limit
     */
    function checkMaxWallet(address to, uint256 amount) external view returns (bool withinLimit) {
        if (!antiBotEnabled || isExcludedFromLimits[to] || maxWalletAmount == 0) {
            return true;
        }
        return balanceOf(to) + amount <= maxWalletAmount;
    }
    
    // ============ Required Overrides ============
    
    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
