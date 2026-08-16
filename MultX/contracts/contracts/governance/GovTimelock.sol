// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/// @notice Thin re-export of OpenZeppelin's audited TimelockController so Hardhat
/// compiles it and our deploy scripts/tests can reference it by name. No logic
/// added — using the unmodified OZ contract keeps it out of the bespoke audit
/// surface.
///
/// Production wiring (Kamet bridge governance):
///   minDelay   = 48h
///   proposers  = [ Gnosis Safe (M-of-N) ]   // schedules validator/cap changes
///   executors  = [ Gnosis Safe ] or [0x0]    // 0x0 = anyone may execute after delay
///   admin      = 0x0                          // self-administered; no super-admin
contract GovTimelock is TimelockController {
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) TimelockController(minDelay, proposers, executors, admin) {}
}
