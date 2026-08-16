// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    ILithoswapV2Factory,
    ILithoswapV2Pair,
    ILithoswapV2Router
} from "./interfaces.sol";
import { LithoswapV2Library, TransferHelper } from "./libraries.sol";

/// Lithoswap router. ERC-20 ↔ ERC-20 only: on Makalu the native LITHO is a
/// LEP-100 token wrapped by WLITHO (itself an ERC-20), so every swap is
/// token-to-token and the UI does any WLITHO wrap/unwrap as an explicit step.
/// This removes the payable-native handling of Uniswap's Router02 and the whole
/// class of wrap/unwrap-in-router edge cases with it.
contract LithoswapV2Router02 is ILithoswapV2Router {
    address public immutable override factory;
    address public immutable override WLITHO;

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "LithoswapRouter: EXPIRED");
        _;
    }

    constructor(address _factory, address _wlitho) {
        require(_factory != address(0), "LithoswapRouter: ZERO_FACTORY");
        require(_wlitho != address(0), "LithoswapRouter: ZERO_WLITHO");
        factory = _factory;
        WLITHO = _wlitho;
    }

    // ── Liquidity ────────────────────────────────────────────────────────────

    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin
    ) internal returns (uint256 amountA, uint256 amountB) {
        if (ILithoswapV2Factory(factory).getPair(tokenA, tokenB) == address(0)) {
            ILithoswapV2Factory(factory).createPair(tokenA, tokenB);
        }
        (uint256 reserveA, uint256 reserveB) = LithoswapV2Library.getReserves(factory, tokenA, tokenB);
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint256 amountBOptimal = LithoswapV2Library.quote(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, "LithoswapRouter: INSUFFICIENT_B_AMOUNT");
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = LithoswapV2Library.quote(amountBDesired, reserveB, reserveA);
                assert(amountAOptimal <= amountADesired);
                require(amountAOptimal >= amountAMin, "LithoswapRouter: INSUFFICIENT_A_AMOUNT");
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external override ensure(deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        (amountA, amountB) =
            _addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin);
        address pair = LithoswapV2Library.pairFor(factory, tokenA, tokenB);
        TransferHelper.safeTransferFrom(tokenA, msg.sender, pair, amountA);
        TransferHelper.safeTransferFrom(tokenB, msg.sender, pair, amountB);
        liquidity = ILithoswapV2Pair(pair).mint(to);
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) public override ensure(deadline) returns (uint256 amountA, uint256 amountB) {
        address pair = LithoswapV2Library.pairFor(factory, tokenA, tokenB);
        ILithoswapV2Pair(pair).transferFrom(msg.sender, pair, liquidity); // send LP to pair
        (uint256 amount0, uint256 amount1) = ILithoswapV2Pair(pair).burn(to);
        (address token0,) = LithoswapV2Library.sortTokens(tokenA, tokenB);
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
        require(amountA >= amountAMin, "LithoswapRouter: INSUFFICIENT_A_AMOUNT");
        require(amountB >= amountBMin, "LithoswapRouter: INSUFFICIENT_B_AMOUNT");
    }

    // ── Swaps ────────────────────────────────────────────────────────────────

    // Requires each intermediate amount already sent to the first pair.
    function _swap(uint256[] memory amounts, address[] memory path, address _to) internal {
        for (uint256 i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0,) = LithoswapV2Library.sortTokens(input, output);
            uint256 amountOut = amounts[i + 1];
            (uint256 amount0Out, uint256 amount1Out) =
                input == token0 ? (uint256(0), amountOut) : (amountOut, uint256(0));
            address to = i < path.length - 2
                ? LithoswapV2Library.pairFor(factory, output, path[i + 2])
                : _to;
            ILithoswapV2Pair(LithoswapV2Library.pairFor(factory, input, output)).swap(
                amount0Out, amount1Out, to, new bytes(0)
            );
        }
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external override ensure(deadline) returns (uint256[] memory amounts) {
        amounts = LithoswapV2Library.getAmountsOut(factory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "LithoswapRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, LithoswapV2Library.pairFor(factory, path[0], path[1]), amounts[0]
        );
        _swap(amounts, path, to);
    }

    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external override ensure(deadline) returns (uint256[] memory amounts) {
        amounts = LithoswapV2Library.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= amountInMax, "LithoswapRouter: EXCESSIVE_INPUT_AMOUNT");
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, LithoswapV2Library.pairFor(factory, path[0], path[1]), amounts[0]
        );
        _swap(amounts, path, to);
    }

    // ── Views (pure pass-throughs to the library) ────────────────────────────

    function quote(uint256 amountA, uint256 reserveA, uint256 reserveB)
        external
        pure
        override
        returns (uint256 amountB)
    {
        return LithoswapV2Library.quote(amountA, reserveA, reserveB);
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        external
        pure
        override
        returns (uint256 amountOut)
    {
        return LithoswapV2Library.getAmountOut(amountIn, reserveIn, reserveOut);
    }

    function getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut)
        external
        pure
        override
        returns (uint256 amountIn)
    {
        return LithoswapV2Library.getAmountIn(amountOut, reserveIn, reserveOut);
    }

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        override
        returns (uint256[] memory amounts)
    {
        return LithoswapV2Library.getAmountsOut(factory, amountIn, path);
    }

    function getAmountsIn(uint256 amountOut, address[] calldata path)
        external
        view
        override
        returns (uint256[] memory amounts)
    {
        return LithoswapV2Library.getAmountsIn(factory, amountOut, path);
    }
}
