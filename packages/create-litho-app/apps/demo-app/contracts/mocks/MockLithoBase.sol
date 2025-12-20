// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {LithoBase} from "../LithoBase.sol";

/**
 * @title MockLithoBase
 * @notice Concrete implementation of LithoBase for testing
 * @dev Exposes internal functions and adds test functionality
 */
contract MockLithoBase is LithoBase {
    uint256 public actionCount;

    constructor(address initialOwner) LithoBase(initialOwner) {}

    /**
     * @notice Test function that uses _beforeAction hook
     */
    function performAction() external {
        _beforeAction();
        actionCount++;
    }
}
