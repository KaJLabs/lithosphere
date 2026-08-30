# Autha Phase 1 R1 implementation-review handoff

**Candidate identity:** set to the exact merge commit after this remediation PR
is merged

**Source PR:** <https://github.com/KaJLabs/Lithosphere/pull/138>

**Evidence run:** set to the successful default-branch run for that exact merge
commit

## Review request

Please review the isolated Phase 1 post-quantum conformance implementation
against the Phase 0 R9 design freeze. The requested decision is limited to:

1. implementation conformance for the three frozen R9 profile identifiers,
   algorithms, contexts, public-key lengths and signature lengths;
2. fail-closed decoding, context separation and tamper/replay-relevant negative
   tests;
3. NIST ACVP key-generation, signature-generation and
   signature-verification provenance and reduced KAT selection;
4. the ML-DSA-65 and ML-DSA-87 repeated-hint regressions for
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
builder reads source directly from that Git object, requires both architecture
artifacts to declare the same `GITHUB_SHA` and `GITHUB_RUN_ID`, and refuses a
mismatch. The included minimal workspace rebuilds and tests without the rest
of the repository.

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
  --candidate <exact-merge-commit> \
  --run-id <exact-default-branch-run> \
  --source-pr https://github.com/KaJLabs/Lithosphere/pull/138 \
  --evidence-root <downloaded-GitHub-artifacts> \
  --review-doc <prior-review.docx> \
  --output <output.zip>
```

Verify it independently with:

```text
python docs/workstreams/lithic-pq-security/remediation/reference/verify_phase1_autha_package.py \
  <output.zip> --candidate <exact-merge-commit> --run-id <exact-run-id>
```

The outer archive must then receive the approved detached organizational
signature before it is sent to Autha. No signature key is stored in this
repository or used by CI.
