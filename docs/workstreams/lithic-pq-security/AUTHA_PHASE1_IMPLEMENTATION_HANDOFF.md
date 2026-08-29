# Autha Phase 1 implementation-review handoff

**Candidate identity:** `849e3d78492ebd4136f9bbaf24208284d4218841`

**Source PR:** <https://github.com/KaJLabs/Lithosphere/pull/137>

**Evidence run:** <https://github.com/KaJLabs/Lithosphere/actions/runs/33253023378>

## Review request

Please review the isolated Phase 1 post-quantum conformance implementation
against the Phase 0 R9 design freeze. The requested decision is limited to:

1. implementation conformance for the three frozen R9 profile identifiers,
   algorithms, contexts, public-key lengths and signature lengths;
2. fail-closed decoding, context separation and tamper/replay-relevant negative
   tests;
3. NIST ACVP key-generation vector provenance and the reduced KAT selection;
4. the ML-DSA repeated-hint regression for
   CVE-2026-24850/GHSA-5x2r-hc65-25f9;
5. pinned dependency, CycloneDX SBOM and RustSec evidence; and
6. x86-64 and ARM64 performance and memory observations.

Please state whether this exact candidate is accepted for Phase 1 and list any
finding that must be closed before Phase 2 begins.

## Candidate boundary

The implementation is deliberately isolated in
`toolchain/crates/litho-pq-conformance`. It is disabled, non-consensus and not
linked to validators, transactions, LithoVM, the Lithic compiler, RPC, explorer
or any deployed network path.

This handoff does **not** request Makalu activation, a quantum-safe explorer
badge, consensus/gas constants, mainnet approval or a production deployment.
Those remain separate fail-closed gates.

## Evidence identity

The candidate merge commit is the immutable review identity. The package
builder reads candidate source directly from that Git object rather than from
the packaging branch.

The GitHub run completed successfully on Linux x86-64 and Linux ARM64 and
produced:

- platform and compiler identity;
- release benchmark JSON;
- `/usr/bin/time -v` process-memory evidence;
- a CycloneDX JSON SBOM; and
- a RustSec JSON audit with 45 locked dependencies and zero reported
  vulnerabilities.

The recorded measurements are observations only. They are not approved gas,
consensus or admission-control constants.

## Reproduction

From the candidate checkout:

```text
cd toolchain
cargo test -p litho-pq-conformance --release --locked
cargo run -p litho-pq-conformance --release --locked -- self-test
cargo run -p litho-pq-conformance --release --locked -- benchmark
```

Build the deterministic Autha package with:

```text
python docs/workstreams/lithic-pq-security/remediation/reference/build_phase1_autha_package.py \
  --evidence-root <downloaded-GitHub-artifacts> \
  --review-doc <Autha-R9-design-freeze-review.docx> \
  --output <output.zip>
```

Verify it independently with:

```text
python docs/workstreams/lithic-pq-security/remediation/reference/verify_phase1_autha_package.py \
  <output.zip>
```
