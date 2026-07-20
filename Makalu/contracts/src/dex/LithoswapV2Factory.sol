// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { LithoswapV2Pair } from "./LithoswapV2Pair.sol";

/// Deploys and tracks Lithoswap pairs. `createPair` uses CREATE2 with a
/// deterministic salt, but the router resolves pairs via `getPair` (see
/// LithoswapV2Library.pairFor), so no init-code-hash constant has to be kept
/// in sync with this bytecode.
contract LithoswapV2Factory {
    address public feeTo;
    address public feeToSetter;

    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint256);

    constructor(address _feeToSetter) {
        feeToSetter = _feeToSetter;
    }

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, "Lithoswap: IDENTICAL_ADDRESSES");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "Lithoswap: ZERO_ADDRESS");
        require(getPair[token0][token1] == address(0), "Lithoswap: PAIR_EXISTS");

        bytes memory bytecode = type(LithoswapV2Pair).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        require(pair != address(0), "Lithoswap: CREATE2_FAILED");
        LithoswapV2Pair(pair).initialize(token0, token1);

        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    function setFeeTo(address _feeTo) external {
        require(msg.sender == feeToSetter, "Lithoswap: FORBIDDEN");
        feeTo = _feeTo;
    }

    function setFeeToSetter(address _feeToSetter) external {
        require(msg.sender == feeToSetter, "Lithoswap: FORBIDDEN");
        feeToSetter = _feeToSetter;
    }
}
