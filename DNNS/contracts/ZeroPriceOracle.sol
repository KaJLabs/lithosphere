// SPDX-License-Identifier: MIT
pragma solidity ~0.8.17;

import "@ensdomains/ens-contracts/contracts/ethregistrar/IPriceOracle.sol";

/// @notice Always returns zero price. Used by the .litho registrar on Kamet
/// testnet so name registration is free for v0. Replace with StablePriceOracle
/// (USD-pegged) for mainnet.
contract ZeroPriceOracle is IPriceOracle {
    function price(
        string calldata, /* name */
        uint256,         /* expires */
        uint256          /* duration */
    ) external pure override returns (Price memory) {
        return Price({base: 0, premium: 0});
    }
}
