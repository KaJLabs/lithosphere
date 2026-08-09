// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title MultXBridge — source-chain lock/release bridge for the MultX network
/// @notice Locks ERC-20 tokens on this chain for cross-chain transfer and releases
///         them back on proof of a validator quorum. Funds are escrowed in this
///         contract; release requires `signaturesRequired` distinct validator
///         signatures over the canonical message hash.
/// @dev Security model:
///      - `Ownable`: config (validator set, supported tokens, daily caps, guardian)
///        is owner-only. In production the owner is a Timelock behind a multisig.
///      - `pauseGuardian`: a separate low-latency key that may `pause()` but never
///        `unpause()` or change config — so a compromised guardian can only halt.
///      - `ReentrancyGuard` + `whenNotPaused` protect `releaseTokens`.
///      - Replay protection: `processedNonces[sourceChain][sourceNonce]`.
///      The contract is non-upgradeable; changing logic requires a redeploy.
contract MultXBridge is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    /// @notice Monotonic counter of successful locks; component of each lock's txHash.
    uint256 public nonce;
    /// @notice Whether an address is in the current validator set.
    mapping(address => bool) public isValidator;
    /// @notice The current validator set (enumerable copy of `isValidator`).
    address[] public validators;
    /// @notice Number of distinct validator signatures required to release funds.
    uint256 public signaturesRequired;
    /// @notice Whether a token may be locked through this bridge.
    mapping(address => bool) public supportedTokens;
    /// @notice processedNonces[sourceChain][sourceNonce] — replay guard for releases.
    mapping(uint256 => mapping(uint256 => bool)) public processedNonces;

    /// @notice Per-token rolling 24h volume cap on locks (0 = unlimited).
    mapping(address => uint256) public dailyCap;
    /// @notice Per-token volume locked in the current 24h window.
    mapping(address => uint256) public dailyVolume;
    /// @notice Per-token timestamp at which the current 24h window started.
    mapping(address => uint256) public lastCapReset;

    /// @notice Fast emergency-pause role, separate from the owner.
    /// The guardian can pause() but NOT unpause(), and cannot touch any config.
    /// This lets a low-latency ops key halt the bridge instantly while the owner
    /// (e.g. a Timelock behind a multisig) keeps exclusive resume/config rights.
    address public pauseGuardian;

    /// @notice Emitted when tokens are locked for transfer to `targetChain`.
    event TokensLocked(
        bytes32 indexed txHash,
        address indexed token,
        address indexed user,
        uint256 amount,
        uint256 targetChain,
        uint256 nonce
    );

    /// @notice Emitted when escrowed tokens are released to `user` on validator quorum.
    event TokensReleased(
        bytes32 indexed txHash,
        address indexed token,
        address indexed user,
        uint256 amount,
        uint256 sourceChain,
        address releasedBy
    );

    /// @notice Emitted when the validator set and/or quorum threshold changes.
    event ValidatorSetUpdated(address[] validators, uint256 signaturesRequired);
    /// @notice Emitted when a token's daily lock cap is set.
    event DailyCapSet(address indexed token, uint256 cap);
    /// @notice Emitted when the fast pause guardian is set or cleared.
    event PauseGuardianUpdated(address indexed previousGuardian, address indexed newGuardian);

    /// @notice Deploy the bridge with an initial validator set and quorum threshold.
    /// @param _validators Initial validator addresses (must be non-empty, no zero address).
    /// @param _signaturesRequired Quorum size; must be in [1, _validators.length].
    constructor(address[] memory _validators, uint256 _signaturesRequired) Ownable(msg.sender) {
        require(_validators.length > 0, "At least one validator required");
        require(_signaturesRequired > 0 && _signaturesRequired <= _validators.length, "Invalid signatures required");

        for (uint256 i = 0; i < _validators.length; i++) {
            require(_validators[i] != address(0), "Invalid validator address");
            isValidator[_validators[i]] = true;
            validators.push(_validators[i]);
        }

        signaturesRequired = _signaturesRequired;
        nonce = 0;
    }

    // ── Admin: token support ────────────────────────────────────────────────────

    /// @notice Allow `token` to be locked through the bridge. Owner-only.
    /// @param token ERC-20 token address to enable.
    function addSupportedToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token address");
        supportedTokens[token] = true;
    }

    /// @notice Disallow new locks of `token` (existing escrow is unaffected). Owner-only.
    /// @param token ERC-20 token address to disable.
    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
    }

    // ── Admin: pause ────────────────────────────────────────────────────────────

    /// @notice Halt locks and releases. Callable by the owner OR the pause guardian.
    function pause() external {
        require(msg.sender == owner() || msg.sender == pauseGuardian, "Not owner or guardian");
        _pause();
    }

    /// @notice Resume the bridge. Owner-only (the guardian can halt but never resume).
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Set (or clear, with address(0)) the fast pause guardian. Owner-only.
    /// @param guardian New guardian address, or address(0) to remove the role.
    function setPauseGuardian(address guardian) external onlyOwner {
        emit PauseGuardianUpdated(pauseGuardian, guardian);
        pauseGuardian = guardian;
    }

    // ── Admin: validator set rotation ───────────────────────────────────────────

    /// @notice Replace the entire validator set and quorum threshold atomically. Owner-only.
    /// @param _validators New validator addresses (non-empty, no zero address).
    /// @param _signaturesRequired New quorum size; must be in [1, _validators.length].
    function setValidatorSet(address[] calldata _validators, uint256 _signaturesRequired) external onlyOwner {
        require(_validators.length > 0, "At least one validator required");
        require(_signaturesRequired > 0 && _signaturesRequired <= _validators.length, "Invalid signatures required");

        // Clear existing set
        uint256 oldLen = validators.length;
        for (uint256 i = 0; i < oldLen; i++) {
            isValidator[validators[i]] = false;
        }
        delete validators;

        // Load new set
        uint256 newLen = _validators.length;
        for (uint256 i = 0; i < newLen; i++) {
            require(_validators[i] != address(0), "Invalid validator address");
            isValidator[_validators[i]] = true;
            validators.push(_validators[i]);
        }

        signaturesRequired = _signaturesRequired;
        emit ValidatorSetUpdated(_validators, _signaturesRequired);
    }

    // ── Admin: daily cap ────────────────────────────────────────────────────────

    /// @notice Set a token's rolling 24h lock cap (0 = unlimited). Owner-only.
    /// @param token Token to cap.
    /// @param cap Maximum cumulative lock amount per 24h window.
    function setDailyCap(address token, uint256 cap) external onlyOwner {
        dailyCap[token] = cap;
        emit DailyCapSet(token, cap);
    }

    // ── Bridge: lock (forward) ──────────────────────────────────────────────────

    /// @notice Lock `amount` of `token` for transfer to `targetChain`.
    /// @dev Reverts if paused, token unsupported, amount is 0, target is this chain,
    ///      or the token's daily cap would be exceeded. Pulls funds via transferFrom
    ///      (caller must have approved this contract).
    /// @param token Supported ERC-20 token to lock.
    /// @param amount Amount to lock (must be > 0).
    /// @param targetChain Destination chain id (must differ from this chain).
    /// @return txHash Canonical lock hash emitted in `TokensLocked`.
    function lockTokens(
        address token,
        uint256 amount,
        uint256 targetChain
    ) external whenNotPaused returns (bytes32) {
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be greater than 0");
        require(targetChain != block.chainid, "Target chain cannot be current chain");

        // Daily cap check (skip if cap == 0)
        if (dailyCap[token] > 0) {
            if (block.timestamp >= lastCapReset[token] + 1 days) {
                dailyVolume[token] = 0;
                lastCapReset[token] = block.timestamp;
            }
            require(dailyVolume[token] + amount <= dailyCap[token], "Daily cap exceeded");
            dailyVolume[token] += amount;
        }

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        nonce++;

        bytes32 txHash = keccak256(
            abi.encodePacked(
                token,
                msg.sender,
                amount,
                targetChain,
                nonce,
                block.chainid
            )
        );

        emit TokensLocked(txHash, token, msg.sender, amount, targetChain, nonce);
        return txHash;
    }

    // ── Bridge: release (reverse) ───────────────────────────────────────────────

    /// @notice Release escrowed `token` to `user` on proof of a validator quorum.
    /// @dev Verifies `signaturesRequired` distinct validator signatures over
    ///      keccak256(sourceTxHash, token, user, amount, sourceChain, sourceNonce)
    ///      (EIP-191 prefixed). Signers must be supplied in strictly ascending
    ///      address order, which enforces distinctness. Marks the (sourceChain,
    ///      sourceNonce) pair processed before transferring (checks-effects-
    ///      interactions) and is `nonReentrant`.
    /// @param token Token to release.
    /// @param user Recipient of the released funds.
    /// @param amount Amount to release (must be > 0).
    /// @param sourceChain Chain id where the corresponding lock occurred.
    /// @param sourceNonce Lock nonce on the source chain (replay key).
    /// @param sourceTxHash Lock txHash on the source chain (bound into the signed message).
    /// @param signatures Validator signatures, ascending by signer address.
    function releaseTokens(
        address token,
        address user,
        uint256 amount,
        uint256 sourceChain,
        uint256 sourceNonce,
        bytes32 sourceTxHash,
        bytes[] calldata signatures
    ) external nonReentrant whenNotPaused {
        require(!processedNonces[sourceChain][sourceNonce], "Nonce already processed");
        require(signatures.length >= signaturesRequired, "Insufficient signatures");
        require(amount > 0, "Amount must be greater than 0");

        // Bind the quorum to this exact destination chain and bridge. Without
        // these fields, a valid release could be replayed on another deployed
        // bridge that shares the validator set and token address.
        bytes32 msgHash = keccak256(
            abi.encodePacked(
                sourceTxHash,
                token,
                user,
                amount,
                sourceChain,
                sourceNonce,
                block.chainid,
                address(this)
            )
        );

        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash)
        );

        address lastSigner = address(0);
        uint256 validSignatures = 0;

        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = recover(ethSignedHash, signatures[i]);

            require(isValidator[signer], "Invalid signer");
            require(signer > lastSigner, "Signatures must be in ascending order");

            lastSigner = signer;
            validSignatures++;

            if (validSignatures >= signaturesRequired) {
                break;
            }
        }

        require(validSignatures >= signaturesRequired, "Insufficient valid signatures");

        processedNonces[sourceChain][sourceNonce] = true;

        IERC20(token).safeTransfer(user, amount);

        emit TokensReleased(sourceTxHash, token, user, amount, sourceChain, msg.sender);
    }

    // ── Internal: ECDSA recovery ────────────────────────────────────────────────

    /// @dev Recover the signer of `hash` from a 65-byte (r,s,v) signature.
    ///      Normalizes legacy v in {0,1} to {27,28}. Signature malleability is not
    ///      exploitable here: each (sourceChain, sourceNonce) is single-use and
    ///      signers must be strictly ascending+distinct validators per release.
    /// @param hash EIP-191 prefixed message hash that was signed.
    /// @param sig 65-byte signature.
    /// @return Recovered signer address.
    function recover(bytes32 hash, bytes memory sig) internal pure returns (address) {
        bytes32 r;
        bytes32 s;
        uint8 v;

        require(sig.length == 65, "Invalid signature length");

        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }

        if (v < 27) {
            v += 27;
        }

        require(v == 27 || v == 28, "Invalid signature");

        return ecrecover(hash, v, r, s);
    }

    // ── Views ───────────────────────────────────────────────────────────────────

    /// @notice Return the current validator set.
    function getValidators() external view returns (address[] memory) {
        return validators;
    }

    /// @notice Return the size of the current validator set.
    function getValidatorCount() external view returns (uint256) {
        return validators.length;
    }

    /// @notice Remaining lockable volume for `token` in the current 24h window.
    /// @dev Returns type(uint256).max when the token has no cap.
    /// @param token Token to query.
    /// @return Remaining amount that may still be locked this window.
    function getDailyRemaining(address token) external view returns (uint256) {
        if (dailyCap[token] == 0) return type(uint256).max;
        uint256 vol = (block.timestamp >= lastCapReset[token] + 1 days) ? 0 : dailyVolume[token];
        return dailyCap[token] > vol ? dailyCap[token] - vol : 0;
    }
}
