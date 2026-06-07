// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

/**
 * @title PINN44Forwarder
 * @notice Trusted forwarder for ERC-2771 meta-transactions (gasless UX).
 * @dev Users sign an EIP-712 ForwardRequest off-chain (no gas). A funded relayer
 *      calls `execute` / `executeBatch`, paying the gas. The target contract
 *      (e.g. WorkSubmission) must trust this forwarder and resolve the original
 *      sender via ERC2771Context._msgSender().
 *
 *      Constructor name is the EIP-712 domain name and MUST match the name the
 *      client uses when building the typed-data signature ("PINN44Forwarder").
 */
contract PINN44Forwarder is ERC2771Forwarder {
    constructor() ERC2771Forwarder("PINN44Forwarder") {}
}
