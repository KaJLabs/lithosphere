// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice ERC20 representation of a Kamet LEP100 token on a destination chain.
/// Minted only by MultXBridge (via BRIDGE_ROLE) when an attested lock arrives
/// from the source chain. Holders can burn at any time; the dest-chain
/// MultXBridge.lockTokens() will pull and burn during a reverse-bridge flow.
///
/// Origin metadata (originToken / originChainId) is recorded immutably so any
/// off-chain indexer can correlate the wrapped representation to its canonical
/// source asset without consulting external registries.
contract WrappedLEP100 is ERC20, ERC20Burnable, AccessControl {
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    uint8 private immutable _decimals;
    address public immutable originToken;
    uint256 public immutable originChainId;

    event BridgeMint(address indexed to, uint256 amount);

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address bridge,
        address originToken_,
        uint256 originChainId_
    ) ERC20(name_, symbol_) {
        require(bridge != address(0), "Bridge address required");
        require(originToken_ != address(0), "Origin token required");
        require(originChainId_ != 0, "Origin chain id required");

        _decimals = decimals_;
        originToken = originToken_;
        originChainId = originChainId_;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BRIDGE_ROLE, bridge);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /// @notice Bridge-only mint. Reverts for any caller without BRIDGE_ROLE.
    function bridgeMint(address to, uint256 amount) external onlyRole(BRIDGE_ROLE) {
        _mint(to, amount);
        emit BridgeMint(to, amount);
    }
}
