// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

/**
 * @title IPINN44Token
 * @notice Interface for the PINN44 token with anti-bot and burn capabilities
 */
interface IPINN44Token is IERC20, IERC20Permit {
    // Events
    event TokenInitialized(uint256 supply, address owner, address forwarder);
    event AntiBotStatusChanged(bool active);
    event MaxTxUpdated(uint256 newLimit);
    event TokensBurned(uint256 amount, address caller);
    event CooldownUpdated(uint256 newCooldown);
    event ExcludedFromLimits(address account, bool excluded);
    
    // View functions
    function antiBotEnabled() external view returns (bool);
    function maxTxAmount() external view returns (uint256);
    function cooldownBlocks() external view returns (uint256);
    function isExcludedFromLimits(address account) external view returns (bool);
    function lastTxBlock(address account) external view returns (uint256);
    
    // Anti-bot controls (admin only)
    function setAntiBotEnabled(bool enabled) external;
    function setMaxTxAmount(uint256 amount) external;
    function setCooldownBlocks(uint256 blocks) external;
    function excludeFromLimits(address account, bool excluded) external;
    
    // Burn function
    function burn(uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
}
