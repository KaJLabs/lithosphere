# Release Calendar

This is the rolling schedule of upcoming releases under
[RFC 0001 — Release Trains](./rfcs/0001-release-trains.md). Status field
moves through `Open → Cut → Promoted / Rolled back`.

The on-call for a train is the human responsible for cutting the tag,
watching the deploy, and updating this row. Rotation handover happens at
the previous train.

## Tracks

- **dev** — weekly, Tuesdays 14:00 UTC. Tag pattern `v<X.Y.Z>-dev.N`.
- **staging** — bi-weekly, alternate Wednesdays 14:00 UTC. Tag pattern `v<X.Y.Z>-staging.N`.
- **hotfix** — on-demand. Tag pattern `v<X.Y.Z>-hotfix.N`. Logged here
  after the fact for the post-incident review.

## Current rotation

| Date (UTC)   | Track    | Tag (planned)       | On-call | Status | Notes |
|--------------|----------|---------------------|---------|--------|-------|
| 2026-05-12   | dev      | v0.5.0-dev.1        | _TBD_   | Open   | First train under RFC 0001; advisory mode |
| 2026-05-19   | dev      | v0.5.0-dev.2        | _TBD_   | Open   | |
| 2026-05-26   | staging  | v0.5.0-staging.1    | _TBD_   | Open   | Soak window for v0.5.0-dev.* changes |
| 2026-06-02   | dev      | v0.5.1-dev.1        | _TBD_   | Open   | |
| 2026-06-09   | staging  | _TBD_               | _TBD_   | Open   | |

## Hotfix log

Append entries here after any `release_type=hotfix` deploy. Used by PIRs.

| Date (UTC)        | Tag                  | Triggered by | Resolved by | Linked PIR |
|-------------------|----------------------|--------------|-------------|------------|
| _none yet_        | —                    | —            | —           | —          |

## How to cut a train

1. **Pre-flight (T–24h):** check the [SLO dashboard](../../Makalu/infra/grafana/dashboards/slo.json) for any red panels. Postpone if availability is below 99.9% or error rate above 1%.
2. **At cadence time:** push the tag from `main`:
   ```bash
   git tag -a v0.5.0-dev.1 -m "release: v0.5.0-dev.1 — see CHANGELOG"
   git push origin v0.5.0-dev.1
   ```
3. `.github/workflows/publish-images.yaml` builds + signs + Trivy-gates the three images. The deploy workflow picks up via the existing `mainnet` environment approval flow.
4. **Post-deploy (T+15m):** confirm the [Build Info table](../../Makalu/infra/grafana/dashboards/slo.json) shows the new `version` label and matching `git_sha` across api + indexer. The Phase 4 SHA verification step in `deploy-simple.yaml` makes this an automatic check.
5. **Update this calendar:** set Status to `Cut`. If the deploy rolls back, update to `Rolled back` and link the rollback commit.
6. **At T+7d:** for a dev train that ran clean, propose promotion to the next staging tag at the team standup.

## Postponement rule

> Better an empty week than a deploy nobody's watching.

If the assigned on-call cannot cover the window:

1. Try to find a swap by 12h before the cut.
2. If no swap, mark the row `Skipped (no on-call)` and roll the
   intended changes into the next train.
3. Never run an unmonitored train. Hotfixes are the only exception, and
   they're page-driven, not calendar-driven.

## Related

- [RFC 0001 — Release Trains](./rfcs/0001-release-trains.md)
- [Deployment Approvals runbook](./deployment-approvals.md) — the protection-rules layer
- [PIR template](./pir-template.md) — incident write-ups reference the train tag
- [Release process for SDK packages](./release-process.md) — npm publish, separate from service deploys
