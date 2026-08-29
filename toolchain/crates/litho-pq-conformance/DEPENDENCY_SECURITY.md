# Dependency security record

## Selected implementations

| Crate | Exact version | Role | Activation status |
| --- | --- | --- | --- |
| `ml-dsa` | `0.1.1` | FIPS 204 ML-DSA-65 and ML-DSA-87 candidate | Disabled |
| `slh-dsa` | `0.2.0-rc.5` | FIPS 205 SLH-DSA-SHAKE-256s recovery candidate | Disabled |
| `sha2` | `0.11.0` | SHA-256 commitments for reduced KAT evidence | Test/evidence only |

The dependency graph is frozen by `toolchain/Cargo.lock`, including registry
checksums. CI uses `--locked` for every build, lint, test, and measurement.

## ML-DSA advisory floor

RustCrypto advisory GHSA-5x2r-hc65-25f9 / CVE-2026-24850 affected versions up
to `0.1.0-rc.3`; the patched floor is `0.1.0-rc.4`. This candidate pins
`0.1.1` and includes a repeated-hint negative regression that requires strict,
canonical decoding.

## SLH-DSA release status

`slh-dsa 0.2.0-rc.5` is a release candidate, not a stable release. It is
acceptable for a disabled Phase 1 candidate and KAT/performance evaluation, but
it is not by itself evidence for activation. A later implementation-freeze
review must either approve this exact version or move to a reviewed stable
version under explicit change control and repeat all evidence.

## Automated evidence

The x86-64 CI job generates:

- a CycloneDX JSON SBOM using pinned `cargo-cyclonedx 0.5.9`;
- a JSON RustSec report using pinned `cargo-audit 0.22.2`;
- compiler, platform, benchmark and process-memory evidence.

An empty RustSec report is a point-in-time check, not a substitute for Autha's
implementation review or cryptographic validation.

