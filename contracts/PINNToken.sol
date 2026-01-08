// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PINN44 Token
 * @notice Internal job-credit token for The Big Picture platform
 */
contract PINNToken is ERC20, Ownable {

    uint256 public constant MAX_SUPPLY = 10_000_000 * 10 ** 18;

    constructor(address ownerAddress)
        ERC20("PINN44 Token", "PINN")
        Ownable(ownerAddress)
    {
        _mint(ownerAddress, MAX_SUPPLY);
    }
}
