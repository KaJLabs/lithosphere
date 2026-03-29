# ADR-004: Security Baselines — Makalu Testnet (Enforced)

## Status
**Accepted**

## Date
2026-03-06

## Context

The canonical [Security Baselines & Governance](../governance/security-baselines.md) document describes an aspirational posture targeting K8s, Vault, Istio, and SLSA Level 3+. This addendum documents what is **actually enforced** on the Makalu testnet today (EC2 + Docker Compose deployment).

---

## Supply Chain Security

| Control | Status | Implementation |
|---------|--------|----------------|
| Image signing (Cosign) | Enforced | `deploy.yaml`, `publish-images.yaml` |
| SBOM generation (SPDX) | Enforced | `release.yaml` via anchore/sbom-action |
| SLSA provenance | Partial (Level 2) | GitHub-hosted runners, signed images, no hermetic build |
| Secret scanning | Enforced | Gitleaks in `ci.yaml` |
| Dependency scanning (Trivy/Snyk) | **Not implemented** | Gap — tracked in Phase 10 |
| License policy | **Not implemented** | Gap — tracked in Phase 10 |

**Effective SLSA Level: 2** (tamper-resistant build service + signed provenance, but not hermetic).

---

## Access Control

| Layer | Control | Implementation |
|-------|---------|----------------|
| GitHub repo | CODEOWNERS | `.github/CODEOWNERS` — PR reviews required |
| AWS credentials | OIDC federation | `aws-actions/configure-aws-credentials@v4` — no static keys |
| EC2 access | SSH via bastion | Bastion (44.218.142.100) + private key, no direct SSH to indexer |
| Secrets in CI | GitHub Secrets | Encrypted at rest, scoped to repo |
| Database | RDS IAM auth | Via AWS Secrets Manager (injected by OIDC in deploy pipeline) |

**No Vault, no K8s RBAC, no service mesh mTLS** — these are aspirational (see parent doc).

---

## Network Security

| Control | Status | Notes |
|---------|--------|-------|
| Bastion-only SSH | Enforced | No direct public SSH to indexer EC2 |
| Security groups | Enforced | AWS VPC SGs managed in litho-validator-infra |
| WAF / DDoS | **Not implemented** | No CloudFront/Shield on testnet |
| mTLS between services | **Not implemented** | Services communicate over Docker bridge network |
| Egress filtering | **Not implemented** | Default outbound allow |

---

## CI/CD Security

| Control | Status | Pipeline |
|---------|--------|----------|
| Branch protection (1 review) | Enforced | GitHub repo settings |
| CI must pass before merge | Enforced | Status checks on `main` |
| Gitleaks secret scan | Enforced | `ci.yaml` |
| Image signing before deploy | Enforced | `deploy.yaml` (Cosign) |
| Manual approval for mainnet | Enforced | `workflow_dispatch` gate |
| Signed commits required | **Not enforced** | Aspirational (security-baselines.md) |

---

## Monitoring & Incident Response

| Control | Status | Implementation |
|---------|--------|----------------|
| Health monitoring | Enforced | `health-monitoring.yaml` (cron every 5 min) |
| Prometheus metrics | Enforced | `:9090` (services), `:9091` (Prometheus server) |
| Grafana dashboards | Enforced | 7 dashboards on `:3001` |
| AlertManager | Configured | `lithosphere-alerts.yml` routing rules |
| PagerDuty integration | **Not implemented** | Aspirational |
| SIEM / audit trail | **Not implemented** | Aspirational |

---

## Gap Summary

| Gap | Risk | Mitigation | Target Phase |
|-----|------|------------|--------------|
| No container/dependency scanning | Medium | Manual review; add Trivy to CI | Phase 10 |
| No signed commits | Low | CODEOWNERS review compensates | Phase 10 |
| No mTLS between services | Low (private network) | Docker bridge isolation | Phase 10 |
| No WAF/DDoS protection | Low (testnet) | Nginx rate limiting on Sentry | Post-testnet |
| No SIEM integration | Low (testnet) | CloudWatch logs available | Phase 10 |

---

## References

- [Security Baselines & Governance](../governance/security-baselines.md) — aspirational K8s/Vault posture, RACI matrix
- [ADR-003: Promotion Gates](003-promotion-gates.md) — deployment flow and gates
- [CODEOWNERS](../../../.github/CODEOWNERS)
- [deploy.yaml](../../../.github/workflows/deploy.yaml) — SLSA pipeline
- [ci.yaml](../../../.github/workflows/ci.yaml) — Gitleaks, lint, build
