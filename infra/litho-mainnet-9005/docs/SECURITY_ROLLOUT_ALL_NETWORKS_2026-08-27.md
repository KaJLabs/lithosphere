# LITHO all-network L1 security rollout — 2026-08-27

Status: **complete**

The Cosmos EVM StateDB security candidate was deployed to every active LITHO
L1 process on Makalu, Kamet, and mainnet. The rollout used the same immutable
binary that passed focused regression tests, a clean pinned build, an isolated
mainnet-state replay, and Makalu validation.

## Release identity

- Source remediation: PR #132, merge commit
  `272ea76c5fa0be2b2e66b55c9968678e0c431314`
- Candidate binary SHA-256:
  `358feb6fc95fbdc4c6f992510e8d0329d3511a17b623e55c61e67b8c6dfff26f`
- Cosmos EVM StateDB backport source:
  `b8d5ed7b126b32f676e820b3aa6b6f00f465a613`
- CometBFT: `v0.38.22`
- Cosmos SDK compatibility target: `v0.50.14`

Every service uses a network-specific binary path and a root-owned SHA-256
pre-start gate. The shared legacy binary was not overwritten.

## Network results

| Network | EVM chain ID | Cosmos chain ID | Active processes | Result |
|---|---:|---|---:|---|
| Makalu | `700777` | `lithosphere_700777-2` | 6 | Passed |
| Kamet | `900523` | `lithosphere_900523-2` | 6 | Passed |
| Mainnet | `9005` | `lithosphere_9005-1` | 3 | Passed |

Final public checks confirmed that all networks were advancing, reported
`catching_up: false`, and returned their expected EVM and Cosmos identities.

## Kamet rollout evidence

Kamet sentries were upgraded first. Validators were then upgraded in ascending
voting-power order. The two lower-power validator restarts retained quorum. The
highest-power validator restart produced the expected brief pause at height
`16941050`; block production resumed immediately at height `16941051`.

All six Kamet processes returned the same validation block hash
`C8227F664F46BA442DEAE262C2C0A7FC0D40BA20A211119C8203B04F387A1EFE`
and header app hash
`F9AE6DE7C5AC321684EA2D6E6EEEA31913831AB798F9461DF5F094964A3D10E9`
at height `16941051`. A later commit at height `16941100` contained valid
signatures from all three bonded validators.

The Kamet supply remained
`999641093216999999985501324ulitho` before and after the rollout. No rollout
transaction was submitted. Every process reported zero service restarts after
activation, all approved watchdog timers were restored, and no error-priority
service journal entries were present.

## Cross-network final checks

| Network | Observed supply (`ulitho`) | Advancing | Synced |
|---|---:|---|---|
| Makalu | `999998499709400000000000000` | Yes | Yes |
| Kamet | `999641093216999999985501324` | Yes | Yes |
| Mainnet | `1000000000000000000000000000` | Yes | Yes |

Root-only before/after evidence, rollback unit files, signing-state records, and
checksum manifests are retained in timestamped incident directories on the
applicable nodes. Validator private keys and node private keys were not copied
into the evidence packages.

This L1 security rollout does not authorize activation of any separately gated
application feature. MultX, Bridge, Swap, and Faucet retain their existing
network-specific activation controls and audit requirements.
