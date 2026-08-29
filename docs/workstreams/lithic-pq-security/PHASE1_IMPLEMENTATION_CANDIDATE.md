# Phase 1 implementation candidate

**Status:** disabled, non-consensus, Makalu-only candidate

## Implemented boundary

The isolated `litho-pq-conformance` crate pins and exercises the three R9
signature profiles without linking them to a validator, node, transaction,
LithoVM, compiler, RPC, or explorer path.

The candidate provides:

- exact R9 profile IDs, names, contexts, public-key lengths and signature
  lengths;
- RustCrypto ML-DSA `0.1.1`, which contains the fix for
  CVE-2026-24850/GHSA-5x2r-hc65-25f9;
- RustCrypto SLH-DSA `0.2.0-rc.5` for the exact SHAKE-256s profile;
- reduced NIST ACVP key-generation KATs with pinned upstream commit and expected
  output commitments;
- exact-length, fail-closed public-key and signature decoding;
- context-bound sign/verify self-tests and tamper rejection;
- an explicit regression for repeated ML-DSA hint indices;
- x86-64 and ARM64 CI measurements, process-memory evidence, and a reproducible
  CycloneDX SBOM.

## Safety boundary

This is not a runtime integration and cannot activate post-quantum signatures.
No Makalu or mainnet state changes are authorized by this candidate. No explorer
badge may be displayed from this evidence.

Phase 2 may begin only after this exact Phase 1 implementation and its generated
evidence are reviewed. Consensus integration, gas constants, activation,
explorer claims, and mainnet remain separate later gates.

## Verification

```text
cd toolchain
cargo test -p litho-pq-conformance --release --locked
cargo run -p litho-pq-conformance --release --locked -- self-test
cargo run -p litho-pq-conformance --release --locked -- benchmark
```

CI runs the same commands on GitHub-hosted Linux x86-64 and ARM64 runners. The
benchmark numbers are measurements, not approved gas or consensus constants.

