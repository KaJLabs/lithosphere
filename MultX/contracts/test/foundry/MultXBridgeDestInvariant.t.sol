// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {MultXBridgeDest} from "../../contracts/MultXBridgeDest.sol";
import {WrappedLEP100} from "../../contracts/WrappedLEP100.sol";

/// Bounded handler that drives the DESTINATION bridge through legitimate
/// operations. The dest bridge is mint/burn (not escrow):
///   - releaseTokens MINTS wrapped tokens to a user on a valid N-of-M quorum
///     attesting a LITHO mainnet lock (forward direction),
///   - lockTokens BURNS the caller's wrapped tokens to bridge back (reverse).
/// The handler is the sole mint recipient AND sole burner, so the wrapped
/// token's total supply must equal (total minted − total burned) at all times.
contract DestBridgeHandler is Test {
    MultXBridgeDest public bridge;
    WrappedLEP100 public wrapped;
    address public owner;

    uint256[] internal pks;       // validator private keys, sorted by address ASC
    uint256 internal sigsRequired;

    // Ghosts
    uint256 public totalMinted;         // Σ successful releases (mint)
    uint256 public totalBurned;         // Σ successful locks (burn)
    uint256 public burnSuccesses;       // successful lockTokens calls
    uint256 public releaseNonceSeq;     // always-fresh source nonces
    uint256 public doubleReleaseCount;  // replays that wrongly minted again (must stay 0)

    // Last successful release, retained so replay() can re-submit the exact
    // (already-processed) mint and prove it is rejected.
    bool internal lastReleaseExists;
    uint256 internal lastAmount;
    uint256 internal lastSourceNonce;
    bytes32 internal lastSourceTxHash;
    address internal lastUser;

    uint256 constant SOURCE_CHAIN = 9005; // LITHO mainnet (where the original lock happened)
    uint256 constant TARGET_CHAIN = 9005; // bridging back to LITHO (not block.chainid)

    constructor(
        MultXBridgeDest _bridge,
        WrappedLEP100 _wrapped,
        address _owner,
        uint256[] memory _sortedPks,
        uint256 _sigsRequired
    ) {
        bridge = _bridge;
        wrapped = _wrapped;
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
            abi.encodePacked(sourceTxHash, address(wrapped), user, amount, SOURCE_CHAIN, sourceNonce)
        );
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
    }

    /// Forward: mint wrapped to the handler on a fresh, fully-valid attestation.
    function release(uint256 amountSeed) external {
        uint256 amount = bound(amountSeed, 1, 1e27);
        releaseNonceSeq += 1;
        uint256 sourceNonce = releaseNonceSeq;
        bytes32 sourceTxHash = keccak256(abi.encodePacked("src", sourceNonce));
        address user = address(this); // handler holds the minted wrapped tokens

        bytes[] memory sigs = _signQuorum(_ethSigned(user, amount, sourceNonce, sourceTxHash));

        try bridge.releaseTokens(
            address(wrapped), user, amount, SOURCE_CHAIN, sourceNonce, sourceTxHash, sigs
        ) {
            totalMinted += amount;
            lastReleaseExists = true;
            lastAmount = amount;
            lastSourceNonce = sourceNonce;
            lastSourceTxHash = sourceTxHash;
            lastUser = user;
        } catch {}
    }

    /// Reverse: burn the handler's wrapped tokens to bridge back to LITHO.
    function lock(uint256 amountSeed) external {
        uint256 bal = wrapped.balanceOf(address(this));
        if (bal == 0) return;
        uint256 amount = bound(amountSeed, 1, bal);

        wrapped.approve(address(bridge), amount); // burnFrom needs allowance
        try bridge.lockTokens(address(wrapped), amount, TARGET_CHAIN) {
            totalBurned += amount;
            burnSuccesses += 1;
        } catch {}
    }

    /// Re-submit the most recent successful release with identical, fully-valid
    /// parameters + signatures. The (SOURCE_CHAIN, sourceNonce) pair is already
    /// processed, so this MUST revert — if it ever mints again, a double release
    /// occurred and `doubleReleaseCount` records the invariant breach.
    function replay(uint256) external {
        if (!lastReleaseExists) return;
        bytes[] memory sigs =
            _signQuorum(_ethSigned(lastUser, lastAmount, lastSourceNonce, lastSourceTxHash));
        try bridge.releaseTokens(
            address(wrapped), lastUser, lastAmount, SOURCE_CHAIN, lastSourceNonce, lastSourceTxHash, sigs
        ) {
            doubleReleaseCount += 1;
            totalMinted += lastAmount;
        } catch {}
    }

    /// Set the per-token daily cap. New caps are clamped to be >= the current
    /// on-chain daily (burn) volume (or 0 = unlimited), so `dailyVolume <=
    /// dailyCap` stays a sound global invariant.
    function setCap(uint256 seed, uint256 capSeed) external {
        uint256 cap;
        if (seed % 3 == 0) {
            cap = 0; // unlimited
        } else {
            uint256 vol = bridge.dailyVolume(address(wrapped));
            cap = bound(capSeed, vol, vol + 1e27);
        }
        vm.prank(owner);
        bridge.setDailyCap(address(wrapped), cap);
    }

    /// Advance time, sometimes past the 1-day window, to exercise the cap's lazy
    /// daily-volume reset inside lockTokens. Mints/burns no tokens.
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

contract MultXBridgeDestInvariant is Test {
    MultXBridgeDest internal bridge;
    WrappedLEP100 internal wrapped;
    DestBridgeHandler internal handler;

    uint256 internal sigsRequired = 2;

    function setUp() public {
        // 3 validators with known keys, sorted ASC by derived address.
        uint256[] memory raw = new uint256[](3);
        raw[0] = 0xA11CE;
        raw[1] = 0xB0B;
        raw[2] = 0xC0FFEE;
        uint256[] memory pks = _sortByAddr(raw);

        address[] memory vals = new address[](3);
        for (uint256 i = 0; i < 3; i++) vals[i] = vm.addr(pks[i]);

        bridge = new MultXBridgeDest(vals, sigsRequired);
        // Deploy the wrapped token granting BRIDGE_ROLE to the bridge, then
        // register it so the burn (lockTokens) path accepts it.
        wrapped = new WrappedLEP100("Wrapped LITHO", "wLITHO", 18, address(bridge), address(0x0AB1), 9005);
        bridge.addSupportedToken(address(wrapped));

        handler = new DestBridgeHandler(bridge, wrapped, address(this), pks, sigsRequired);
        targetContract(address(handler));
    }

    // Backing/solvency: wrapped supply is exactly what the bridge minted minus
    // burned — no wrapped tokens exist except via attested releases. The handler
    // is the sole mint recipient and sole burner, so this is exact.
    function invariant_supplyEqualsMintedMinusBurned() public view {
        assertEq(
            wrapped.totalSupply(),
            handler.totalMinted() - handler.totalBurned(),
            "supply != minted - burned"
        );
    }

    // You can never bridge back (burn) more than was ever minted.
    function invariant_burnNeverExceedsMint() public view {
        assertLe(handler.totalBurned(), handler.totalMinted(), "burned > minted");
    }

    // A processed (sourceChain, sourceNonce) can never mint a second time.
    function invariant_noDoubleRelease() public view {
        assertEq(handler.doubleReleaseCount(), 0, "replay of a processed nonce minted again");
    }

    // nonce increments by exactly one per successful lock (burn), and only on lock.
    function invariant_nonceEqualsBurnSuccesses() public view {
        assertEq(bridge.nonce(), handler.burnSuccesses(), "nonce != successful burns");
    }

    // Per-token daily (burn) volume never exceeds a set (non-zero) daily cap.
    function invariant_dailyVolumeWithinCap() public view {
        uint256 cap = bridge.dailyCap(address(wrapped));
        if (cap > 0) {
            assertLe(bridge.dailyVolume(address(wrapped)), cap, "dailyVolume > dailyCap");
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
