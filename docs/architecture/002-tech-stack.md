# ADR-002: Technology Stack - Bill of Materials

## Status
**Accepted**

## Date
2024-12-13

## Context

The Lithosphere L1 Blockchain Developer Infrastructure requires a well-defined technology stack that supports:

1. **Developer Experience**: Fast builds, hot-reload, comprehensive tooling
2. **Security**: Supply chain security, signed artifacts, secret management
3. **Observability**: Full-stack monitoring, logging, and alerting
4. **Scalability**: Kubernetes-native, horizontally scalable components
5. **GitOps**: Infrastructure as Code, declarative deployments

This document serves as the authoritative "Bill of Materials" for all infrastructure components.

---

## Decision

We adopt the following technology stack, organized by functional domain:

---

## 1. CI/CD Pipeline

### Primary: GitHub Actions

| Component | Tool | Version | Purpose |
|-----------|------|---------|---------|
| CI Orchestrator | GitHub Actions | N/A | Workflow orchestration |
| Build Cache | actions/cache | v4 | npm/Docker layer caching |
| Node.js | actions/setup-node | v4 | Node.js 20 LTS |
| Docker Build | docker/build-push-action | v5 | Multi-platform builds |
| OIDC Auth | aws-actions/configure-aws-credentials | v4 | Keyless AWS auth |

**Workflow Structure:**
```
.github/workflows/
├── ci.yaml              # Lint, test, security scan (all branches)
├── build.yaml           # Docker build & push (main branch)
├── contracts.yaml       # Compile, test, audit contracts
├── deploy-devnet.yaml   # Auto-deploy to devnet
├── deploy-staging.yaml  # Deploy to staging (release branches)
└── deploy-mainnet.yaml  # Deploy to mainnet (tags, with approval)
```

**Security Features:**
- OIDC authentication (no long-lived credentials)
- Branch protection rules enforced
- Required status checks before merge
- Signed commits required for mainnet

---

## 2. GitOps & Deployment

### Primary: ArgoCD

| Component | Tool | Version | Purpose |
|-----------|------|---------|---------|
| GitOps Controller | ArgoCD | v2.9+ | Kubernetes deployment sync |
| Config Management | Kustomize | v5.0+ | Environment overlays |
| Helm Charts | Helm | v3.13+ | Package management |
| Image Updater | ArgoCD Image Updater | v0.12+ | Automatic image updates |

**ArgoCD Configuration:**
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
            autoSync: false  # Manual approval
```

**Sync Policies:**
| Environment | Auto-Sync | Self-Heal | Prune |
|-------------|-----------|-----------|-------|
| Devnet | Yes | Yes | Yes |
| Staging | Yes | Yes | Yes |
| Mainnet | **No** | No | No |

---

## 3. Infrastructure as Code (IaC)

### Primary: Terraform / OpenTofu

| Component | Tool | Version | Purpose |
|-----------|------|---------|---------|
| IaC Engine | Terraform | v1.6+ | Infrastructure provisioning |
| Alternative | OpenTofu | v1.6+ | BSL-free alternative |
| State Backend | S3 + DynamoDB | N/A | Remote state with locking |
| Secrets | Terraform Vault Provider | v3.0+ | Secret injection |

**Module Structure:**
```
infra/terraform/
├── modules/
│   ├── vpc/              # Network infrastructure
│   ├── eks/              # Kubernetes cluster
│   ├── rds/              # PostgreSQL databases
│   ├── elasticache/      # Redis clusters
│   ├── s3/               # Object storage
│   ├── iam/              # IAM roles & policies
│   └── security-groups/  # Network security
└── environments/
    ├── devnet/           # terraform.tfvars for devnet
    ├── staging/          # terraform.tfvars for staging
    └── mainnet/          # terraform.tfvars for mainnet
```

**State Management:**
```hcl
terraform {
  backend "s3" {
    bucket         = "lithosphere-terraform-state"
    key            = "environments/${var.environment}/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "lithosphere-terraform-locks"
  }
}
```

---

## 4. Observability Stack

### Metrics: Prometheus + Grafana

| Component | Tool | Version | Purpose |
|-----------|------|---------|---------|
| Metrics Collection | Prometheus | v2.47+ | Time-series metrics |
| Visualization | Grafana | v10.0+ | Dashboards & alerting |
| Kubernetes Metrics | kube-prometheus-stack | v54+ | Full K8s monitoring |
| Custom Metrics | Prometheus Pushgateway | v1.6+ | Job metrics |

### Logging: Loki + Promtail

| Component | Tool | Version | Purpose |
|-----------|------|---------|---------|
| Log Aggregation | Grafana Loki | v2.9+ | Log storage & query |
| Log Shipping | Promtail | v2.9+ | Log collection agent |
| Log Parsing | Fluent Bit | v2.2+ | Advanced parsing |

### Tracing: OpenTelemetry

| Component | Tool | Version | Purpose |
|-----------|------|---------|---------|
| SDK | OpenTelemetry JS | v1.18+ | Application instrumentation |
| Collector | OTel Collector | v0.88+ | Trace collection |
| Backend | Grafana Tempo | v2.3+ | Trace storage |

### Alerting

| Component | Tool | Version | Purpose |
|-----------|------|---------|---------|
| Alert Manager | Prometheus Alertmanager | v0.26+ | Alert routing |
| Incident Mgmt | PagerDuty | N/A | On-call escalation |
| Status Page | Atlassian Statuspage | N/A | Public status |

**Dashboard Structure:**
```
Grafana Dashboards/
├── infrastructure/
│   ├── kubernetes-cluster.json
│   ├── node-resources.json
│   └── network-traffic.json
├── application/
│   ├── api-gateway.json
│   ├── frontend-performance.json
│   └── indexer-sync.json
└── blockchain/
    ├── lithosphere-node.json
    ├── transaction-metrics.json
    └── contract-events.json
```

---

## 5. Smart Contract Tooling

### Hybrid: Hardhat + Foundry

| Component | Tool | Version | Purpose |
|-----------|------|---------|---------|
| Development | Hardhat | v2.19+ | TypeScript-native development |
| Testing | Foundry (Forge) | latest | Fast fuzz testing |
| Deployment | Hardhat Ignition | v0.15+ | Declarative deployments |
| Gas Analysis | hardhat-gas-reporter | v1.0+ | Gas optimization |

### Security Auditing

| Component | Tool | Version | Purpose |
|-----------|------|---------|---------|
| Static Analysis | Slither | v0.10+ | Vulnerability detection |
| Symbolic Exec | Mythril | v0.24+ | Deep analysis |
| Fuzzing | Echidna | v2.2+ | Property-based testing |
| Formal Verify | Certora | N/A | Formal verification (optional) |

**Contract CI Pipeline:**
```yaml
contract-audit:
  steps:
    - hardhat compile
    - hardhat test --parallel
    - forge test --fuzz-runs 10000
    - slither . --sarif output.sarif
    - mythril analyze contracts/*.sol
```

---

## 6. Security & Secrets Management

### Primary: HashiCorp Vault

| Component | Tool | Version | Purpose |
|-----------|------|---------|---------|
| Secret Store | HashiCorp Vault | v1.15+ | Centralized secrets |
| K8s Integration | Vault Agent Injector | v1.3+ | Pod secret injection |
| Dynamic Secrets | Vault AWS Engine | N/A | Temporary AWS credentials |
| PKI | Vault PKI Engine | N/A | Certificate management |

**Secret Hierarchy:**
```
vault/
├── secret/lithosphere/
│   ├── devnet/
│   │   ├── database
│   │   ├── api-keys
│   │   └── rpc-endpoints
│   ├── staging/
│   │   └── ...
│   └── mainnet/
│       └── ...
└── pki/lithosphere/
    ├── root-ca
    └── intermediate-ca
```

### Supply Chain Security

| Component | Tool | Version | Purpose |
|-----------|------|---------|---------|
| Image Signing | Sigstore Cosign | v2.2+ | Container signing |
| SBOM | Syft | v0.100+ | Bill of materials |
| Vulnerability Scan | Trivy | v0.48+ | CVE scanning |
| Attestation | in-toto | v1.0+ | SLSA provenance |

---

## 7. Container & Orchestration

### Primary: Kubernetes (EKS)

| Component | Tool | Version | Purpose |
|-----------|------|---------|---------|
| Managed K8s | AWS EKS | v1.28+ | Kubernetes cluster |
| Ingress | NGINX Ingress | v1.9+ | HTTP routing |
| Service Mesh | Istio | v1.20+ | mTLS, traffic mgmt |
| Autoscaling | KEDA | v2.12+ | Event-driven scaling |

### Local Development

| Component | Tool | Version | Purpose |
|-----------|------|---------|---------|
| Local K8s | Docker Desktop | latest | Development cluster |
| Compose | Docker Compose | v2.23+ | Multi-container dev |
| K8s Dev | Tilt | v0.33+ | Hot-reload for K8s |

---

## 8. Database & Storage

| Component | Tool | Version | Purpose |
|-----------|------|---------|---------|
| Primary DB | PostgreSQL | v15+ | Application data |
| Cache | Redis | v7+ | Session/cache layer |
| Object Store | AWS S3 | N/A | Artifacts, backups |
| Block Storage | AWS EBS (gp3) | N/A | Persistent volumes |

---

## 9. Application Stack (Existing)

| Component | Tool | Version | Purpose |
|-----------|------|---------|---------|
| Frontend | Next.js | v14+ | React SSR framework |
| API Gateway | Apollo Server | v4+ | GraphQL gateway |
| Indexer | SubQuery | v3+ | Blockchain indexing |
| Contracts | Solidity | v0.8.20+ | Smart contracts |

---

## Version Pinning Strategy

| Category | Strategy | Example |
|----------|----------|---------|
| Infrastructure | Minor version pin | `terraform ~> 1.6.0` |
| Runtime | LTS versions | Node.js 20 LTS |
| Security | Latest stable | Trivy latest |
| Contracts | Exact version | Solidity 0.8.20 |

---

## Dependency Update Policy

| Frequency | Scope | Automation |
|-----------|-------|------------|
| Weekly | Security patches | Dependabot |
| Monthly | Minor versions | Manual review |
| Quarterly | Major versions | RFC required |

---

## Consequences

### Positive
- Industry-standard tooling with strong community support
- Comprehensive observability from day one
- Security-first approach with SLSA compliance path
- GitOps enables full audit trail and rollback capability

### Negative
- Learning curve for teams unfamiliar with Kubernetes/ArgoCD
- Infrastructure cost for running full observability stack
- Complexity in managing multiple tools

### Mitigations
- Provide training and runbooks for all tools
- Start with managed services (EKS, RDS) to reduce operational burden
- Implement cost monitoring from day one

---

## References

- [CNCF Landscape](https://landscape.cncf.io/)
- [SLSA Security Levels](https://slsa.dev/spec/v1.0/levels)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Foundry Book](https://book.getfoundry.sh/)
- [ArgoCD User Guide](https://argo-cd.readthedocs.io/)
- [HashiCorp Vault](https://developer.hashicorp.com/vault)
