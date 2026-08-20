// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Test-only token that burns one percent on each transfer.
contract MockFeeOnTransferERC20 is ERC20 {
    constructor() ERC20("Fee Token", "FEE") {
        _mint(msg.sender, 1_000_000 ether);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = value / 100;
            super._update(from, address(0), fee);
            super._update(from, to, value - fee);
        } else {
            super._update(from, to, value);
        }
    }
}
