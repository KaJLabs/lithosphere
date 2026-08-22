# LITHO L1 security candidate build record — 2026-08-22

This record captures the first clean-room build of the candidate described in `L1_SECURITY_UPGRADE_CANDIDATE_2026-08-22.md`. It is build evidence, not production approval.

## Environment

- Build date: 2026-08-22
- Platform: Linux amd64 under WSL
- Go: `go1.22.12 linux/amd64`
- Evmos source: `v20.0.0` at `eca13ef2521a9ef13c32e80b1b147230bdb155b5`
- Cosmos SDK source: `v0.50.14` at `f2e6295b662fdb27ea33da1296c29588ccdaab42`
- SBOM: skipped for this local verification build; mandatory for the release build

## Results

| Gate | Result |
|---|---|
| Go module integrity | PASS — `all modules verified` |
| Supply-cap post handler | PASS |
| Inflation mint restriction | PASS |
| Exact genesis supply validation | PASS |
| ERC-20 keeper suite | PASS |
| IBC transfer keeper suite | PASS |
| Binary execution (`version`) | PASS — `20.0.0` |
| Embedded dependency verification | PASS |
| Repository pin/control tests | PASS — 3 tests |

## Candidate checksums

- Linux amd64 binary: `b0af461abae004de747c4b01bab04dfb22493829d47db87b0dedb1c2194fe5cd`
- Cosmos SDK compatibility patch: `6ee2863bced57121109f100df4c45a0664185e12e48824f9e34346035e0f3659`
- Fixed-supply patch: `b0da920cc5d437703ab17bde3c423f2239cf4c84aec0181a1f0b2676fff7d248`
- Integration-test genesis patch: `f3610594ecdbdb4a1ca509ea9518b99635c67b193d486252aea504fa75915a76`

The local binary and generated evidence files are intentionally not committed to Git. The release pipeline must rebuild from the reviewed commit, generate an SBOM, publish immutable artifacts, and record its own checksums. A release checksum may be accepted only if its source commit, Go version, dependency manifest, and patch hashes match the approved candidate.

## Embedded dependency evidence

- `cosmossdk.io/math v1.4.0`
- `github.com/cometbft/cometbft v0.38.22`
- `github.com/cosmos/cosmos-sdk v0.50.14` with the pinned local compatibility patch
- `github.com/cosmos/ibc-go/v8 v8.7.0`

## Remaining gates

1. Independent Autha source and fix review.
2. Release build with SBOM and immutable publication.
3. Production-state-clone replay and smoke testing.
4. Exact UTC maintenance-window approval and named responders.
5. Backup/rollback evidence revalidation.
