// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20, ILithoswapV2Callee, ILithoswapV2Pair } from "../interfaces.sol";

/// Test-only flash-swap receiver. It proves the pair rejects a nested swap and
/// then repays the configured token/amount so the outer swap can complete.
contract MockFlashSwapCallee is ILithoswapV2Callee {
    bool public reentrySucceeded;

    function start(address pair, uint256 amount0Out, uint256 amount1Out, address repayToken, uint256 repayAmount)
        external
    {
        ILithoswapV2Pair(pair).swap(
            amount0Out,
            amount1Out,
            address(this),
            abi.encode(repayToken, repayAmount)
        );
    }

    function lithoswapV2Call(address, uint256, uint256, bytes calldata data) external override {
        (address repayToken, uint256 repayAmount) = abi.decode(data, (address, uint256));
        (bool reentered,) = msg.sender.call(
            abi.encodeWithSelector(
                ILithoswapV2Pair.swap.selector,
                uint256(1),
                uint256(0),
                address(this),
                new bytes(0)
            )
        );
        reentrySucceeded = reentered;
        require(!reentered, "MockFlash: reentry unexpectedly succeeded");
        require(IERC20(repayToken).transfer(msg.sender, repayAmount), "MockFlash: repayment failed");
    }
}
