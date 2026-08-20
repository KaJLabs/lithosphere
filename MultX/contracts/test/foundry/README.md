# Foundry property tests (MultX bridge)

Property-based / invariant coverage that complements the Hardhat unit suite, for
the audit submission. Hardhat stays the primary runner; Foundry adds fuzzing.

## Setup

Foundry is not vendored. Install once:

```bash
curl -L https://foundry.paradigm.xyz | bash && foundryup   # installs forge/cast/anvil
git clone --depth 1 https://github.com/foundry-rs/forge-std lib/forge-std
```

`@openzeppelin` resolves to the existing `node_modules/@openzeppelin` (see
`foundry.toml` remappings). `forge build` / `forge test` only compile the 6
contracts in `contracts/` (all solc 0.8.24) — the DEX/DNNS trees are not in this
sources dir, so there's no multi-version conflict.

## Run

```bash
forge test --match-path "test/foundry/*.t.sol" -vv
```

## CI

Runs in the `foundry-invariants` job of
`.github/workflows/ci-multx.yaml`. The path-filtered workflow installs the npm
dependencies, vendors `forge-std` (pinned `v1.16.1`), installs Foundry (pinned
`1.7.1`), and runs both invariant suites independently of the Hardhat job.

## What's covered — `MultXBridgeInvariant.t.sol`

A bounded `BridgeHandler` drives the source bridge through legitimate operations
(lock/escrow, release with valid N-of-M validator signatures and fresh nonces,
**replay of already-processed nonces**, daily-cap changes, **time advances**, and
pause toggles) under fuzzing. Invariants asserted after every call sequence
(256 runs × 64 depth = 16 384 calls each):

| Invariant | Property |
|---|---|
| `invariant_solvency` | escrow balance == total locked − total released |
| `invariant_releaseNeverExceedsLock` | cumulative released ≤ cumulative locked |
| `invariant_nonceEqualsLockSuccesses` | `nonce` increments by exactly 1 per successful lock, only on lock |
| `invariant_noDoubleRelease` | a processed `(sourceChain, sourceNonce)` can never release twice (replay guard) |
| `invariant_dailyVolumeWithinCap` | per-token lock and release volumes are each ≤ `dailyCap` whenever a non-zero cap is set |
| `invariant_signaturesRequiredWellFormed` | `0 < signaturesRequired ≤ validators.length` |

The handler signs releases with known validator keys (`vm.sign`) sorted ascending
by address to satisfy the contract's ordered-signer rule, so the release path is
genuinely exercised (not just reverting). `replay()` re-submits the most recent
successful release with identical valid signatures — the contract must reject it
on the `processedNonces` check. `setCap()` clamps new caps ≥ the current on-chain
daily volume (so the cap invariant stays sound across cap changes), and
`warpForward()` advances time past the 1-day window to exercise the cap's lazy
volume reset inside `lockTokens`.

### Non-vacuity (mutation-validated 2026-07-14)

Both added invariants were confirmed to catch real regressions by mutation:
removing the contract's `require(!processedNonces[...])` makes
`invariant_noDoubleRelease` fail (`1 != 0`); removing the
`require(dailyVolume + amount <= dailyCap)` gate makes
`invariant_dailyVolumeWithinCap` fail. Run under **forge 1.7.1**; suite green
(6/6) against the unmutated contracts.

## What's covered — `MultXBridgeDestInvariant.t.sol`

The **destination** bridge is mint/burn, not escrow: `releaseTokens` MINTS wrapped
tokens on an attested LITHO mainnet lock (forward), `lockTokens` BURNS them to bridge back
(reverse). A `DestBridgeHandler` drives it against the real `WrappedLEP100` token
(which binds the bridge as its immutable minter), as the sole mint recipient and sole
burner, so the accounting is exact:

| Invariant | Property |
|---|---|
| `invariant_supplyEqualsMintedMinusBurned` | wrapped `totalSupply` == total minted − total burned (no unbacked wrapped tokens) |
| `invariant_burnNeverExceedsMint` | cumulative burned ≤ cumulative minted |
| `invariant_noDoubleRelease` | a processed `(sourceChain, sourceNonce)` can never mint twice |
| `invariant_nonceEqualsBurnSuccesses` | `nonce` increments by exactly 1 per successful lock/burn, only on lock |
| `invariant_dailyVolumeWithinCap` | per-token burn and mint volumes are each ≤ `dailyCap` whenever a non-zero cap is set |
| `invariant_signaturesRequiredWellFormed` | `0 < signaturesRequired ≤ validators.length` |

Non-vacuity mutation-validated: minting `amount + 1` in `WrappedLEP100.bridgeMint`
makes `invariant_supplyEqualsMintedMinusBurned` fail (off by one); removing the
dest replay guard makes `invariant_noDoubleRelease` fail. Both suites green
together — **12 invariants, 0 failures** under forge 1.7.1.
