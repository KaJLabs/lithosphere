# Autha Phase 1 R2 focused re-review handoff

**Candidate identity:** set to the exact merge commit after this remediation PR
is merged

**Source PR:** set to the merged remediation PR

**Evidence run:** set to the successful default-branch run for that exact merge
commit

## Requested decision

Please perform a focused re-review of the two Low findings in the Phase 1 R1
report and the durable release-key observation:

1. verify that the documented NIST fixture-manifest SHA-256 matches the shipped
   manifest and is enforced by the package verifier;
2. independently recompute the mean, median and nearest-rank p95 from the 32
   retained samples for each profile and operation on x86-64 and ARM64; and
3. verify the organizational primary fingerprint against the independently
   published anchor in `SECURITY.md`.

## Safety boundary

This candidate remains isolated in `toolchain/crates/litho-pq-conformance`. It
is disabled, non-consensus and not linked to validators, transactions,
LithoVM, the Lithic compiler, RPC, explorer or any deployed network path.

This handoff does **not** request Phase 2 approval, Makalu activation, a
quantum-safe explorer badge, consensus/gas constants, mainnet approval or a
production deployment. The `slh-dsa 0.2.0-rc.5` activation gate also remains
open.

## Reproduction

From the exact candidate checkout:

```text
cd toolchain
cargo test -p litho-pq-conformance --release --locked
cargo run -p litho-pq-conformance --release --locked -- self-test
cargo run -p litho-pq-conformance --release --locked -- benchmark
```

The benchmark JSON is schema 2. It retains all 32 samples for key generation,
signing and verification and reports the deterministic statistics derived from
those samples.

Build and verify the deterministic archive with the candidate's
`build_phase1_autha_package.py` and `verify_phase1_autha_package.py`. The exact
merge commit and successful default-branch run ID must match both architecture
artifacts. The outer archive must then receive the approved detached
organizational signature before transmission to Autha. No private signing
material is stored in this repository or used by CI.
