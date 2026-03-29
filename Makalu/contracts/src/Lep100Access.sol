// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
abstract contract Lep100Access {
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);
    bytes32 public constant ADMIN_ROLE  = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    mapping(bytes32 => mapping(address => bool)) private _roles;
    modifier onlyRole(bytes32 role){ require(hasRole(role, msg.sender), "access denied"); _; }
    function _setupRole(bytes32 role, address account) internal {
        if (!_roles[role][account]) { _roles[role][account] = true; emit RoleGranted(role, account, msg.sender); }
    }
    function hasRole(bytes32 role, address account) public view returns(bool){ return _roles[role][account]; }
    function grantRole(bytes32 role, address account) external onlyRole(ADMIN_ROLE){ _setupRole(role, account); }
    function revokeRole(bytes32 role, address account) external onlyRole(ADMIN_ROLE){
        if (_roles[role][account]) { _roles[role][account]=false; emit RoleRevoked(role, account, msg.sender); }
    }
}
