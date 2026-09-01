# Autha Phase 1 R2 remediation matrix

**Scope:** disabled, isolated, non-consensus Makalu candidate. No activation is
requested or authorized.

| Phase 1 R1 finding or observation | R2 closure evidence |
| --- | --- |
| Low — stale NIST fixture-manifest commitment | `NIST_VECTOR_PROVENANCE.md` records the independently confirmed SHA-256 `756599cf7726563346a3875f42e194e40825176cee323d54622cbbe2c305c87d`. The package verifier enforces it against both packaged copies. |
| Low — single-sample benchmarks | Each architecture records 32 complete trials per profile and operation after one warm-up. Evidence retains every sample and reports mean, median, nearest-rank p95, minimum and maximum in microseconds. Unit tests freeze the statistics rules. |
| Observation — release fingerprint lacked a durable independent anchor | `SECURITY.md` publishes the organizational primary and signing-subkey fingerprints and the primary-key expiry date. |
| Observation — broad bit-flipped-signature error assertion | Retained deliberately: the safety invariant is rejection, while malformed signatures may fail as either encoding or cryptographic verification errors across the three frozen implementations. |
| Activation gate — `slh-dsa 0.2.0-rc.5` | Remains explicitly open. No activation-track evidence or Phase 2 constant may rely on it without reviewed stable replacement or explicit exact-version approval. |

The outer detached organizational signature and Autha's final R2 disposition
remain external gates. Passing CI does not activate a profile or authorize
Phase 2, Makalu deployment, explorer claims, or any mainnet change.
