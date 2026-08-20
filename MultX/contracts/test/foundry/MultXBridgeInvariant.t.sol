// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {MultXBridge} from "../../contracts/MultXBridge.sol";
import {MockERC20} from "../../contracts/MockERC20.sol";

/// Bounded handler that drives the source bridge through legitimate operations:
/// lock (escrow), release (with valid N-of-M validator signatures, fresh nonces),
/// replay (re-submitting an already-processed release — must be rejected),
/// daily-cap changes, time advances (to exercise the cap's daily reset), and
/// pause toggles. Ghost variables track the expected accounting so the
/// invariants can compare against on-chain state.
contract BridgeHandler is Test {
    MultXBridge public bridge;
    MockERC20 public token;
    address public owner;

    uint256[] internal pks;       // validator private keys, sorted by address ASC
    uint256 internal sigsRequired;

    // Ghosts
    uint256 public totalLocked;
    uint256 public totalReleased;
    uint256 public lockSuccesses;
    uint256 public releaseNonceSeq;     // always-fresh source nonces
    uint256 public doubleReleaseCount;  // # of replays that wrongly succeeded (must stay 0)

    // Last successful release, retained so replay() can re-submit the exact
    // (already-processed) transfer and prove it is rejected.
    bool internal lastReleaseExists;
    uint256 internal lastAmount;
    uint256 internal lastSourceNonce;
    bytes32 internal lastSourceTxHash;
    address internal lastUser;

    uint256 constant TARGET_CHAIN = 11155111; // sepolia
    uint256 constant SOURCE_CHAIN = 56;        // bnb

    constructor(MultXBridge _bridge, MockERC20 _token, address _owner, uint256[] memory _sortedPks, uint256 _sigsRequired) {
        bridge = _bridge;
        token = _token;
        owner = _owner;
        pks = _sortedPks;
        sigsRequired = _sigsRequired;
    }

    function _signQuorum(bytes32 ethSigned) internal view returns (bytes[] memory sigs) {
        sigs = new bytes[](sigsRequired);
        for (uint256 i = 0; i < sigsRequired; i++) {
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(pks[i], ethSigned); // pks sorted ASC by addr
            sigs[i] = abi.encodePacked(r, s, v);
        }
    }

    function _ethSigned(address user, uint256 amount, uint256 sourceNonce, bytes32 sourceTxHash)
        internal
        view
        returns (bytes32)
    {
        bytes32 msgHash = keccak256(
            abi.encodePacked(
                sourceTxHash, address(token), user, amount, SOURCE_CHAIN,
                sourceNonce, block.chainid, address(bridge)
            )
        );
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
    }

    function lock(uint256 amount) external {
        amount = bound(amount, 1, 1e27);
        token.mint(address(this), amount);
        token.approve(address(bridge), amount);
        try bridge.lockTokens(address(token), amount, TARGET_CHAIN) {
            totalLocked += amount;
            lockSuccesses += 1;
        } catch {}
    }

    function release(uint256 amountSeed) external {
        uint256 bal = token.balanceOf(address(bridge));
        if (bal == 0) return;
        uint256 amount = bound(amountSeed, 1, bal);

        releaseNonceSeq += 1;
        uint256 sourceNonce = releaseNonceSeq;
        bytes32 sourceTxHash = keccak256(abi.encodePacked("src", sourceNonce));
        address user = address(0xBEEF);

        bytes[] memory sigs = _signQuorum(_ethSigned(user, amount, sourceNonce, sourceTxHash));

        try bridge.releaseTokens(address(token), user, amount, SOURCE_CHAIN, sourceNonce, sourceTxHash, sigs) {
            totalReleased += amount;
            lastReleaseExists = true;
            lastAmount = amount;
            lastSourceNonce = sourceNonce;
            lastSourceTxHash = sourceTxHash;
            lastUser = user;
        } catch {}
    }

    /// Re-submit the most recent successful release with identical, fully-valid
    /// parameters + signatures. The (SOURCE_CHAIN, sourceNonce) pair is already
    /// marked processed, so this MUST revert — if it ever succeeds, a double
    /// release occurred and `doubleReleaseCount` records the invariant breach.
    function replay(uint256) external {
        if (!lastReleaseExists) return;
        bytes[] memory sigs =
            _signQuorum(_ethSigned(lastUser, lastAmount, lastSourceNonce, lastSourceTxHash));
        try bridge.releaseTokens(
            address(token), lastUser, lastAmount, SOURCE_CHAIN, lastSourceNonce, lastSourceTxHash, sigs
        ) {
            // Reaching here means the replay guard failed.
            doubleReleaseCount += 1;
            totalReleased += lastAmount;
        } catch {}
    }

    /// Set the per-token daily cap. New caps are clamped to be >= the current
    /// on-chain daily volume (or 0 = unlimited), so `dailyVolume <= dailyCap`
    /// stays a sound global invariant: the contract only ever lets volume grow
    /// UP TO the cap, and we never retroactively set a cap below accrued volume.
    function setCap(uint256 seed, uint256 capSeed) external {
        uint256 cap;
        if (seed % 3 == 0) {
            cap = 0; // unlimited
        } else {
            uint256 lockVol = bridge.dailyVolume(address(token));
            uint256 releaseVol = bridge.releaseVolume(address(token));
            uint256 vol = lockVol > releaseVol ? lockVol : releaseVol;
            uint256 minCap = vol == 0 ? 1 : vol;
            cap = bound(capSeed, minCap, minCap + 1e27);
        }
        vm.prank(owner);
        bridge.setDailyCap(address(token), cap);
    }

    /// Advance time, sometimes past the 1-day window, to exercise the cap's lazy
    /// daily-volume reset inside lockTokens. Moves no tokens, so solvency is
    /// unaffected.
    function warpForward(uint256 secondsSeed) external {
        uint256 dt = bound(secondsSeed, 1, 3 days);
        vm.warp(block.timestamp + dt);
    }

    function togglePause(uint256 seed) external {
        vm.prank(owner);
        if (seed % 2 == 0) {
            try bridge.pause() {} catch {}
        } else {
            try bridge.unpause() {} catch {}
        }
    }
}

contract MultXBridgeInvariant is Test {
    MultXBridge internal bridge;
    MockERC20 internal token;
    BridgeHandler internal handler;

    uint256 internal validatorCount;
    uint256 internal sigsRequired = 2;

    function setUp() public {
        // 3 validators with known keys, sorted ASC by derived address.
        uint256[] memory raw = new uint256[](3);
        raw[0] = 0xA11CE;
        raw[1] = 0xB0B;
        raw[2] = 0xC0FFEE;
        uint256[] memory pks = _sortByAddr(raw);
        validatorCount = pks.length;

        address[] memory vals = new address[](3);
        for (uint256 i = 0; i < 3; i++) vals[i] = vm.addr(pks[i]);

        token = new MockERC20("Litho", "LITHO", 18);
        bridge = new MultXBridge(vals, sigsRequired);
        bridge.addSupportedToken(address(token));

        handler = new BridgeHandler(bridge, token, address(this), pks, sigsRequired);
        // bridge owner is this test contract (deployer); the handler pranks it for admin ops.
        token.transferOwnership(address(handler)); // so the handler can mint tokens to lock

        // Only fuzz through the handler.
        targetContract(address(handler));
    }

    // Core solvency: the bridge's escrow balance always equals locked minus released.
    function invariant_solvency() public view {
        assertEq(
            token.balanceOf(address(bridge)),
            handler.totalLocked() - handler.totalReleased(),
            "escrow != locked - released"
        );
    }

    // You can never release more than was ever locked.
    function invariant_releaseNeverExceedsLock() public view {
        assertLe(handler.totalReleased(), handler.totalLocked(), "released > locked");
    }

    // nonce increments by exactly one per successful lock, and only on lock.
    function invariant_nonceEqualsLockSuccesses() public view {
        assertEq(bridge.nonce(), handler.lockSuccesses(), "nonce != successful locks");
    }

    // A processed (sourceChain, sourceNonce) can never release a second time.
    function invariant_noDoubleRelease() public view {
        assertEq(handler.doubleReleaseCount(), 0, "replay of a processed nonce succeeded");
    }

    // Per-token daily volume never exceeds a set (non-zero) daily cap.
    function invariant_dailyVolumeWithinCap() public view {
        uint256 cap = bridge.dailyCap(address(token));
        if (cap > 0) {
            assertLe(bridge.dailyVolume(address(token)), cap, "dailyVolume > dailyCap");
            assertLe(bridge.releaseVolume(address(token)), cap, "releaseVolume > dailyCap");
        }
    }

    // Validator-set threshold stays well-formed.
    function invariant_signaturesRequiredWellFormed() public view {
        uint256 req = bridge.signaturesRequired();
        assertGt(req, 0, "sigsRequired == 0");
        assertLe(req, bridge.getValidatorCount(), "sigsRequired > validators");
    }

    function _sortByAddr(uint256[] memory keys) internal view returns (uint256[] memory) {
        for (uint256 i = 0; i < keys.length; i++) {
            for (uint256 j = i + 1; j < keys.length; j++) {
                if (vm.addr(keys[j]) < vm.addr(keys[i])) {
                    (keys[i], keys[j]) = (keys[j], keys[i]);
                }
            }
        }
        return keys;
    }
}
