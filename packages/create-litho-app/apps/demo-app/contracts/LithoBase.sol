// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title LithoBase
 * @author Lithosphere Team
 * @notice Base contract providing ownership and pausability for Lithosphere contracts
 * @dev Inherits from OpenZeppelin's Ownable and Pausable contracts
 *
 * This contract serves as a foundation for all Lithosphere protocol contracts,
 * providing:
 * - Ownership management with transfer capabilities
 * - Emergency pause/unpause functionality
 * - Common access control patterns
 *
 * ## Usage
 * Inherit from this contract to get ownership and pausability:
 * ```solidity
 * contract MyContract is LithoBase {
 *     constructor() LithoBase(msg.sender) {}
 * }
 * ```
 */
abstract contract LithoBase is Ownable, Pausable {
    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when the contract is initialized
    /// @param owner The initial owner address
    event LithoBaseInitialized(address indexed owner);

    /// @notice Emitted when emergency actions are taken
    /// @param action The action type (pause/unpause)
    /// @param caller The address that triggered the action
    event EmergencyAction(string action, address indexed caller);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @notice Thrown when an invalid address is provided
    error InvalidAddress();

    /// @notice Thrown when the caller is not authorized
    error Unauthorized();

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Initializes the LithoBase contract
     * @param initialOwner The address that will own this contract
     * @dev Sets up ownership and emits initialization event
     */
    constructor(address initialOwner) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert InvalidAddress();
        emit LithoBaseInitialized(initialOwner);
    }

    /*//////////////////////////////////////////////////////////////
                          EMERGENCY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Pauses the contract
     * @dev Can only be called by the owner
     * @dev Emits EmergencyAction event
     */
    function pause() external onlyOwner {
        _pause();
        emit EmergencyAction("pause", msg.sender);
    }

    /**
     * @notice Unpauses the contract
     * @dev Can only be called by the owner
     * @dev Emits EmergencyAction event
     */
    function unpause() external onlyOwner {
        _unpause();
        emit EmergencyAction("unpause", msg.sender);
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Returns the contract version
     * @return The semantic version string
     */
    function version() external pure virtual returns (string memory) {
        return "1.0.0";
    }

    /**
     * @notice Checks if the contract is currently paused
     * @return True if paused, false otherwise
     */
    function isPaused() external view returns (bool) {
        return paused();
    }

    /*//////////////////////////////////////////////////////////////
                          INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Hook that is called before any state-changing operation
     * @dev Override this in derived contracts to add custom checks
     */
    function _beforeAction() internal virtual whenNotPaused {
        // Override in derived contracts
    }
}
