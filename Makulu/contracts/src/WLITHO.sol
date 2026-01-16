// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "./Lep100.sol";
contract WLITHO {
    Lep100 public immutable lep;
    uint256 public constant LITHO_ID = 0;
    string public name = "Wrapped LITHO";
    string public symbol = "WLITHO";
    uint8 public immutable decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Deposit(address indexed from, uint256 amount);
    event Withdraw(address indexed to, uint256 amount);
    constructor(Lep100 _lep){ lep = _lep; }
    function deposit(uint256 amount) external {
        lep.safeTransferFrom(msg.sender, address(this), LITHO_ID, amount, "");
        balanceOf[msg.sender] += amount; totalSupply += amount;
        emit Deposit(msg.sender, amount); emit Transfer(address(0), msg.sender, amount);
    }
    function withdraw(uint256 amount) external {
        uint256 b = balanceOf[msg.sender]; require(b >= amount, "WLITHO: insufficient");
        unchecked { balanceOf[msg.sender] = b - amount; } totalSupply -= amount;
        lep.safeTransferFrom(address(this), msg.sender, LITHO_ID, amount, "");
        emit Withdraw(msg.sender, amount); emit Transfer(msg.sender, address(0), amount);
    }
    function approve(address spender, uint256 amount) external returns (bool){
        allowance[msg.sender][spender] = amount; emit Approval(msg.sender, spender, amount); return true;
    }
    function transfer(address to, uint256 amount) external returns (bool){ _transfer(msg.sender, to, amount); return true; }
    function transferFrom(address from, address to, uint256 amount) external returns (bool){
        uint256 allowed = allowance[from][msg.sender]; require(allowed >= amount, "WLITHO: allowance");
        if (allowed != type(uint256).max) { unchecked { allowance[from][msg.sender] = allowed - amount; } }
        _transfer(from, to, amount); return true;
    }
    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "WLITHO: zero"); uint256 f = balanceOf[from]; require(f >= amount, "WLITHO: balance");
        unchecked { balanceOf[from] = f - amount; } balanceOf[to] += amount; emit Transfer(from, to, amount);
    }
}
