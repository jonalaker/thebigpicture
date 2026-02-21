// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FixedPriceSwap
 * @notice Private, fixed-price token sale for PINN44 before public DEX listing
 * @dev Users pay with USDC, receive PINN44 at an admin-set price.
 *      Designed as a stepping stone before Uniswap/QuickSwap listing.
 */
contract FixedPriceSwap is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============
    bytes32 public constant SALE_ADMIN = keccak256("SALE_ADMIN");

    // ============ State ============
    IERC20 public immutable pinn44Token;
    IERC20 public immutable paymentToken; // e.g. USDC

    // Price: how many PINN44 tokens per 1 Payment Token (scaled by 1e18)
    // e.g. price = 100e18 means 1 USDC buys 100 PINN44
    // NOTE: Payment token is assumed to have 6 decimals (stablecoin standard)
    uint256 public pricePerUnit;

    // Sale controls
    bool public saleActive;
    bool public whitelistEnabled;

    // Limits
    uint256 public maxPerWallet;     // Max total PINN44 each wallet can buy (0 = unlimited)
    uint256 public maxPerTx;         // Max PINN44 per single transaction (0 = unlimited)
    uint256 public cooldownSeconds;  // Seconds between purchases per wallet

    // Tracking
    mapping(address => uint256) public totalPurchased; // Per-wallet total PINN44 bought
    mapping(address => uint256) public lastPurchaseTime;
    mapping(address => bool) public whitelisted;

    // Stats
    uint256 public totalTokensSold;
    uint256 public totalFundsRaised; // Amount of payment token raised

    // ============ Events ============
    event TokensPurchased(
        address indexed buyer,
        uint256 cost,
        uint256 tokensBought
    );
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);
    event SaleStatusChanged(bool active);
    event WhitelistStatusChanged(bool enabled);
    event WhitelistUpdated(address indexed account, bool status);
    event LimitsUpdated(uint256 maxPerWallet, uint256 maxPerTx, uint256 cooldown);
    event TokensDeposited(uint256 amount);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event TokensWithdrawn(address indexed to, uint256 amount);

    // ============ Constructor ============
    constructor(
        address tokenAddress,
        address paymentTokenAddress,
        address admin,
        uint256 initialPrice
    ) {
        require(tokenAddress != address(0), "Invalid token");
        require(paymentTokenAddress != address(0), "Invalid payment token");
        require(admin != address(0), "Invalid admin");
        require(initialPrice > 0, "Price must be positive");

        pinn44Token = IERC20(tokenAddress);
        paymentToken = IERC20(paymentTokenAddress);
        pricePerUnit = initialPrice;
        saleActive = false;
        whitelistEnabled = false;

        // Default limits
        maxPerWallet = 50_000 * 10**18;  // 50K PINN44 per wallet
        maxPerTx = 10_000 * 10**18;      // 10K PINN44 per tx
        cooldownSeconds = 60;             // 1 minute cooldown

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SALE_ADMIN, admin);
    }

    // ============ Buy Function ============

    /**
     * @notice Buy PINN44 tokens with USDC at the fixed price
     * @param amount Amount of payment tokens (USDC) to spend
     */
    function buyTokens(uint256 amount) external nonReentrant {
        require(saleActive, "Sale not active");
        require(amount > 0, "Amount too small");

        if (whitelistEnabled) {
            require(whitelisted[msg.sender], "Not whitelisted");
        }

        // Calculate tokens to receive
        // Formula: (PaymentAmount * Price) / 10^PaymentDecimals
        // Assumes PaymentDecimals = 6 for USDC
        uint256 tokenAmount = (amount * pricePerUnit) / 10**6;
        require(tokenAmount > 0, "Token amount too small");

        // Check per-tx limit
        if (maxPerTx > 0) {
            require(tokenAmount <= maxPerTx, "Exceeds max per tx");
        }

        // Check per-wallet limit
        if (maxPerWallet > 0) {
            require(
                totalPurchased[msg.sender] + tokenAmount <= maxPerWallet,
                "Exceeds max per wallet"
            );
        }

        // Check cooldown
        if (cooldownSeconds > 0) {
            require(
                block.timestamp >= lastPurchaseTime[msg.sender] + cooldownSeconds,
                "Cooldown active"
            );
        }

        // Check contract has enough tokens
        uint256 available = pinn44Token.balanceOf(address(this));
        require(available >= tokenAmount, "Insufficient tokens for sale");

        // Transfer payment from user to this contract
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);

        // Update state
        totalPurchased[msg.sender] += tokenAmount;
        lastPurchaseTime[msg.sender] = block.timestamp;
        totalTokensSold += tokenAmount;
        totalFundsRaised += amount;

        // Transfer tokens to buyer
        pinn44Token.safeTransfer(msg.sender, tokenAmount);

        emit TokensPurchased(msg.sender, amount, tokenAmount);
    }

    // ============ View Functions ============

    /**
     * @notice Get available tokens for sale
     */
    function availableForSale() external view returns (uint256) {
        return pinn44Token.balanceOf(address(this));
    }

    /**
     * @notice Preview how many tokens a given Payment amount would buy
     */
    function getTokensForPayment(uint256 paymentAmount) external view returns (uint256) {
        return (paymentAmount * pricePerUnit) / 10**6;
    }

    /**
     * @notice Preview how much Payment is needed for a given token amount
     */
    function getPaymentForTokens(uint256 tokenAmount) external view returns (uint256) {
        require(pricePerUnit > 0, "Price not set");
        // tokenAmount * 10^6 / price
        return (tokenAmount * 10**6) / pricePerUnit;
    }

    /**
     * @notice Get remaining buy limit for a wallet
     */
    function getRemainingLimit(address buyer) external view returns (uint256) {
        if (maxPerWallet == 0) return type(uint256).max;
        if (totalPurchased[buyer] >= maxPerWallet) return 0;
        return maxPerWallet - totalPurchased[buyer];
    }

    /**
     * @notice Check if a buyer can purchase right now
     */
    function canBuy(address buyer) external view returns (bool allowed, string memory reason) {
        if (!saleActive) return (false, "Sale not active");
        if (whitelistEnabled && !whitelisted[buyer]) return (false, "Not whitelisted");
        if (maxPerWallet > 0 && totalPurchased[buyer] >= maxPerWallet) return (false, "Wallet limit reached");
        if (cooldownSeconds > 0 && block.timestamp < lastPurchaseTime[buyer] + cooldownSeconds) return (false, "Cooldown active");
        if (pinn44Token.balanceOf(address(this)) == 0) return (false, "Sold out");
        return (true, "");
    }

    /**
     * @notice Get sale stats
     */
    function getSaleStats() external view returns (
        uint256 _totalTokensSold,
        uint256 _totalFundsRaised,
        uint256 _availableTokens,
        uint256 _currentPrice,
        bool _isActive
    ) {
        return (
            totalTokensSold,
            totalFundsRaised,
            pinn44Token.balanceOf(address(this)),
            pricePerUnit,
            saleActive
        );
    }

    // ============ Admin Functions ============

    /**
     * @notice Update the token price
     * @param newPrice Tokens per 1 Unit of Payment (scaled by 1e18)
     */
    function setPrice(uint256 newPrice) external onlyRole(SALE_ADMIN) {
        require(newPrice > 0, "Price must be positive");
        uint256 oldPrice = pricePerUnit;
        pricePerUnit = newPrice;
        emit PriceUpdated(oldPrice, newPrice);
    }

    /**
     * @notice Start or stop the sale
     */
    function setSaleActive(bool active) external onlyRole(SALE_ADMIN) {
        saleActive = active;
        emit SaleStatusChanged(active);
    }

    /**
     * @notice Enable or disable whitelist requirement
     */
    function setWhitelistEnabled(bool enabled) external onlyRole(SALE_ADMIN) {
        whitelistEnabled = enabled;
        emit WhitelistStatusChanged(enabled);
    }

    /**
     * @notice Add or remove addresses from whitelist
     */
    function setWhitelisted(address[] calldata accounts, bool status) external onlyRole(SALE_ADMIN) {
        for (uint256 i = 0; i < accounts.length; i++) {
            whitelisted[accounts[i]] = status;
            emit WhitelistUpdated(accounts[i], status);
        }
    }

    /**
     * @notice Update buy limits
     */
    function setLimits(
        uint256 _maxPerWallet,
        uint256 _maxPerTx,
        uint256 _cooldown
    ) external onlyRole(SALE_ADMIN) {
        maxPerWallet = _maxPerWallet;
        maxPerTx = _maxPerTx;
        cooldownSeconds = _cooldown;
        emit LimitsUpdated(_maxPerWallet, _maxPerTx, _cooldown);
    }

    /**
     * @notice Deposit PINN44 tokens for sale
     */
    function depositTokens(uint256 amount) external onlyRole(SALE_ADMIN) nonReentrant {
        require(amount > 0, "Amount must be positive");
        pinn44Token.safeTransferFrom(msg.sender, address(this), amount);
        emit TokensDeposited(amount);
    }

    /**
     * @notice Withdraw collected Payment Tokens to admin
     */
    function withdrawFunds(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        require(to != address(0), "Invalid address");
        paymentToken.safeTransfer(to, amount);
        emit FundsWithdrawn(to, amount);
    }

    /**
     * @notice Withdraw unsold PINN44 tokens
     */
    function withdrawTokens(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(to != address(0), "Invalid address");
        pinn44Token.safeTransfer(to, amount);
        emit TokensWithdrawn(to, amount);
    }
}
