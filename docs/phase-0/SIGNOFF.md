# Phase 0 — Discovery & Architecture: Sign-Off Checklist

> Scope: Makalu testnet (EC2 + Docker Compose). Full K8s/Vault posture is documented as aspirational roadmap.

---

## Deliverable Checklist

| # | Deliverable | Status | Location |
|---|-------------|--------|----------|
| 1 | Languages/toolchains inventory | Done | `Makalu/docs/architecture/002-tech-stack.md` (ADR-002) |
| 2 | Environment matrix | Done | `Makalu/docs/architecture/001-environment-strategy.md` (ADR-001) |
| 3 | Core technology stack / BOM | Done | `Makalu/docs/architecture/002-tech-stack.md` (ADR-002) |
| 4 | Architecture diagrams | Done | `docs/diagrams/` (14 diagrams) |
| 5 | RACI matrix | Done | `Makalu/docs/governance/security-baselines.md` section 3 |
| 6 | Security baselines (aspirational) | Done | `Makalu/docs/governance/security-baselines.md` sections 1-2 |
| 7 | Security baselines (Makalu-enforced) | Done | `Makalu/docs/architecture/004-security-baselines-makalu.md` (ADR-004) |
| 8 | Promotion gates | Done | `Makalu/docs/architecture/003-promotion-gates.md` (ADR-003) |
| 9 | CODEOWNERS (access control) | Done | `.github/CODEOWNERS` |
| 10 | Cosign image signing | Done | `.github/workflows/deploy.yaml`, `.github/workflows/publish-images.yaml` |
| 11 | SBOM generation (SPDX) | Done | `.github/workflows/release.yaml` (anchore/sbom-action) |
| 12 | SLSA target documented | Done | `Makalu/docs/governance/security-baselines.md` section 1 |

---

## Work Scope PDF Alignment

| PDF Requirement | Covered By |
|-----------------|------------|
| Reference architecture diagram | Deliverable 4 (14 diagrams in `docs/diagrams/`) |
| Environment matrix | Deliverable 2 (ADR-001) |
| RACI | Deliverable 5 (security-baselines.md section 3) |
| Bill of materials | Deliverable 3 (ADR-002) |
| Security baselines (SLSA, SBOM, signing, RBAC) | Deliverables 6, 7, 10, 11, 12 |
| Stakeholder sign-off on promotion gates | Deliverable 8 (ADR-003) + this checklist |

---

## Scope Notes

- **Makalu testnet only** — production is EC2 + Docker Compose, not K8s
- K8s/ArgoCD/Vault configurations exist in the repo but are **unused boilerplate** for this phase
- ADR-004 documents what is enforced vs. aspirational — no false compliance claims
- Gaps (Trivy, signed commits, mTLS) are tracked in Phase 10 of `docs/PHASE_TRACKER.md`

---

## Sign-Off

| Name | Role | Date | Signature |
|------|------|------|-----------|
| | Infrastructure Lead | | |
| | Security Lead | | |
| | Engineering Manager | | |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-06 | Infrastructure Team | Initial Phase 0 sign-off |
