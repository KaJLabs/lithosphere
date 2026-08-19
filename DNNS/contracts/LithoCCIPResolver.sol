// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

error OffchainLookup(address sender, string[] urls, bytes callData, bytes4 callbackFunction, bytes extraData);

contract LithoCCIPResolver {
    using ECDSA for bytes32;

    bytes4 private constant INTERFACE_ID_ERC165 = 0x01ffc9a7;
    bytes4 private constant INTERFACE_ID_ENSIP10 = 0x9061b923;

    string public url;
    address public owner;
    address public gatewaySigner;

    event URLSet(string url);
    event GatewaySignerSet(address indexed signer);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "LithoCCIPResolver: not owner");
        _;
    }

    constructor(string memory _url, address _gatewaySigner) {
        require(bytes(_url).length != 0, "LithoCCIPResolver: empty URL");
        require(_gatewaySigner != address(0), "LithoCCIPResolver: empty signer");
        url = _url;
        gatewaySigner = _gatewaySigner;
        owner = msg.sender;
        emit URLSet(_url);
        emit GatewaySignerSet(_gatewaySigner);
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == INTERFACE_ID_ERC165 || interfaceId == INTERFACE_ID_ENSIP10;
    }

    function resolve(bytes calldata name, bytes calldata data)
        external
        view
        returns (bytes memory)
    {
        string[] memory urls = new string[](1);
        urls[0] = url;

        // The gateway receives enough context to sign a response bound to this
        // destination chain and original ENSIP-10 request.
        bytes memory request = abi.encode(block.chainid, name, data);
        revert OffchainLookup(
            address(this),
            urls,
            request,
            LithoCCIPResolver.resolveWithProof.selector,
            request
        );
    }

    function resolveWithProof(bytes calldata response, bytes calldata extraData)
        external
        view
        returns (bytes memory)
    {
        (bytes memory result, uint64 validUntil, bytes memory signature) =
            abi.decode(response, (bytes, uint64, bytes));

        require(block.timestamp <= validUntil, "LithoCCIPResolver: expired response");

        bytes32 digest = keccak256(
            abi.encodePacked(address(this), block.chainid, extraData, result, validUntil)
        );
        address recovered = digest.toEthSignedMessageHash().recover(signature);
        require(recovered == gatewaySigner, "LithoCCIPResolver: invalid signature");

        return result;
    }

    function setUrl(string calldata _url) external onlyOwner {
        require(bytes(_url).length != 0, "LithoCCIPResolver: empty URL");
        url = _url;
        emit URLSet(_url);
    }

    function setGatewaySigner(address _gatewaySigner) external onlyOwner {
        require(_gatewaySigner != address(0), "LithoCCIPResolver: empty signer");
        gatewaySigner = _gatewaySigner;
        emit GatewaySignerSet(_gatewaySigner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "LithoCCIPResolver: empty owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
