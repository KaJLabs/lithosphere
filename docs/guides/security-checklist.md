# Security Checklist

This document provides pre-deployment and post-deployment checklists, secret management policies, key rotation schedules, and vulnerability scanning requirements for the Lithosphere network.

## Pre-Deployment Checklist

Complete all items before deploying to any environment:

- [ ] All CI checks passing
- [ ] Security scan (Slither) clean -- no high or critical findings
- [ ] Container scan (Trivy) clean -- no critical CVEs
- [ ] SBOM generated and attested
- [ ] Artifacts signed with Cosign
- [ ] Provenance attestation generated
- [ ] Required approvals obtained
- [ ] Deployment window confirmed
- [ ] Rollback plan documented
- [ ] On-call team notified

## Post-Deployment Checklist

Verify all items after deployment completes:

- [ ] Health checks passing
- [ ] Metrics baseline established
- [ ] Error rates normal
- [ ] Latency within SLA
- [ ] Smoke tests passing
- [ ] Status page updated
- [ ] Change record closed

## Secret Management Policies

All secrets must be stored in **Vault**. The following practices are strictly prohibited:

- Hardcoding secrets in source code
- Storing secrets in plaintext configuration files
- Committing secrets to version control
- Sharing secrets via unencrypted channels (email, chat)
- Using the same secret across multiple environments
- Storing secrets in environment variables on CI runners without masking

## Key Rotation Schedule

| Secret Type    | Rotation Frequency | Method        |
|----------------|-------------------|---------------|
| API Keys       | 90 days           | Manual        |
| DB Credentials | 90 days           | Manual        |
| TLS Certificates | 90 days         | Automated     |
| Signing Keys   | Annual            | Manual        |
| SSH Keys       | Annual            | Manual        |
| Root CA        | 5 years           | Manual        |

## Emergency Rotation SLA

When a secret is compromised, follow these response timelines:

| Severity | Revoke Within | Deploy New Within |
|----------|---------------|-------------------|
| Critical | 1 hour        | 4 hours           |
| High     | 4 hours       | 24 hours          |
| Medium   | 24 hours      | 72 hours          |

## Vulnerability Scanning Schedule

| Scan Type          | Tool       | Frequency     |
|--------------------|------------|---------------|
| Container CVE      | Trivy      | Every build   |
| Dependency Audit   | Dependabot | Daily         |
| Smart Contract     | Slither    | Every build   |
| Infrastructure as Code | Checkov | Every build  |
| Runtime Security   | Falco      | Continuous    |
