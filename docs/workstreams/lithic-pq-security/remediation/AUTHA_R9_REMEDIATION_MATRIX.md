# Autha Phase 0 R9 Focused Remediation Matrix

Status: design-freeze review candidate, 2026-08-28. Autha's R8 review closed
all R7 Critical and High findings. This matrix covers only the residual gap and
two observations recorded in the R8 report.

| R8 item | R9 disposition | Evidence |
|---|---|---|
| Freeze gap: dispatcher table lacked independent cross-language verification | Closed. An independently authored JavaScript dispatcher covers all 20 immutable rows, fail-closed mismatch behavior, governance inner/outer binding, permissionless-activation exclusion, registry bindings and provenance bindings. | `reference/authorization_dispatch_v1_independent.mjs`; both dispatcher commands in `vectors/README.md`. |
| Observation: `MAX_PENDING_HORIZON` lacked a wall-clock interpretation | Closed for design freeze. The immutable 100,000-block bound is approximately 14h35m at Makalu's documented nominal 525ms interval. The text distinguishes this operational estimate from consensus and requires network-specific change-control review before activation. | `R9_FREEZE_EVIDENCE.md` section 2. |
| Observation: dependency evidence predates an assembled implementation | Correctly deferred. Phase 0 remains a design-only candidate. SBOM and dependency evidence MUST be refreshed against the eventual assembled implementation candidate. | `PACKAGE_SCOPE.md`, `R9_FREEZE_EVIDENCE.md`, existing dependency-evidence classification. |

R9 requests design-freeze approval only. It does not claim implementation
acceptance, cryptographic KAT completion, performance acceptance, Makalu
activation, explorer-badge approval, or any mainnet change.
