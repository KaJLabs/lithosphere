// SPDX-License-Identifier: MIT
pragma solidity ~0.8.17;

import "@ensdomains/ens-contracts/contracts/ethregistrar/BaseRegistrarImplementation.sol";
import "@ensdomains/ens-contracts/contracts/ethregistrar/IPriceOracle.sol";
import "@ensdomains/ens-contracts/contracts/registry/ENS.sol";

/// @title  Lithosphere Registrar Controller
/// @notice Minimal commit-reveal registration entry point for the Lithosphere
///         Naming Service. Models the ETHRegistrarController flow but drops
///         NameWrapper (which hard-codes the `.eth` namehash) so this can be
///         used with our `.litho` TLD.
///
/// @dev Registration flow (v0):
///   1. Caller computes `commitment = makeCommitment(...)` and submits `commit(commitment)`.
///   2. After `minCommitmentAge` seconds, caller submits `register(...)`.
///      The controller calls `baseRegistrar.register(tokenId, owner, FOREVER_DURATION)`
///      which sets the ENS registry owner of `<name>.litho` to `owner` and an
///      expiry ~100 years out (effectively permanent ownership).
///   3. To set resolver records, the new owner sends a separate tx
///      (`registry.setResolver(...)` and `resolver.setAddr(...)`).
///      v0 keeps that step manual; a future version can fold it in by minting
///      to the controller temporarily and transferring ownership after writes.
///
/// @dev Permanent ownership: the underlying BaseRegistrar uses a `uint256 expiries`
///      mapping that requires a finite duration. We override the caller's
///      `duration` to a 100-year constant on every register/renew call, so names
///      effectively never expire. The user-supplied `duration` is still used in
///      the commitment hash (for compatibility with the commit-reveal flow) and
///      in the price oracle call (which is zero on testnet).
///
/// @dev Pricing on Kamet testnet uses ZeroPriceOracle (free). Mainnet should
///      replace with a USD-pegged oracle.
contract LithoRegistrarController {
    /// @notice Duration passed to BaseRegistrar.register / .renew, in seconds.
    /// 100 years × 365 days × 86400s. Names effectively never expire.
    uint256 public constant FOREVER_DURATION = 100 * 365 days;

    BaseRegistrarImplementation public immutable base;
    IPriceOracle                public immutable prices;
    uint256                     public immutable minCommitmentAge;
    uint256                     public immutable maxCommitmentAge;
    ENS                         public immutable ens;
    bytes32                     public immutable tldNode;

    mapping(bytes32 => uint256) public commitments;

    error CommitmentTooNew(bytes32);
    error CommitmentTooOld(bytes32);
    error UnexpiredCommitmentExists(bytes32);
    error NameNotAvailable(string);
    error InsufficientValue();
    error MaxCommitmentAgeTooLow();

    event NameRegistered(
        string  name,
        bytes32 indexed label,
        address indexed owner,
        uint256 baseCost,
        uint256 premium,
        uint256 expires
    );

    constructor(
        BaseRegistrarImplementation _base,
        IPriceOracle                _prices,
        uint256                     _minCommitmentAge,
        uint256                     _maxCommitmentAge,
        ENS                         _ens,
        bytes32                     _tldNode
    ) {
        if (_maxCommitmentAge <= _minCommitmentAge) revert MaxCommitmentAgeTooLow();
        base             = _base;
        prices           = _prices;
        minCommitmentAge = _minCommitmentAge;
        maxCommitmentAge = _maxCommitmentAge;
        ens              = _ens;
        tldNode          = _tldNode;
    }

    function valid(string memory name) public pure returns (bool) {
        return bytes(name).length >= 3;
    }

    function available(string memory name) public view returns (bool) {
        bytes32 label = keccak256(bytes(name));
        return valid(name) && base.available(uint256(label));
    }

    function rentPrice(string memory name, uint256 duration)
        public view returns (IPriceOracle.Price memory)
    {
        bytes32 label = keccak256(bytes(name));
        uint256 expires = base.nameExpires(uint256(label));
        return prices.price(name, expires, duration);
    }

    /// @notice Compute the commitment hash for a planned registration.
    /// @dev Caller chooses `secret` randomly to defeat front-running.
    function makeCommitment(
        string memory name,
        address owner,
        uint256 duration,
        bytes32 secret
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(
            keccak256(bytes(name)),
            owner,
            duration,
            secret
        ));
    }

    /// @notice Submit a registration commitment. Pair with `register()` after
    ///         `minCommitmentAge` seconds.
    function commit(bytes32 commitment) external {
        if (commitments[commitment] + maxCommitmentAge >= block.timestamp) {
            revert UnexpiredCommitmentExists(commitment);
        }
        commitments[commitment] = block.timestamp;
    }

    /// @notice Complete a registration. Sets the ENS registry owner of
    ///         `<name>.litho` to `owner`. Resolver / addr records must be set
    ///         in a separate tx by `owner`.
    function register(
        string calldata name,
        address          owner,
        uint256          duration,
        bytes32          secret
    ) external payable {
        // Cost check (zero on testnet)
        IPriceOracle.Price memory price = rentPrice(name, duration);
        if (msg.value < price.base + price.premium) revert InsufficientValue();

        // Commitment check
        bytes32 commitment = makeCommitment(name, owner, duration, secret);
        if (commitments[commitment] + minCommitmentAge > block.timestamp) {
            revert CommitmentTooNew(commitment);
        }
        if (commitments[commitment] + maxCommitmentAge <= block.timestamp) {
            revert CommitmentTooOld(commitment);
        }

        if (!available(name)) revert NameNotAvailable(name);
        delete commitments[commitment];

        bytes32 label  = keccak256(bytes(name));
        uint256 tokenId = uint256(label);

        // BaseRegistrar.register sets:
        //   - ens.setSubnodeOwner(tldNode, label, owner)  → ENS owner = owner
        //   - mints ERC721 tokenId to owner
        // We ignore the caller's `duration` and always register for FOREVER_DURATION
        // so names are effectively permanent.
        uint256 expires = base.register(tokenId, owner, FOREVER_DURATION);

        emit NameRegistered(name, label, owner, price.base, price.premium, expires);

        // Refund overpayment
        if (msg.value > price.base + price.premium) {
            payable(msg.sender).transfer(msg.value - price.base - price.premium);
        }
    }

    /// @notice Renew an existing registration. Cost computed against caller-
    ///         supplied `duration` (for compatibility with USD-pegged oracles
    ///         in v1) but the on-chain expiry is always extended by
    ///         FOREVER_DURATION so names are effectively permanent.
    function renew(string calldata name, uint256 duration) external payable {
        IPriceOracle.Price memory price = rentPrice(name, duration);
        if (msg.value < price.base) revert InsufficientValue();
        bytes32 label = keccak256(bytes(name));
        uint256 expires = base.renew(uint256(label), FOREVER_DURATION);
        if (msg.value > price.base) {
            payable(msg.sender).transfer(msg.value - price.base);
        }
        emit NameRegistered(name, label, base.ownerOf(uint256(label)), price.base, 0, expires);
    }

    /// @notice Operator-driven renew that takes the tokenId directly. Used by
    ///         the migration sweep that extends every legacy registration to
    ///         FOREVER_DURATION. No payment, no price oracle: the controller's
    ///         BaseRegistrar role authorizes the call. Anyone can invoke it for
    ///         any token — there is no harm in a stranger pushing your expiry
    ///         further into the future.
    function adminRenewById(uint256 tokenId) external {
        uint256 expires = base.renew(tokenId, FOREVER_DURATION);
        emit NameRegistered("", bytes32(tokenId), base.ownerOf(tokenId), 0, 0, expires);
    }
}
