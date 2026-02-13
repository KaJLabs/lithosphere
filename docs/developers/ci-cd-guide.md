# CI/CD Guide

This guide describes the Lithosphere CI/CD pipeline, covering the 4-environment deployment strategy, GitHub Actions workflow structure, ArgoCD GitOps deployment, and the environment comparison matrix. It is derived from the architectural decisions documented in ADR-001 (Environment Strategy) and ADR-002 (Technology Stack).

---

## 4-Environment Strategy

Lithosphere uses a 4-environment strategy aligned with blockchain development best practices:

| Environment | Purpose | Persistence | Cluster | Trigger |
|-------------|---------|-------------|---------|---------|
| **Local** | Developer workstation testing and debugging | Ephemeral (per session) | Docker Compose | Manual (`docker-compose up`) |
| **Devnet** | CI/CD automated testing and PR validation | Ephemeral (24h max) | Kubernetes (shared) | Push to `main`, Pull Request opened |
| **Staging** | Persistent testnet, integration testing, UAT | Persistent | Kubernetes (dedicated) | Merge to `release/*` branch |
| **Mainnet** | Production deployment, real user traffic | Persistent | Kubernetes (dedicated) | Git tag `v*.*.*` + manual approval |

---

## Environment Details

### Local Environment

The local environment runs entirely on the developer's workstation using Docker Compose.

**Capabilities:**
- Hot-reload for API and frontend changes
- Contract deployment with instant mining via Hardhat Network
- Mainnet state forking for realistic testing (configurable via `FORK_URL`)
- Full observability stack (Grafana, Prometheus) available locally

**Configuration:**
```bash
# docker/local/.env
FORK_URL=https://mainnet.lithosphere.network/rpc
FORK_BLOCK_NUMBER=latest
LOCAL_RPC_PORT=8545
POSTGRES_HOST=localhost
REDIS_HOST=localhost
```

**Quick start:**
```bash
# Start all core services
docker compose up -d

# Start with monitoring stack
docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml up -d
```

### Devnet Environment

The devnet is an ephemeral environment created automatically during CI runs.

- Seeded with deterministic test fixtures.
- No approval required for deployment.
- Auto-cleanup after 24 hours.
- Shared Kubernetes namespace: `lithosphere-devnet`.
- Maximum 2 concurrent devnet deployments.

**ArgoCD Configuration:**
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

### Staging Environment

The staging environment is a persistent testnet used for integration testing, UAT, and partner testing.

- Chain data is preserved across deployments.
- Automatic deployment with smoke tests on merge to `release/*` branches.
- PostgreSQL: Daily snapshots retained 30 days.
- Chain data: Weekly snapshots retained 90 days.
- Indexer: Continuous sync with testnet.

**Promotion criteria to reach staging:**
- All CI tests passing
- Security scan (Slither) clean
- Docker image signed
- Contract artifacts verified

### Mainnet Environment

The mainnet environment is the production deployment with the highest security requirements.

- Triggered only by a Git tag matching `v*.*.*` (semantic versioning).
- **Manual approval required** from CODEOWNERS before deployment.
- Multi-AZ deployment across 3 availability zones.
- Database: RDS Multi-AZ with read replicas.
- 3 Lithosphere nodes behind a load balancer.
- CDN (CloudFront) for frontend assets.

**Rollback Strategy:**
- ArgoCD automatic rollback on health check failure.
- Manual rollback via `argocd app rollback`.
- Database point-in-time recovery (PITR) enabled.

---

## Promotion Flow

Code changes flow through environments in a strict promotion pipeline:

```
┌─────────┐         ┌─────────┐         ┌─────────┐         ┌─────────┐
│  LOCAL   │────────>│ DEVNET  │────────>│ STAGING │────────>│ MAINNET │
│          │  push   │         │  merge  │         │  tag    │         │
│  Docker  │  to     │  K8s    │  to     │  K8s    │  v*.*   │  K8s    │
│  Compose │  main   │  shared │  release│  dedicated      │  dedicated
└─────────┘         └─────────┘         └─────────┘         └─────────┘
                                                     + manual approval
```

1. **Local to Devnet**: Push to `main` branch or open a Pull Request. CI builds and tests run automatically, and artifacts are synced to the devnet cluster.
2. **Devnet to Staging**: Merge to a `release/*` branch. Automated smoke tests run after deployment.
3. **Staging to Mainnet**: Create a semantic version Git tag (`v1.2.3`). A CODEOWNER must approve before ArgoCD syncs to the mainnet cluster.

---

## GitHub Actions Workflow Structure

The CI/CD pipeline is implemented as a collection of GitHub Actions workflows:

```
.github/workflows/
├── ci.yaml              # Lint, test, security scan (all branches)
├── build.yaml           # Docker build & push (main branch)
├── contracts.yaml       # Compile, test, audit contracts
├── deploy-devnet.yaml   # Auto-deploy to devnet
├── deploy-staging.yaml  # Deploy to staging (release branches)
└── deploy-mainnet.yaml  # Deploy to mainnet (tags, with approval)
```

### CI Pipeline (ci.yaml)

Runs on every push and pull request:

```yaml
# Simplified ci.yaml structure
on:
  push:
    branches: [main, 'release/*']
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    steps:
      - checkout
      - setup-node (Node.js 20 LTS)
      - pnpm install (with cache)
      - pnpm lint
      - pnpm typecheck
      - pnpm test

  security-scan:
    steps:
      - slither analysis
      - trivy container scan
```

### Contract Pipeline (contracts.yaml)

Compiles, tests, and audits smart contracts:

```yaml
contract-audit:
  steps:
    - hardhat compile
    - hardhat test --parallel
    - forge test --fuzz-runs 10000
    - slither . --sarif output.sarif
    - mythril analyze contracts/*.sol
```

### Build Pipeline (build.yaml)

Builds and pushes Docker images on merges to `main`:

```yaml
on:
  push:
    branches: [main]

jobs:
  build-and-push:
    steps:
      - docker/build-push-action (multi-platform)
      - cosign sign (image signing)
      - syft generate SBOM
```

---

## ArgoCD GitOps Deployment

Lithosphere uses ArgoCD for GitOps-based deployment to Kubernetes clusters. The Application-of-Applications pattern manages all environments:

```yaml
# Application-of-Applications pattern
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: lithosphere-environments
spec:
  generators:
    - list:
        elements:
          - env: devnet
            autoSync: true
          - env: staging
            autoSync: true
          - env: mainnet
            autoSync: false  # Manual approval required
```

**ArgoCD Sync Policies by Environment:**

| Environment | Auto-Sync | Self-Heal | Prune |
|-------------|-----------|-----------|-------|
| Devnet | Yes | Yes | Yes |
| Staging | Yes | Yes | Yes |
| Mainnet | **No** | No | No |

### Kubernetes Configuration Structure

```
clusters/
├── devnet/
│   └── argocd/application.yaml
├── staging/
│   └── argocd/application.yaml
└── mainnet/
    └── argocd/application.yaml
```

Environment-specific configuration is managed through Kustomize overlays to minimize drift between environments.

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

## Further Reading

- [Hardhat Example](examples/hardhat-example.md) -- Smart contract development and deployment
- [Foundry Example](examples/foundry-example.md) -- Fuzz testing with Foundry
- [Troubleshooting](troubleshooting.md) -- Common deployment issues and solutions
