# LITHO L1 Autha R1.1 focused evidence handoff

Date: 2026-08-28

Release identity: `litho-l1-v20.0.0-r1`

Evidence-correction identity: `litho-l1-v20.0.0-r1.1`

Candidate binary SHA-256:
`1f03146df86391715b86971b14b6074580b7efd06d7265a1725d90e426b8efbc`

The executable, final source diffs, security dependencies and StateDB/fixed
supply implementation are unchanged from the R1 candidate reviewed by Autha.
R1.1 changes only release evidence, SBOM identity normalization and archive
construction.

## Focused finding closure

### AUTHA-L1-R1-M01: self-contained release inputs

The archive contains all six immutable patches plus the exact R1 build script,
dependency verifier, SBOM generator and release manifest. It also contains the
R1.1 SBOM normalizer, package builder and package verifier. The file
`evidence/release-inputs.sha256` authenticates every one of those inputs, and
the root `SHA256SUMS.txt` covers every archive payload.

### AUTHA-L1-R1-M02: canonical patched Cosmos SDK SBOM identity

Both SBOMs are retained:

- `evidence/lithod.cdx.raw.json` is the original generator output;
- `evidence/lithod.cdx.normalized.json` identifies the component as
  `github.com/cosmos/cosmos-sdk v0.50.14`.

The normalized component records upstream commit
`f2e6295b662fdb27ea33da1296c29588ccdaab42`, final LITHO SDK diff SHA-256
`8e11c9d752266d552bb651d6d1ac752cdf3c1ef91976e2551793f11731832480`,
and `litho:component-modification=compatibility-patched`.

### AUTHA-L1-R1-M03: controlled network regression

Prepared but not represented as complete. The included Makalu runbook fixes the
binary identity, four exploit orderings, ordinary-operation control, required
before/after state, validator health and evidence fields. Execution requires a
KaJ Labs-approved window and authorized Makalu transaction signer. The final
R1.1 package must be rebuilt after that evidence is added.

### AUTHA-L1-R1-L01: Linux-native package

The deterministic ZIP uses only POSIX `/` member paths and records the candidate
binary and executable tooling as Unix mode `0755`. The package verifier checks
path safety, mode, binary identity, tooling identity, manifest coverage and
normalized SBOM semantics. Final evidence must include a clean-Linux `unzip`
and direct `./bin/lithod version` transcript.

## Authorization boundary

This package supports Autha's focused R1.1 evidence review. It does not approve
Kamet or mainnet deployment. Only the controlled Makalu regression authorized
by Autha's R1 conditional pass may occur, and only after KaJ Labs records the
change window. Any executable change creates a new release identity.
