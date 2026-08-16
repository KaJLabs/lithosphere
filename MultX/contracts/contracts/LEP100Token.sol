// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LEP100Token
 * @notice Standard LEP100 token on Lithosphere (ERC20 + Burnable)
 *         Modeled after Colle AI (COLLE) token pattern.
 *         Fixed supply minted to deployer at construction.
 */
contract LEP100Token is ERC20, ERC20Burnable, Ownable {
    uint8 private immutable _tokenDecimals;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 totalSupply_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        _tokenDecimals = decimals_;
        _mint(msg.sender, totalSupply_ * 10 ** uint256(decimals_));
    }

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }
}
