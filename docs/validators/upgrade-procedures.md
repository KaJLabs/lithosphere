# Upgrade Procedures

> **Work in Progress** -- This page is under active development. Detailed step-by-step instructions for each upgrade path will be added as they are finalized.

---

## Topics to Cover

### Upgrade Methods

- **Cosmovisor-based Upgrades** -- Automated binary upgrades triggered by on-chain governance proposals. Cosmovisor monitors the chain for upgrade plans and automatically swaps the binary at the specified block height.
- **Binary Replacement Upgrades** -- Manual upgrade procedure involving stopping the node, replacing the `lithod` binary, and restarting. Suitable for non-governance upgrades or emergency patches.
- **Governance Proposal Upgrades** -- End-to-end workflow for proposing, voting on, and executing chain upgrades through the on-chain governance module.
- **Rollback Procedures** -- Steps to revert to a previous binary version and chain state in the event of a failed upgrade.

---

## Environment Promotion

All changes follow a strict promotion path through environments before reaching mainnet:

```
Devnet  -->  Staging  -->  Mainnet
```

Each environment serves as a validation gate. Changes must pass all tests, health checks, and approval requirements at each stage before promotion to the next.

---

## Mainnet Deployment Gate

The mainnet deployment process follows a controlled, auditable pipeline:

1. **Git Tag** -- A release is tagged in the source repository (e.g., `v1.2.0`).
2. **CI Build** -- The tagged commit triggers a CI pipeline that builds, tests, and signs the release artifacts.
3. **Approval** -- A designated CODEOWNER must explicitly approve the deployment.
4. **ArgoCD Sync** -- Upon approval, ArgoCD synchronizes the new version to the mainnet environment.

---

## Rollback Procedures

### ArgoCD Rollback

- **Automatic** -- ArgoCD performs an automatic rollback when health checks fail after a deployment. The previous known-good revision is restored without manual intervention.
- **Manual** -- Operators can trigger a manual rollback at any time:

```bash
argocd app rollback <application-name>
```

### Database Rollback

- **Point-in-Time Recovery (PITR)** -- Database state can be restored to any point in time within the retention window. This is critical for recovering from data corruption or unintended state changes introduced by a faulty upgrade.

---

## Deployment Windows

Deployments are restricted to defined maintenance windows to minimize risk and ensure adequate staffing for monitoring:

| Environment | Allowed Days | Allowed Hours (UTC) |
|-------------|-------------|---------------------|
| **Devnet** | Any day | Any time |
| **Staging** | Monday -- Thursday | 09:00 -- 17:00 |
| **Mainnet** | Tuesday -- Thursday | 14:00 -- 16:00 |

---

## Freeze Periods

The following freeze periods restrict mainnet deployments to reduce risk during high-impact windows:

| Rule | Detail |
|------|--------|
| **Major events** | No mainnet deployments during major network events, governance votes, or external market events that could amplify the impact of any issues. |
| **Minimum interval** | A minimum of 48 hours must pass between successive mainnet deployments to allow adequate observation of each change. |
| **Holiday freeze** | No mainnet deployments between December 20 and January 5 (inclusive) to account for reduced staffing during the holiday period. |
