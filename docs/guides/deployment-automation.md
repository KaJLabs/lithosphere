# Deployment Automation

This guide covers local development setup, production deployment to Kubernetes, GitOps workflows, CI/CD pipeline structure, and infrastructure as code for the Lithosphere project.

## Local Development with Docker

Start the full development stack using Docker Compose:

```bash
# Start core services
docker compose up -d

# Start with monitoring stack
docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml up -d
```

### Services

| Service      | Description                        | Local URL              |
|--------------|------------------------------------|------------------------|
| API          | GraphQL API server                 | http://localhost:4000   |
| Indexer      | SubQuery blockchain indexer        | --                     |
| PostgreSQL   | Primary database                   | localhost:5432          |
| Prometheus   | Metrics collection                 | http://localhost:9090   |
| Grafana      | Dashboards and visualization       | http://localhost:3000   |
| Loki         | Log aggregation                    | --                     |
| Promtail     | Log collection agent               | --                     |
| Alertmanager | Alert routing and notification     | http://localhost:9093   |

### Environment Variables

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/lithosphere
LITHO_CHAIN_ID=61
LITHO_RPC_URL=https://your-rpc-endpoint.example.com
```

## Production Deployment to Kubernetes

Production environments are managed through Kustomize overlays organized by environment:

```
clusters/
  devnet/
  staging/
  mainnet/
```

Deploy to a specific environment:

```bash
kubectl apply --kustomization clusters/devnet/
kubectl apply --kustomization clusters/staging/
kubectl apply --kustomization clusters/mainnet/
```

## GitOps with ArgoCD

ArgoCD manages deployments with environment-specific sync policies:

| Environment | Sync Policy | Details |
|-------------|-------------|---------|
| Devnet      | Auto-sync   | Automatically deploys changes when manifests are updated. |
| Staging     | Auto-sync   | Automatically deploys for integration testing. |
| Mainnet     | Manual sync | Requires explicit approval before deployment proceeds. |

## GitHub Actions Workflow Structure

CI/CD is implemented through the following GitHub Actions workflows:

| Workflow               | File                    | Purpose |
|------------------------|-------------------------|---------|
| Continuous Integration | `ci.yaml`               | Lint, test, and validate on every push and PR. |
| Build                  | `build.yaml`            | Build container images and publish artifacts. |
| Contracts              | `contracts.yaml`        | Compile, test, and audit smart contracts. |
| Deploy Devnet          | `deploy-devnet.yaml`    | Deploy to the devnet environment. |
| Deploy Staging         | `deploy-staging.yaml`   | Deploy to the staging environment. |
| Deploy Mainnet         | `deploy-mainnet.yaml`   | Deploy to the mainnet environment. |

### Deployment Triggers

| Environment | Trigger                            |
|-------------|------------------------------------|
| Devnet      | Push to `main` branch              |
| Staging     | Push to `release/*` branch         |
| Mainnet     | Git tag matching `v*.*.*`          |

## Supply Chain Security

Every build and deployment incorporates supply chain security measures:

- **OIDC authentication** -- Keyless authentication for CI/CD pipelines using GitHub OIDC tokens.
- **Signed artifacts (Cosign)** -- All container images are signed using Sigstore Cosign.
- **SBOM generation** -- Software Bill of Materials generated for every build for dependency transparency.
- **SLSA provenance** -- Build provenance attestations generated to verify artifact integrity.

## Rollback Procedures

| Method                | Scope            | Details |
|-----------------------|------------------|---------|
| ArgoCD auto-rollback  | Application      | Automatically rolls back when health checks fail after deployment. |
| Manual ArgoCD rollback | Application     | Run `argocd app rollback <app-name>` to revert to a previous revision. |
| Database PITR         | Data             | Point-in-time recovery for PostgreSQL databases. |

## Infrastructure as Code

Infrastructure is managed with **Terraform/OpenTofu** using a remote state backend:

- **State backend:** S3 bucket with DynamoDB locking for safe concurrent operations.
- **Module structure:**

| Module          | Purpose |
|-----------------|---------|
| `vpc`           | Virtual Private Cloud networking configuration. |
| `eks`           | Elastic Kubernetes Service cluster provisioning. |
| `rds`           | Managed PostgreSQL database instances. |
| `elasticache`   | Redis caching layer. |
| `s3`            | Object storage for artifacts and backups. |
| `iam`           | Identity and access management policies. |
| `security-groups` | Network security rules and firewall configuration. |
