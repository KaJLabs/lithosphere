# Coherent Source and Build Baseline

**Audit baseline ID:** `LITHO-PQ-PHASE0-R1-20260825`
**KaJLabs/Lithosphere commit:** `41172e2d44b9f038b32633746ef6e8f1a90a3dfb`

All remediation claims use the single KaJLabs commit above. The earlier gap assessment at `6ab0dcb...` is retained only as historical discovery evidence and is explicitly superseded.

## Current L1 assembly inputs

The repository builds `lithod` from:

- Evmos `v20.0.0`, commit `eca13ef2521a9ef13c32e80b1b147230bdb155b5`;
- Cosmos SDK `v0.50.14`, commit `f2e6295b662fdb27ea33da1296c29588ccdaab42`;
- CometBFT `v0.38.22`;
- IBC-Go `v8.7.0`;
- cosmossdk.io/math `v1.4.0`;
- the KaJ build script and patch blobs below.

| File | Git blob ID at baseline |
|---|---|
| `infra/litho-mainnet-9005/bin/build-lithod.sh` | `60495de1c83a4b660870d582e67eafb9d427800b` |
| `patches/cosmos-sdk-v0.50.14-evmos-compat.patch` | `60de21c214eb584e41a47248ed072f68aae323be` |
| `patches/evmos-v20-litho-fixed-supply.patch` | `236977a3a5ae077264983bde7945674b9e57fd99` |
| `patches/evmos-v20-litho-integration-tests.patch` | `ec9e65d873f97ca1d85ddd1bac5b719a8e97ba47` |
| `verify-lithod-security-dependencies.sh` | `e888c432328aba0e7532984aaf093e6598c7b213` |

Git blob IDs identify repository content but do not replace the release candidate's SHA3-512/SHA-256 evidence.

## Required implementation-candidate evidence

Before Autha implementation review, generate from a clean isolated builder:

- exact assembled source archive after patches;
- source archive SHA-256 and SHA3-512;
- every upstream repository URL, tag, commit, and fetched-object verification;
- complete `go list -m all`, `go mod graph`, `go mod verify`, and license/SBOM output;
- patch SHA-256/SHA3-512 and application order;
- compiler/Go/OS/container image digests;
- reproducible binary hashes from at least two independent builders;
- `go version -m` output and binary module evidence;
- exact Makalu genesis identity and activation feature flags;
- reference-code and vector digests.

No mutable tag, branch name, package registry `latest`, or unpinned operating-system crypto provider may enter the candidate.

## Design-candidate dependency evidence

`evidence/baseline/` contains the patched/tidied `go.mod`, `go.sum`, complete 11,410-line module graph, 2,382 unique graph nodes, Go version, verification result, and hashes. This closes the Phase 0 requirement for one coherent dependency-tree baseline. A compiled binary/SBOM remains an implementation-candidate deliverable rather than a design-review claim.

## Repository boundary

Consensus/LithoVM/Lithic implementation belongs in public KaJLabs/Lithosphere. Production keys, node origin details, recovery custody, issuer private keys, and operational contacts remain in the private KaJ infrastructure repository or approved secret manager and are excluded from audit archives.
