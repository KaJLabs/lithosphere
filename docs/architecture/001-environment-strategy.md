# ADR-001: Environment Strategy

## Status
**Accepted**

## Date
2024-12-13

## Context

The Lithosphere L1 Blockchain Developer Infrastructure requires a multi-environment deployment strategy that supports the full software development lifecycle. The environments must accommodate:

1. **Developer Experience**: Fast feedback loops during local development
2. **Continuous Integration**: Ephemeral environments for automated testing
3. **Quality Assurance**: Persistent testnet for integration and UAT
4. **Production Safety**: Controlled mainnet deployments with approval gates

The platform follows a GitOps model with ArgoCD, requiring clear environment separation and promotion paths.

---

## Decision

We adopt a **4-environment strategy** aligned with blockchain development best practices:

| Environment | Purpose | Persistence | Cluster |
|-------------|---------|-------------|---------|
| **Local** | Developer workstation | Ephemeral | Docker Compose |
| **Devnet** | CI/CD automated testing | Ephemeral | Kubernetes (shared) |
| **Staging** | Persistent testnet / UAT | Persistent | Kubernetes (dedicated) |
| **Mainnet** | Production | Persistent | Kubernetes (dedicated) |

---

## Environment Specifications

### 1. Local Environment

| Attribute | Specification |
|-----------|---------------|
| **Purpose** | Individual developer testing and debugging |
| **Trigger** | Manual (`docker-compose up`) |
| **Data Source** | Mock data OR Chain fork (configurable via `FORK_URL`) |
| **Deployment Strategy** | Manual, instant hot-reload |
| **Key Tools** | Docker Compose, Hardhat Network, Local PostgreSQL |
| **Node Type** | Hardhat Node with forking capability |
| **Lifecycle** | Created/destroyed per developer session |

**Configuration:**
```yaml
# docker/local/.env
FORK_URL=https://mainnet.lithosphere.network/rpc
FORK_BLOCK_NUMBER=latest
LOCAL_RPC_PORT=8545
POSTGRES_HOST=localhost
REDIS_HOST=localhost
```

**Capabilities:**
- Hot-reload for API and frontend changes
- Contract deployment with instant mining
- Mainnet state forking for realistic testing
- Full observability stack (Grafana, Prometheus)

---

### 2. Devnet Environment (CI/CD Ephemeral)

| Attribute | Specification |
|-----------|---------------|
| **Purpose** | Automated CI/CD testing, PR validation |
| **Trigger** | Push to `main` branch, Pull Request opened |
| **Data Source** | Seeded test fixtures (deterministic) |
| **Deployment Strategy** | Automatic, no approval required |
| **Key Tools** | Kubernetes, Helm, GitHub Actions |
| **Node Type** | Ephemeral Lithosphere testnet node |
| **Lifecycle** | Created per CI run, destroyed after 24h max |

**GitOps Configuration:**
```yaml
# clusters/devnet/argocd/application.yaml
spec:
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
  source:
    targetRevision: main
```

**CI/CD Pipeline:**
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Git Push   │───▶│  CI Build   │───▶│  Sign/Push  │───▶│ ArgoCD Sync │
│  (main)     │    │  & Test     │    │  Artifacts  │    │  (Devnet)   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

**Resource Limits:**
- Max 2 concurrent devnet deployments
- Auto-cleanup after 24 hours
- Shared Kubernetes namespace: `lithosphere-devnet`

---

### 3. Staging Environment (Persistent Testnet)

| Attribute | Specification |
|-----------|---------------|
| **Purpose** | Integration testing, UAT, partner testing |
| **Trigger** | Merge to `release/*` branch |
| **Data Source** | Testnet chain with historical data preserved |
| **Deployment Strategy** | Automatic with smoke tests |
| **Key Tools** | Kubernetes, Helm, ArgoCD, Vault |
| **Node Type** | Full Lithosphere testnet node (persistent) |
| **Lifecycle** | Persistent, data retained across deployments |

**GitOps Configuration:**
```yaml
# clusters/staging/argocd/application.yaml
spec:
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
  source:
    targetRevision: release/*
```

**Promotion Criteria:**
- [ ] All CI tests passing
- [ ] Security scan (Slither) clean
- [ ] Docker image signed
- [ ] Contract artifacts verified

**Data Management:**
- PostgreSQL: Daily snapshots retained 30 days
- Chain data: Weekly snapshots retained 90 days
- Indexer: Continuous sync with testnet

---

### 4. Mainnet Environment (Production)

| Attribute | Specification |
|-----------|---------------|
| **Purpose** | Production deployment, real user traffic |
| **Trigger** | Git tag matching `v*.*.*` (semantic versioning) |
| **Data Source** | Production Lithosphere mainnet |
| **Deployment Strategy** | **Manual approval required** (CODEOWNERS) |
| **Key Tools** | Kubernetes, Helm, ArgoCD, Vault, PagerDuty |
| **Node Type** | Full Lithosphere mainnet node (HA) |
| **Lifecycle** | Persistent, zero-downtime deployments |

**GitOps Configuration:**
```yaml
# clusters/mainnet/argocd/application.yaml
spec:
  syncPolicy:
    # NO automated sync - requires manual approval
  source:
    targetRevision: HEAD  # Tags only
```

**Deployment Gate:**
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Git Tag    │───▶│  CI Build   │───▶│  Approval   │───▶│ ArgoCD Sync │
│  (v1.2.3)   │    │  & Sign     │    │  (CODEOWNER)│    │  (Mainnet)  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

**High Availability:**
- Multi-AZ deployment (3 availability zones)
- Database: RDS Multi-AZ with read replicas
- Node: 3 Lithosphere nodes behind load balancer
- CDN: CloudFront for frontend assets

**Rollback Strategy:**
- ArgoCD automatic rollback on health check failure
- Manual rollback via `argocd app rollback`
- Database: Point-in-time recovery (PITR) enabled

---

## Environment Comparison Matrix

| Aspect | Local | Devnet | Staging | Mainnet |
|--------|-------|--------|---------|---------|
| **Trigger** | Manual | Push/PR | Release branch | Git tag `v*` |
| **Approval** | None | None | None | CODEOWNER |
| **Persistence** | Session | 24h max | Permanent | Permanent |
| **Data** | Mock/Fork | Fixtures | Testnet | Production |
| **HA** | No | No | Yes | Yes (Multi-AZ) |
| **Secrets** | `.env` file | GitHub Secrets | Vault | Vault |
| **Monitoring** | Local Grafana | Shared Grafana | Dedicated | Dedicated + PagerDuty |
| **Cost** | $0 | Low | Medium | High |

---

## Promotion Flow

```
        ┌─────────────────────────────────────────────────────────┐
        │                  PROMOTION PIPELINE                      │
        └─────────────────────────────────────────────────────────┘
        
        ┌─────────┐         ┌─────────┐         ┌─────────┐
        │  LOCAL  │────────▶│ DEVNET  │────────▶│ STAGING │
        │         │  push   │         │  merge  │         │
        └─────────┘         └─────────┘         └─────────┘
                                                     │
                                                     │ git tag
                                                     ▼
                                                ┌─────────┐
                                                │ MAINNET │
                                                │         │
                                                └─────────┘
```

---

## Consequences

### Positive
- Clear separation of concerns between environments
- Automated testing in devnet reduces manual QA burden
- Persistent staging enables long-running integration tests
- Mainnet approval gates prevent accidental deployments
- GitOps provides full audit trail of all changes

### Negative
- Increased infrastructure cost (multiple clusters)
- Complexity in managing environment-specific configurations
- Potential for environment drift if not properly monitored

### Mitigations
- Use Kustomize overlays to minimize configuration drift
- Implement automated environment parity checks
- Regular cost reviews and right-sizing

---

## References

- [12-Factor App: Dev/Prod Parity](https://12factor.net/dev-prod-parity)
- [GitOps Principles](https://opengitops.dev/)
- [ArgoCD Best Practices](https://argo-cd.readthedocs.io/en/stable/user-guide/best_practices/)
- [SLSA Supply Chain Security](https://slsa.dev/)
