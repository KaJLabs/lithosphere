# Security Baselines & Governance

## Document Information

| Attribute | Value |
|-----------|-------|
| **Status** | Approved |
| **Version** | 1.0 |
| **Last Updated** | 2024-12-13 |
| **Owner** | Infrastructure Security Team |
| **Review Cycle** | Quarterly |

---

## 1. SLSA Compliance Target

### Overview

The Lithosphere Developer Infrastructure targets **SLSA Level 3** compliance for all production artifacts. SLSA (Supply-chain Levels for Software Artifacts) provides a security framework for ensuring the integrity of software artifacts.

### SLSA Level Requirements

| Level | Requirement | Our Implementation |
|-------|-------------|-------------------|
| **Level 1** | Documentation of build process | GitHub Actions workflows documented |
| **Level 2** | Tamper-resistant build service | GitHub-hosted runners, audit logs |
| **Level 3** | Hardened build platform | Isolated builds, signed provenance |
| **Level 4** | Two-person review | Future target (not Phase 0) |

---

### SLSA Level 3 Implementation

#### 1.1 Provenance Generation

All build artifacts MUST include SLSA provenance attestations.

```yaml
# .github/workflows/build.yaml
- name: Generate SLSA Provenance
  uses: slsa-framework/slsa-github-generator/.github/workflows/generator_container_slsa3.yml@v1.9.0
  with:
    image: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
    digest: ${{ steps.build.outputs.digest }}
```

**Provenance Contents:**
- Build timestamp
- Builder identity (GitHub Actions)
- Source repository and commit
- Build instructions (workflow file)
- Dependencies (locked versions)

#### 1.2 Artifact Signing

All container images and contract artifacts MUST be signed using Sigstore Cosign.

```bash
# Image signing (automated in CI)
cosign sign --yes \
  --key cosign.key \
  --annotations "repo=$GITHUB_REPOSITORY" \
  --annotations "sha=$GITHUB_SHA" \
  ${REGISTRY}/${IMAGE_NAME}@${DIGEST}

# Contract artifact signing
cosign sign-blob --yes \
  --key cosign.key \
  --output-signature contracts.sig \
  artifacts/contracts.tar.gz
```

**Verification (on deployment):**
```bash
cosign verify \
  --key cosign.pub \
  --annotations "repo=lithosphere/infrastructure" \
  ${REGISTRY}/${IMAGE_NAME}@${DIGEST}
```

#### 1.3 Build Isolation

| Control | Implementation |
|---------|----------------|
| Ephemeral Runners | GitHub-hosted runners (fresh VM per job) |
| Minimal Permissions | `permissions: {}` default, explicit grants only |
| Network Isolation | No egress except approved registries |
| Hermetic Builds | Locked dependencies, no network fetches |

#### 1.4 SBOM Generation

Software Bill of Materials generated for all artifacts:

```yaml
- name: Generate SBOM
  uses: anchore/sbom-action@v0
  with:
    image: ${{ env.IMAGE_NAME }}
    format: spdx-json
    output-file: sbom.spdx.json

- name: Attest SBOM
  uses: actions/attest-sbom@v1
  with:
    subject-name: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
    sbom-path: sbom.spdx.json
```

---

## 2. Security Policies

### 2.1 Secret Management

| Policy | Requirement |
|--------|-------------|
| Storage | All secrets in HashiCorp Vault |
| Rotation | API keys: 90 days, Signing keys: Annual |
| Access | RBAC with least-privilege |
| Audit | All access logged and monitored |
| Encryption | At-rest (AES-256) and in-transit (TLS 1.3) |

**Prohibited Practices:**
- Secrets in source code
- Secrets in environment variables (use Vault injection)
- Shared credentials across environments
- Long-lived tokens without rotation

### 2.2 Access Control

| Resource | Access Model |
|----------|--------------|
| Git Repository | GitHub Teams + Branch Protection |
| Kubernetes | RBAC with namespace isolation |
| AWS | IAM Roles with OIDC (no static keys) |
| Vault | Policy-based with AppRole auth |

**Branch Protection Rules (mainnet):**
- Require 2 approving reviews
- Require signed commits
- Require status checks to pass
- Require linear history
- Restrict force pushes
- Restrict deletions

### 2.3 Network Security

| Layer | Control |
|-------|---------|
| Ingress | WAF + DDoS protection (CloudFront/Shield) |
| Cluster | Network Policies (deny-all default) |
| Service | mTLS via Istio service mesh |
| Egress | Explicit allowlist only |

### 2.4 Vulnerability Management

| Scan Type | Tool | Frequency | Blocking Threshold |
|-----------|------|-----------|-------------------|
| Container CVE | Trivy | Every build | CRITICAL, HIGH |
| Dependency | Dependabot | Daily | CRITICAL |
| Smart Contract | Slither | Every build | Medium+ |
| IaC | Checkov | Every build | High |
| Runtime | Falco | Continuous | Anomaly detection |

---

## 3. RACI Matrix

### Overview

RACI defines roles and responsibilities:
- **R**esponsible: Does the work
- **A**ccountable: Final decision authority (only one per activity)
- **C**onsulted: Provides input before decision
- **I**nformed: Notified after decision

### 3.1 Smart Contract Upgrade

| Activity | Dev Team | Security | DevOps | Product | Legal | Exec |
|----------|----------|----------|--------|---------|-------|------|
| Identify upgrade need | R | C | I | A | I | I |
| Develop upgrade code | R | C | I | C | I | I |
| Security audit | C | R | I | I | I | I |
| Audit remediation | R | A | I | C | I | I |
| Testnet deployment | R | C | R | I | I | I |
| QA sign-off | C | C | I | R | I | A |
| Legal review | I | C | I | C | R | A |
| Mainnet deployment | I | C | R | C | I | A |
| Post-deploy monitoring | R | R | R | I | I | I |

**Escalation Path:**
```
Developer → Security Lead → Engineering Manager → CTO → CEO
```

**Approval Requirements:**
- Testnet: 1 Security + 1 DevOps approval
- Mainnet: 2 Security + 1 Legal + 1 Executive approval

---

### 3.2 Mainnet Deployment

| Activity | Dev Team | Security | DevOps | SRE | Product | Exec |
|----------|----------|----------|--------|-----|---------|------|
| Code complete | R | I | I | I | A | I |
| Code review | R | C | C | I | I | I |
| CI/CD pipeline pass | I | I | R | C | I | I |
| Security scan pass | I | R | C | I | I | I |
| Staging validation | C | C | R | R | A | I |
| Change request | I | C | R | C | C | A |
| Deployment window | I | I | C | R | C | A |
| Execute deployment | I | I | R | R | I | I |
| Health check | I | I | C | R | I | I |
| Rollback decision | C | C | R | A | C | I |
| Post-deploy review | R | R | R | R | A | I |

**Deployment Windows:**
| Environment | Allowed Days | Allowed Hours (UTC) |
|-------------|--------------|---------------------|
| Devnet | Any | Any |
| Staging | Mon-Thu | 09:00-17:00 |
| Mainnet | Tue-Thu | 14:00-16:00 |

**Freeze Periods:**
- No mainnet deployments during major events
- Minimum 48h between mainnet deployments
- Holiday freeze: Dec 20 - Jan 5

---

### 3.3 Key Rotation

| Activity | Dev Team | Security | DevOps | SRE | Compliance | Exec |
|----------|----------|----------|--------|-----|------------|------|
| Schedule rotation | I | A | R | C | C | I |
| Generate new keys | I | R | C | I | I | I |
| Update Vault | I | C | R | I | I | I |
| Deploy new secrets | I | C | R | R | I | I |
| Verify systems | C | C | R | R | I | I |
| Revoke old keys | I | A | R | C | I | I |
| Audit trail update | I | C | R | I | R | I |
| Compliance sign-off | I | C | I | I | R | A |

**Key Rotation Schedule:**

| Key Type | Rotation Frequency | Lead Time | Backup Required |
|----------|-------------------|-----------|-----------------|
| API Keys | 90 days | 7 days | Yes |
| Database Credentials | 90 days | 7 days | Yes |
| TLS Certificates | 90 days (auto) | Auto | Yes |
| Signing Keys (Cosign) | Annual | 30 days | Yes (HSM) |
| SSH Keys | Annual | 14 days | Yes |
| Root CA | 5 years | 90 days | Yes (offline) |

**Emergency Rotation Trigger:**
- Suspected key compromise
- Employee with key access departs
- Security incident
- Compliance requirement

**Emergency Rotation SLA:**
| Severity | Key Revocation | New Key Deployment |
|----------|----------------|--------------------|
| Critical | 1 hour | 4 hours |
| High | 4 hours | 24 hours |
| Medium | 24 hours | 72 hours |

---

## 4. Incident Response

### Severity Levels

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| P1 | Critical - Production down | 15 min | Mainnet RPC unavailable |
| P2 | High - Major feature broken | 1 hour | Transactions failing |
| P3 | Medium - Minor impact | 4 hours | Dashboard slow |
| P4 | Low - Minimal impact | 24 hours | Typo in docs |

### Escalation Matrix

```
P1: On-call SRE → SRE Lead (15m) → CTO (30m) → CEO (1h)
P2: On-call SRE → SRE Lead (1h) → Engineering Manager (2h)
P3: On-call SRE → Engineering Manager (next business day)
P4: Ticket queue → Sprint planning
```

---

## 5. Compliance Checklist

### Pre-Deployment Checklist

- [ ] All CI checks passing
- [ ] Security scan (Slither) clean - no high/critical
- [ ] Container scan (Trivy) clean - no critical CVEs
- [ ] SBOM generated and attested
- [ ] Artifacts signed with Cosign
- [ ] Provenance attestation generated
- [ ] Required approvals obtained
- [ ] Deployment window confirmed
- [ ] Rollback plan documented
- [ ] On-call notified

### Post-Deployment Checklist

- [ ] Health checks passing
- [ ] Metrics baseline established
- [ ] Error rates normal
- [ ] Latency within SLA
- [ ] Smoke tests passing
- [ ] Status page updated
- [ ] Change record closed

---

## 6. Document Control

### Change History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-12-13 | Infrastructure Team | Initial release |

### Review Schedule

| Review Type | Frequency | Participants |
|-------------|-----------|--------------|
| RACI Review | Quarterly | All stakeholders |
| Security Policy | Semi-annual | Security + Compliance |
| Full Document | Annual | All stakeholders + Legal |

---

## References

- [SLSA Specification v1.0](https://slsa.dev/spec/v1.0/)
- [Sigstore Cosign](https://docs.sigstore.dev/cosign/overview/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [SOC 2 Type II Requirements](https://www.aicpa.org/soc2)
- [CIS Kubernetes Benchmark](https://www.cisecurity.org/benchmark/kubernetes)
