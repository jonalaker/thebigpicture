// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IPINN44Token.sol";

// Minimal Uniswap V2 Router interface
interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
    
    function getAmountsOut(
        uint256 amountIn,
        address[] calldata path
    ) external view returns (uint256[] memory amounts);
}

/**
 * @title BuyBackBurn
 * @notice Revenue management: buy-back tokens and burn or redistribute
 * @dev Receives USDC/MATIC revenue, swaps for PINN44, distributes or burns
 */
contract BuyBackBurn is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ============ Constants ============
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    
    uint256 public constant SLIPPAGE_BASE = 10000; // 100.00%
    uint256 public constant DEFAULT_SLIPPAGE = 500; // 5%
    uint256 public constant MAX_SLIPPAGE = 2000; // 20%
    
    // ============ State ============
    IPINN44Token public immutable pinn44Token;
    IUniswapV2Router public router;
    
    // Revenue tokens (USDC, MATIC wrapper, etc.)
    mapping(address => bool) public acceptedTokens;
    
    // Distribution config
    uint256 public burnPercentage = 5000; // 50% burn
    uint256 public distributePercentage = 5000; // 50% distribute
    uint256 public slippageTolerance = DEFAULT_SLIPPAGE;
    uint256 public minBuybackAmount = 100 * 10**6; // 100 USDC (6 decimals)
    
    // Stats
    uint256 public totalRevenue;
    uint256 public totalBurned;
    uint256 public totalDistributed;
    
    // Distribution recipients
    address public distributionPool; // Could be staking contract or contribution pool
    
    // ============ Events ============
    event BuyBackExecuted(
        address indexed spentAsset,
        uint256 amountSpent,
        uint256 tokensBought,
        uint256 burned,
        uint256 distributed
    );
    event RevenueReceived(address indexed token, uint256 amount, address from);
    event RevenueDistributed(address indexed asset, uint256 total, uint256 recipientsCount);
    event ConfigUpdated(uint256 burnPct, uint256 distributePct, uint256 slippage);
    event AcceptedTokenUpdated(address token, bool accepted);
    event RouterUpdated(address newRouter);
    
    // ============ Constructor ============
    constructor(
        address tokenAddress,
        address routerAddress,
        address admin,
        address treasury
    ) {
        require(tokenAddress != address(0), "Invalid token");
        require(admin != address(0), "Invalid admin");
        
        pinn44Token = IPINN44Token(tokenAddress);
        router = IUniswapV2Router(routerAddress);
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TREASURY_ROLE, treasury != address(0) ? treasury : admin);
    }
    
    // ============ Revenue Intake ============
    
    /**
     * @notice Deposit revenue tokens
     */
    function depositRevenue(
        address token,
        uint256 amount
    ) external nonReentrant {
        require(acceptedTokens[token] || token == address(pinn44Token), "Token not accepted");
        require(amount > 0, "Amount must be positive");
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        totalRevenue += amount;
        
        emit RevenueReceived(token, amount, msg.sender);
    }
    
    /**
     * @notice Receive native token (MATIC)
     */
    receive() external payable {
        totalRevenue += msg.value;
        emit RevenueReceived(address(0), msg.value, msg.sender);
    }
    
    // ============ Buy-back Functions ============
    
    /**
     * @notice Execute buyback using revenue token
     * @param revenueToken Token to spend (USDC, WMATIC, etc.)
     * @param amount Amount to spend
     * @param path Swap path (e.g., [USDC, WMATIC, PINN44])
     */
    function executeBuyback(
        address revenueToken,
        uint256 amount,
        address[] calldata path
    ) external onlyRole(TREASURY_ROLE) nonReentrant {
        require(amount >= minBuybackAmount, "Below minimum");
        require(path.length >= 2, "Invalid path");
        require(path[path.length - 1] == address(pinn44Token), "Must swap to PINN44");
        
        IERC20 revenue = IERC20(revenueToken);
        require(revenue.balanceOf(address(this)) >= amount, "Insufficient balance");
        
        // Calculate minimum output with slippage
        uint256[] memory amountsOut = router.getAmountsOut(amount, path);
        uint256 expectedOut = amountsOut[amountsOut.length - 1];
        uint256 minOut = (expectedOut * (SLIPPAGE_BASE - slippageTolerance)) / SLIPPAGE_BASE;
        
        // Approve router
        revenue.forceApprove(address(router), amount);
        
        // Execute swap
        uint256[] memory amounts = router.swapExactTokensForTokens(
            amount,
            minOut,
            path,
            address(this),
            block.timestamp + 300 // 5 min deadline
        );
        
        uint256 tokensBought = amounts[amounts.length - 1];
        
        // Calculate distribution
        uint256 toBurn = (tokensBought * burnPercentage) / SLIPPAGE_BASE;
        uint256 toDistribute = tokensBought - toBurn;
        
        // Burn tokens
        if (toBurn > 0) {
            pinn44Token.burn(toBurn);
            totalBurned += toBurn;
        }
        
        // Distribute tokens
        if (toDistribute > 0 && distributionPool != address(0)) {
            IERC20(address(pinn44Token)).safeTransfer(distributionPool, toDistribute);
            totalDistributed += toDistribute;
        } else if (toDistribute > 0) {
            // If no pool set, burn everything
            pinn44Token.burn(toDistribute);
            totalBurned += toDistribute;
            toBurn += toDistribute;
            toDistribute = 0;
        }
        
        emit BuyBackExecuted(revenueToken, amount, tokensBought, toBurn, toDistribute);
    }
    
    /**
     * @notice Burn PINN44 tokens directly held by contract
     */
    function burnDirect(uint256 amount) external onlyRole(TREASURY_ROLE) {
        require(IERC20(address(pinn44Token)).balanceOf(address(this)) >= amount, "Insufficient");
        
        pinn44Token.burn(amount);
        totalBurned += amount;
        
        emit BuyBackExecuted(address(pinn44Token), 0, 0, amount, 0);
    }
    
    /**
     * @notice Distribute stablecoins directly to contributors based on snapshot
     * @param token Stablecoin to distribute
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts per recipient
     */
    function distributeStablecoins(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyRole(TREASURY_ROLE) nonReentrant {
        require(recipients.length == amounts.length, "Length mismatch");
        
        IERC20 stablecoin = IERC20(token);
        uint256 total = 0;
        
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] != address(0) && amounts[i] > 0) {
                stablecoin.safeTransfer(recipients[i], amounts[i]);
                total += amounts[i];
            }
        }
        
        totalDistributed += total;
        
        emit RevenueDistributed(token, total, recipients.length);
    }
    
    // ============ Admin Functions ============
    
    function setConfig(
        uint256 _burnPct,
        uint256 _distributePct,
        uint256 _slippage
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_burnPct + _distributePct == SLIPPAGE_BASE, "Must total 100%");
        require(_slippage <= MAX_SLIPPAGE, "Slippage too high");
        
        burnPercentage = _burnPct;
        distributePercentage = _distributePct;
        slippageTolerance = _slippage;
        
        emit ConfigUpdated(_burnPct, _distributePct, _slippage);
    }
    
    function setAcceptedToken(address token, bool accepted) external onlyRole(DEFAULT_ADMIN_ROLE) {
        acceptedTokens[token] = accepted;
        emit AcceptedTokenUpdated(token, accepted);
    }
    
    function setRouter(address newRouter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newRouter != address(0), "Invalid router");
        router = IUniswapV2Router(newRouter);
        emit RouterUpdated(newRouter);
    }
    
    function setDistributionPool(address pool) external onlyRole(DEFAULT_ADMIN_ROLE) {
        distributionPool = pool;
    }
    
    function setMinBuybackAmount(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minBuybackAmount = amount;
    }
    
    /**
     * @notice Emergency withdraw (for stuck tokens)
     */
    function emergencyWithdraw(
        address token,
        address to,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == address(0)) {
            payable(to).transfer(amount);
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }
    
    // ============ View Functions ============
    
    function getExpectedOutput(
        uint256 amountIn,
        address[] calldata path
    ) external view returns (uint256 amountOut, uint256 minOut) {
        uint256[] memory amounts = router.getAmountsOut(amountIn, path);
        amountOut = amounts[amounts.length - 1];
        minOut = (amountOut * (SLIPPAGE_BASE - slippageTolerance)) / SLIPPAGE_BASE;
    }
    
    function getStats() external view returns (
        uint256 _totalRevenue,
        uint256 _totalBurned,
        uint256 _totalDistributed
    ) {
        return (totalRevenue, totalBurned, totalDistributed);
    }
}
