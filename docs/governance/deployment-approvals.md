# Deployment Approval Flow

Every push to `main` that touches `Makalu/**` triggers
[`.github/workflows/deploy-simple.yaml`](https://github.com/KaJLabs/Lithosphere/actions/workflows/deploy-simple.yaml).
That workflow now runs inside a named GitHub Environment, which lets repo
admins attach **protection rules** (required reviewers, wait timers,
branch restrictions) without changing any code in this repository.

This page is the operator playbook: it covers how the gate is wired, how
admins flip on the protections, and how the deployment integrity check
works.

## The three protection layers

1. **GitHub Environment binding** — the deploy job declares
   `environment: ${{ github.event.inputs.environment || 'mainnet' }}`.
   GitHub treats every run as a "deployment" to that environment, surfacing
   it under **Settings → Environments → mainnet → Deployment history**.
2. **Required reviewers** — an admin-configurable rule on the GitHub
   Environment. When enabled, the workflow pauses at the `Deploy to Server`
   job until a named reviewer (or one of a list) approves it from the UI.
   No code change here; pure repo setting.
3. **Build SHA verification** — a workflow step (`Verify Deployed Build SHA`)
   runs after the health checks. It hits the new `/version` endpoint on api
   (`:4000`) and indexer (`:3001`) over SSM, parses the returned `gitSha`,
   and compares it to `github.sha`. Mismatch is surfaced as a `::warning::`
   and pinned to the workflow summary.

## Enabling required reviewers (one-time admin task)

This is the action that takes the protection from "wired" to "enforced":

1. Open **Settings → Environments** on the GitHub repo.
2. If `mainnet` already exists from a prior deploy run, click it. Otherwise
   click **New environment** and name it `mainnet`. (Names `staging` and
   `testnet` work the same way — the workflow accepts any of those via the
   `workflow_dispatch` input.)
3. Check **Required reviewers** and add 1–3 reviewers. Recommended: the
   on-call rotation plus at least one validator-team representative.
4. (Optional) **Wait timer** — a hold time before deployment proceeds even
   after approval. Useful as a "you're sure?" buffer; 0 minutes is fine
   for high-velocity teams.
5. (Optional) **Deployment branches** — restrict to `main` only. Stops a
   feature branch from accidentally triggering a deploy via
   `workflow_dispatch`.
6. **Save protection rules**.

That's it. The next deploy will pause at the **Deploy to Server** job,
show a "Review deployments" button, and route the approval through the
named reviewers.

## The SHA verification guardrail

The Phase 9 build-metadata work (commit `20f0233`) added a `/version`
endpoint on api and indexer that returns the git SHA baked into the
running container:

```bash
curl https://makalu.litho.ai/api/version
# { "service": "lithosphere-api",
#   "gitSha": "a3c8f76...", "buildTime": "...", "version": "bastion-a3c8f76", ... }
```

Phase 4 leverages that endpoint as a post-deploy integrity check. The
`Verify Deployed Build SHA` step (in `deploy-simple.yaml`):

1. Sends an SSM command to the bastion that curls `/version` on api and
   indexer.
2. Compares each returned `gitSha` to the workflow's `github.sha`.
3. Writes a Build SHA Verification table to the workflow summary:

| Service  | Deployed SHA | Match |
|----------|--------------|-------|
| api      | `a3c8f76...` | ✅    |
| indexer  | `a3c8f76...` | ✅    |
| expected | `a3c8f76...` | —     |

The step is currently **non-blocking** (`continue-on-error: true`) — a
mismatch produces a `::warning::` annotation but does not fail the deploy.
This is deliberate for the rollout: bastion-side `git clone` happens during
the deploy and could theoretically pick up a concurrent push, producing a
"mismatch" that is operationally fine. Once we have signal on how often
mismatches occur in practice, the flag flips to blocking.

### What a mismatch means

| Pattern | Likely cause | Action |
|---------|--------------|--------|
| api ✅, indexer ⚠ | api restarted but indexer didn't pick up the new image; or the indexer healthcheck passed before the new container started | Re-run the deploy; check `docker ps -a` on the bastion |
| Both ⚠, same wrong SHA | Concurrent push raced with the bastion `git clone` | Verify which commit landed on `main`; redeploy from the correct one |
| Both ⚠, both `unknown` | `/version` was unreachable or returned no JSON | Investigate the container — likely it didn't start cleanly |

## Rollback procedure

If the deploy fails health checks or the SHA verification surfaces a real
regression, the `rollback` job in `deploy-simple.yaml` runs automatically
on `failure()`. It SSHes to the bastion via SSM and restores
`Makalu/docker-compose.yaml` + `Makalu/.env` from the snapshot taken at the
top of the deploy (see `Saving rollback snapshot...` step).

Manual rollback is also possible — git revert the offending commit on
`main`, which retriggers the deploy with the prior known-good state.

## Related

- Phase 9 observability runbook: [`docs/governance/observability.md`](./observability.md)
- Release process for SDK packages: [`docs/governance/release-process.md`](./release-process.md)
- Key rotation runbook: [`docs/governance/key-rotation-runbook.md`](./key-rotation-runbook.md)
- Build-info implementation: `Makalu/{api,indexer}/src/lib/build-info.ts`
