# LITHO PQ Conformance Harness

This crate is an isolated Phase 1 implementation candidate for the profiles
frozen by the Autha-approved R9 design:

- `0x0101` ML-DSA-65, context `LITHO-PQ-AUTH-V1`
- `0x0102` ML-DSA-87, context `LITHO-PQ-AUTH-V1`
- `0x0201` SLH-DSA-SHAKE-256s, context `LITHO-PQ-RECOVERY-V1`

It is deliberately **not** linked into consensus, LithoVM, the compiler,
network services, or the explorer. It cannot activate a profile or authorize a
transaction. Its purpose is to freeze dependencies, execute official NIST
key-generation, signature-generation and signature-verification known-answer
checks, exercise strict decoders and negative cases, and collect initial
measurements on x86-64 and ARM64.

```text
cargo run -p litho-pq-conformance --locked -- profiles
cargo run -p litho-pq-conformance --release --locked -- self-test
cargo run -p litho-pq-conformance --release --locked -- benchmark
```

The NIST vectors are reduced to the exact selected binary inputs and expected
outputs. They are never printed by the tests. A deterministic extraction
script, full-source hashes, per-file hashes, and pinned upstream commit make
the selection independently reproducible. Provenance is recorded in
`NIST_VECTOR_PROVENANCE.md`.
