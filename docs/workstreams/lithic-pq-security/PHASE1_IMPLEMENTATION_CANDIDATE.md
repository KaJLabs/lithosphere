# Phase 1 R2 implementation candidate

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
- reduced NIST ACVP key-generation, signature-generation and
  signature-verification KATs with a pinned upstream commit and per-file
  commitments;
- exact-length, fail-closed public-key and signature decoding;
- context-bound sign/verify self-tests covering wrong context, message,
  signature and key rejection for all profiles;
- N-1/N+1 key and signature length rejection for all profiles;
- explicit repeated-hint regressions for ML-DSA-65 and ML-DSA-87 routed through
  the public verifier;
- an exact 64-byte `SigningRootV1` verification boundary for later Phase 2 use;
- x86-64 and ARM64 CI measurements with 32 retained trials per operation and
  independently recomputable mean, median and nearest-rank p95 statistics;
- process-memory evidence and a reproducible CycloneDX SBOM.

The compiler is pinned to Rust `1.96.0`; workflow actions are pinned to full
commit SHAs. Evidence records its exact GitHub commit, run, attempt, runner
architecture, runner OS and runner image.

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
benchmark samples and derived statistics are measurements, not approved gas or
consensus constants.
