# Autha Phase 1 R1 remediation matrix

**Scope:** disabled, isolated, non-consensus Makalu candidate. No activation is
requested or authorized.

| Finding | R1 closure evidence |
| --- | --- |
| H01 — candidate/evidence mismatch | Builder requires the full merge commit and exact run ID, validates both architecture artifacts against them, and packages source from that Git object. |
| H02 — missing independent sigGen/sigVer KATs | Reduced official NIST ACVP sigGen and sigVer cases cover all three profiles; upstream source and fixture hashes are frozen in the manifest. |
| M01 — incomplete negative matrix | All profiles reject wrong context, altered message, altered signature, wrong key and N-1/N+1 encodings. |
| M02 — repeated-hint coverage | ML-DSA-65 and ML-DSA-87 malformed repeated hints are both passed through the public verifier and fail closed. |
| M03 — floating build inputs | Rust `1.96.0`, checkout `v4.2.2`, and upload-artifact `v4.6.2` are pinned; evidence records runner image and run identity. |
| M04 — package tooling absent from candidate | Builder and verifier are candidate source, parameterized, deterministic, path-safe and checksum-complete. |
| M05 — release-candidate dependency | `slh-dsa 0.2.0-rc.5` remains explicitly disabled and remains an activation blocker pending exact-version approval or reviewed stable replacement. |
| L01 — partial registry assertions | Tests compare the complete three-row frozen registry and live encoded lengths. |
| L02 — package not self-contained | Archive includes a minimal one-crate Cargo workspace, lockfile, pinned toolchain, source and all fixtures. |

The detached organizational signature and final Autha decision are external
release gates. A successful R1 CI run does not activate a profile or authorize
Phase 2.
