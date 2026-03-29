# ADR-003: Promotion Gates — Makalu Testnet

## Status
**Accepted**

## Date
2026-03-06

## Context

Lithosphere Makalu testnet runs on EC2 + Docker Compose (not K8s/ArgoCD). This document defines the **actual** promotion flow and deployment gates in use today, replacing the aspirational K8s-based flow in [ADR-001](001-environment-strategy.md).

---

## Promotion Flow

```
LOCAL                  TESTNET (Makalu)              MAINNET
docker compose up  -->  push to main            -->  workflow_dispatch
                        deploy-simple.yaml           deploy.yaml (SLSA)
                        auto-deploy via SSH           manual trigger + approval
```

---

## Gate Definitions

### Gate 1: Local -> Testnet

| Criterion | Enforced By | Blocking? |
|-----------|-------------|-----------|
| CI passes (lint, build) | `ci.yaml` status check | Yes |
| Gitleaks secret scan | `ci.yaml` | Yes |
| CODEOWNERS review | GitHub branch protection | Yes (1 approval) |
| Code merged to `main` | GitHub PR merge | Yes |

**Trigger:** Push/merge to `main` branch.
**Pipeline:** `.github/workflows/deploy-simple.yaml` — SSH via bastion to EC2, `docker compose up -d --build --remove-orphans`.

### Gate 2: Testnet -> Mainnet

| Criterion | Enforced By | Blocking? |
|-----------|-------------|-----------|
| All Gate 1 criteria | CI + branch protection | Yes |
| Cosign image signing | `deploy.yaml` | Yes |
| SLSA provenance (Level 2) | `deploy.yaml` | Yes |
| SBOM generated | `release.yaml` (anchore/sbom-action) | Yes |
| Manual trigger | `workflow_dispatch` | Yes |
| Health check post-deploy | SSH health check in pipeline | Yes |

**Trigger:** Manual `workflow_dispatch` on `deploy.yaml`.
**Pipeline:** `.github/workflows/deploy.yaml` — full pipeline with SLSA verification, image tagging, SSH deploy.

---

## Deployment Windows

Inherited from [security-baselines.md](../governance/security-baselines.md) section 3.2:

| Environment | Allowed Days | Allowed Hours (UTC) |
|-------------|--------------|---------------------|
| Testnet (Makalu) | Any | Any |
| Mainnet | Tue-Thu | 14:00-16:00 |

**Freeze Periods:**
- No mainnet deployments during major chain events
- Minimum 48h between mainnet deployments
- Holiday freeze: Dec 20 - Jan 5

---

## Rollback Procedure

### Testnet

1. SSH to indexer via bastion:
   ```bash
   ssh -o ProxyJump="ec2-user@44.218.142.100" ec2-user@10.0.10.16
   ```
2. Roll back to previous commit:
   ```bash
   cd /opt/lithosphere/Makalu
   git log --oneline -5          # identify target commit
   git checkout <previous-sha>
   sudo docker compose up -d --build --remove-orphans
   ```
3. Verify health:
   ```bash
   curl -s http://localhost:4000/health
   curl -s http://localhost:3000
   ```

### Mainnet

Same procedure, but requires:
- Notification to on-call (minimum)
- Post-incident review within 24h
- Update to `deploy.yaml` run log

---

## Resolved Gaps

| Gap | Resolution |
|-----|------------|
| No automated rollback on health failure | Both `deploy-simple.yaml` and `deploy.yaml` have rollback jobs; rollback snapshots saved before each deploy |
| No blue/green or canary deploy | `Makalu/scripts/blue-green-deploy.sh` provides blue/green for Docker Compose |
| No formal staging environment | `promote.yaml` supports testnet->staging->mainnet promotion flow |
| No GitHub Environment protection rules | `promote.yaml` uses GitHub Environment approval gates for mainnet |

---

## References

- [ADR-001: Environment Strategy](001-environment-strategy.md) — aspirational 4-env model
- [ADR-002: Tech Stack BOM](002-tech-stack.md)
- [Security Baselines](../governance/security-baselines.md) — RACI, deployment windows, freeze periods
- [Promotion Playbook](../../../../docs/guides/promotion-playbook.md) — SOPs for promotion and rollback
- [deploy-simple.yaml](../../../.github/workflows/deploy-simple.yaml) — testnet CD
- [deploy.yaml](../../../.github/workflows/deploy.yaml) — mainnet CD with SLSA
- [promote.yaml](../../../.github/workflows/promote.yaml) — environment promotion with approval gates
