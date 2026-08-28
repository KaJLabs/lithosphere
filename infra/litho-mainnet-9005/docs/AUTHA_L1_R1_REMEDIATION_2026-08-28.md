# LITHO L1 Autha R1 remediation

Date: 2026-08-28

Release identity: `litho-l1-v20.0.0-r1`

Reviewed-source baseline: `1b2464f5233c290086ad66fc607564918bc29170`

Status: remediation candidate; not approved for deployment

## Release identity

- Evmos: `v20.0.0` / `eca13ef2521a9ef13c32e80b1b147230bdb155b5`
- Cosmos SDK: `v0.50.14` / `f2e6295b662fdb27ea33da1296c29588ccdaab42`
- CometBFT: `v0.38.22`
- IBC-Go: `v8.7.0`
- Cosmos SDK Math: `v1.4.0`
- Go: `go1.22.12 linux/amd64`
- Candidate binary SHA-256: `1f03146df86391715b86971b14b6074580b7efd06d7265a1725d90e426b8efbc`
- CycloneDX 1.6 SBOM SHA-256: `bad4144b0ee2f147db06eb76e5b9683af30c15631e107e2d4058df4b6648418d`

The immutable release manifest records the exact dependency, source, patch, Go,
and SBOM-generator identities. The release build rejects command-line and
security-pin environment overrides.

## Finding closure map

### AUTHA-L1-H01 — final source was modified after testing

Remediated. The release sequence is now:

`patch -> rebrand -> gofmt -> freeze source diffs -> test final tree -> build -> verify frozen tree -> inspect dependencies -> generate SBOM -> hash evidence`

The build records the final Evmos and Cosmos SDK diffs before testing. It checks
those frozen diff hashes again after the behavioral tests and after compilation.
Any source mutation stops the build.

### AUTHA-L1-H02 — missing transaction/precompile exploit regression

Remediated in the candidate. The adapted regression executes signed contract
transactions through the real staking precompile path and covers internal
transfers to the bonded-token module account:

- before the precompile operation;
- after the precompile operation;
- both before and after;
- after the operation with matching `msg.value`.

Every attempted exploit fails, while contract balance, bonded-pool balance,
delegation, and total supply remain unchanged. Keeper-level module-account,
blocked-address, unchanged-balance, decrease, and ordinary-EOA cases remain in
the focused suite. The transaction regression is adapted from the upstream
Cosmos EVM security regression for the pinned Evmos v20 test harness.

The generated log is `test-statedb-precompile-integration.log`. No live-network
transaction was submitted by this build. Any additional Makalu execution using
this exact candidate requires a separately approved test window.

### AUTHA-L1-H03 — binary and SBOM were absent

Remediated in the R1 delivery. It includes the exact 135 MiB Linux AMD64
candidate binary, CycloneDX 1.6 SBOM, `go version -m` module evidence, complete
resolved module graph, final `go.mod` and `go.sum`, build-environment record,
patch hashes, final source diffs, behavioral-test logs, and a checksum manifest
covering every evidence artifact.

### AUTHA-L1-M01 — security pins were overridable

Remediated. Release pins are immutable constants in
`bin/lithod-release-manifest.sh`. Release mode rejects corresponding environment
variables and command-line overrides. Every patch is authenticated before use.

### AUTHA-L1-M02 — SBOM generation failed open

Remediated. There is no skip option. The build downloads the pinned official
CycloneDX generator over HTTPS, verifies its archive SHA-256, requires successful
SBOM generation, validates the CycloneDX format/version, and hashes the output.
Any failure stops publication.

### AUTHA-L1-M03 — prior approval was not evidenced

Process exception recorded. No release-specific pre-deployment Autha approval
record was supplied with the audit inputs, so this package does not claim that
one existed. The R1 candidate must not be deployed to Makalu, Kamet, or mainnet
until Autha accepts this exact release identity and KaJ Labs records the required
deployment approval. Future release gates must retain the approval record before
production rollout.

### AUTHA-L1-L01 — repository tests were primarily structural

Remediated. Structural policy tests were expanded and retained, but the release
gate now also runs the final Go tree's behavioral supply, inflation, genesis,
ERC-20, IBC, StateDB keeper, and signed precompile transaction suites. All passed
before the candidate binary was produced.

## Evidence results

- Repository policy tests: 6 passed
- Native supply-cap suite: passed
- Permanent inflation-disable suite: passed
- Exact genesis-supply suite: passed
- ERC-20 and IBC keeper suites: passed
- StateDB keeper guard suite: passed
- Signed staking-precompile transaction regression: passed
- Embedded dependency gate: passed
- Mandatory CycloneDX generation and validation: passed
- Frozen-source verification before and after compilation: passed

`bin/lithod.evidence/SHA256SUMS.txt` is the authoritative checksum manifest for
the generated evidence directory.

## Acceptance boundary

This is an R1 remediation submission, not an Autha acceptance statement and not
a deployment authorization. Keep the current networks unchanged until Autha
closes the findings against this exact binary and SBOM and KaJ Labs approves any
required controlled Makalu regression and subsequent rollout.
