// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "./Lep100.sol";
contract LITHONative is Lep100 {
    uint256 public constant LITHO_ID = 0;
    constructor() Lep100("LITHO","LITHO","https://meta.litho.ai/") {}
    function deposit(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _balances[LITHO_ID][to] += amount;
        totalSupply[LITHO_ID] += amount;
        emit TransferSingle(msg.sender, address(0), to, LITHO_ID, amount);
    }
    function withdraw(address from, uint256 amount) external onlyRole(MINTER_ROLE) {
        uint256 f = _balances[LITHO_ID][from]; require(f >= amount, "insufficient");
        unchecked { _balances[LITHO_ID][from] = f - amount; } totalSupply[LITHO_ID] -= amount;
        emit TransferSingle(msg.sender, from, address(0), LITHO_ID, amount);
    }
}
