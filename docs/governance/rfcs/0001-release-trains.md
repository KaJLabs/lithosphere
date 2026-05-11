# RFC 0001: Release Trains for Lithosphere services

| | |
|-|-|
| **Status**       | Draft — needs validator-team sign-off |
| **Author(s)**    | @bachal-abro |
| **Sponsor**      | TBD (validator team lead) |
| **Created**      | 2026-05-11 |
| **Last Updated** | 2026-05-11 |
| **Discussion**   | _Open a PR review of this file when ready_ |
| **Supersedes**   | (none) |

## Summary

Today every push to `main` that touches `Makalu/**` rolls straight into
mainnet through `deploy-simple.yaml`. There is no scheduled cadence and
no separation between "feature work landed in main" and "feature work
went live." This RFC proposes a three-track release calendar — **weekly
dev**, **bi-weekly staging**, **on-demand hotfix** — that batches changes,
gives the validator team a predictable promotion window, and makes
post-incident review (PIR) easier because each train is a discrete unit.

## Motivation

Status quo failure modes observed in the 2026-04 → 2026-05 window:

- **Surprise deploys.** Pushing to `main` deploys immediately. Validator
  team has reported being paged for a deploy that nobody on shift knew was
  coming — typically because the change was a documentation tweak that
  rebuilt and force-recreated the api container as a side effect.
- **No batching.** Independent fixes deploy one at a time, multiplying
  the change-failure rate (every push is a chance for the deploy step
  itself to fail). The 2026-05-11 push storm (commits `6d95249` →
  `f0aff8f`, 13 deploys in 6 hours) exercised the rollback path more
  than it needed to.
- **No coordination with chain ops.** When chain ops needs a quiet window
  (e.g. mtest-val-01 re-roll on 2026-05-08), there is no convention for
  pausing service deploys — the deploy gate is an admin toggle, not a
  scheduled lull.
- **PIR difficulty.** Post-incident reviews currently span N commits
  across M hours with no narrative grouping. Trains give incident
  responders a single "what was in release 2026-05-13" reference.

Cost of inaction: deploy volume scales linearly with engineering velocity;
the lack of cadence means the validator team has to keep all hours
"on-call equivalent" rather than carving deploy windows.

## Goals & Non-Goals

**Goals**

- Define a written cadence for service releases that the validator team
  agrees to monitor and the dev infra team agrees to schedule against.
- Provide a release-calendar template owners can fill in week-by-week.
- Keep the existing zero-friction "push to main → deploy" mechanic
  available for hotfixes (don't slow down genuine emergencies).
- Make the difference between "code merged" and "code deployed"
  observable — every train cuts a tag, every deploy maps back to a tag.

**Non-Goals**

- Replacing the GitHub Environments approval gate from Phase 4 — trains
  build *on top of* that gate, not in place of it.
- Defining new CI gates — the existing CI / publish-images / abi-sync /
  license-check / schema-sync set is sufficient.
- CAB (Change Approval Board) approvals — covered separately under the
  Phase 11 governance umbrella; this RFC scopes to cadence.

## Detailed Design

### The three tracks

| Track       | Cadence                  | Trigger        | Audience          | Promotion path     |
|-------------|--------------------------|----------------|-------------------|--------------------|
| `dev`       | Weekly, Tuesday 14:00 UTC | manual workflow_dispatch tag | dev infra + early validators | → `staging` after 7 d soak |
| `staging`   | Bi-weekly, alternate Wednesdays 14:00 UTC | manual workflow_dispatch tag | full validator set | direct (no further promotion today; production = testnet) |
| `hotfix`    | On-demand                | `workflow_dispatch` with `release_type=hotfix` | whoever paged | direct deploy, no soak |

Times are UTC and intentionally outside US-East trading hours but inside
EU/AsiaPac business hours.

### Tag scheme

```
v<MAJOR>.<MINOR>.<PATCH>-<track>.<n>
```

- `v0.5.0-dev.3` — third dev train of the v0.5 line
- `v0.5.0-staging.1` — promotion of v0.5.0-dev.N to staging
- `v0.5.0-hotfix.1` — emergency patch off the current staging tag

The tag is what `publish-images.yaml` already keys off (`type=sha,prefix=sha-`
+ `type=semver` patterns from the existing `docker/metadata-action` config).
No workflow code change needed to support semver tags — the tag triggers
existing publish + Cosign sign + SBOM + Trivy gate.

### Calendar artifact

A new `docs/governance/release-calendar.md` (sibling to this RFC) lists
the next four trains plus their on-call assignee. Updated weekly during
the dev cut.

```
| Date (UTC)   | Track    | Tag (planned)       | On-call | Status |
|--------------|----------|---------------------|---------|--------|
| 2026-05-12   | dev      | v0.5.0-dev.1        | @TBD    | Open   |
| 2026-05-19   | dev      | v0.5.0-dev.2        | @TBD    | Open   |
| 2026-05-26   | staging  | v0.5.0-staging.1    | @TBD    | Open   |
| 2026-06-02   | dev      | v0.5.1-dev.1        | @TBD    | Open   |
```

### Hotfix path

Unchanged from today's `workflow_dispatch` on `deploy-simple.yaml`. The
RFC accepts that emergency response trumps cadence; the calendar simply
records hotfixes after the fact for the PIR.

A hotfix that succeeds becomes the basis for the next staging tag — i.e.
hotfixes don't rebase out, they roll forward into the train.

### Architecture

No new components. The release-train mechanism is entirely a tag-naming
convention + a markdown calendar + a written sign-off cadence. All
existing CI/CD flows are reused.

### Data Model / Schema Changes

None.

### API / Interface Changes

None for runtime APIs. The SDK's release process
([`release-process.md`](./release-process.md)) is unaffected — it
follows semver on tag pushes, which already aligns with the train tag
scheme.

### Operational Considerations

- **Deploy concurrency**: `deploy-simple.yaml` already has
  `concurrency: deploy-${{ env }}` with `cancel-in-progress: false`.
  Trains land sequentially.
- **Observability**: the Phase 9 `build_info` Prometheus gauge already
  surfaces the deployed sha + version; with the new tag scheme it will
  display `version=v0.5.0-staging.1` instead of `sha-abc1234`. That's
  the operator-friendly format.
- **Calendar drift**: if the assigned on-call cannot cut the train, the
  RFC's escalation rule is to skip — never run an unmonitored train.
  Better an empty week than a deploy nobody's watching.

### Security & Privacy

No new attack surface. Tag pushes are already gated by the Required
Reviewers protection rule on the `mainnet` GitHub Environment (see
`deployment-approvals.md`). Trains don't bypass that gate.

## Alternatives Considered

- **Continuous deploy with feature flags.** Rejected: no feature-flag
  infrastructure exists today; building it is a separate multi-week
  project. Trains buy similar coordination benefit at near-zero cost.
- **Daily releases.** Rejected: too noisy for a validator team that
  doesn't operate 24/7 yet; the savings from batching are real.
- **One unified weekly train (no dev/staging split).** Rejected: makes
  the dev-vs-validator coordination interface explicit. With one track
  the dev team can't run a soak window without bothering the validator
  team about each tag.
- **Use `release-please` automation to manage tags.** Considered for
  follow-up. This RFC keeps tags manual to start so the cadence and
  human review pattern stabilize first; automation is a v2 concern.

## Drawbacks

- **Slower mean-time-to-prod for non-urgent changes.** A bug fix landed
  on Wednesday waits until next Tuesday's dev train. Mitigated by the
  hotfix path for anything genuinely urgent.
- **Coordination overhead.** Someone has to keep the calendar accurate
  and rotate the on-call. ~30 min/week.
- **Calendar can be ignored.** If `git push origin main` still deploys,
  the train tags are optional. We'd need to either (a) flip the
  per-push deploy off and require a tag, or (b) trust the team to
  honour the convention. This RFC defers that decision to validator-team
  sign-off — proposed default is (b) for the first month, then revisit.

## Rollout Plan

1. **2026-05-12** — RFC reviewed by validator team. Sign-off captured
   in a comment on the PR or this file.
2. **2026-05-13** — Calendar artifact published with the next four
   trains scheduled. On-call assignees filled in.
3. **2026-05-13 → 2026-06-13** — Run cadence in advisory mode. Per-push
   deploys remain enabled; trains are additional. Observe friction
   points.
4. **2026-06-13** — Retro: decide whether to (a) keep both flows,
   (b) tighten per-push to non-Makalu paths only and require tags
   for Makalu changes, or (c) hold the line and revisit in another
   30 days.

## Unresolved Questions

- [ ] Who owns the calendar? Proposed: rotating between dev infra and
      validator team monthly.
- [ ] Where does the calendar live? Proposed: in-repo at
      `docs/governance/release-calendar.md`. Alternative: Notion / Linear.
- [ ] What's the soak criterion for promoting a dev tag to staging?
      Proposed: 7 days clean (no rollback, no SLO burn, no Slack
      `#oncall` mention).
- [ ] Should the dev track tag actually deploy, or just be a "ready
      for staging" marker? This RFC assumes it deploys; alternative
      is a tag-only marker.

## Success Metrics

Measured 30 days after sign-off:

| Goal | Metric | Threshold |
|------|--------|-----------|
| Predictable cadence | Tuesday/Wed deploys as % of all deploys | ≥ 70% |
| Reduced surprise deploys | Validator-team pages for unscheduled deploys | 0 (excluding hotfixes) |
| Coordinated chain ops | Number of train postponements due to chain ops conflicts | recorded, baseline target ≤ 1/month |
| PIR usability | PIRs that cite a train tag (rather than a commit range) | 100% |

## References

- [`deployment-approvals.md`](./deployment-approvals.md) — the protection-rules layer this RFC builds on
- [`release-process.md`](./release-process.md) — the npm release flow (SDK), unaffected
- [`pir-template.md`](./pir-template.md) — train tags slot in cleanly to the PIR "What changed" section
- `.github/workflows/deploy-simple.yaml` — already supports `workflow_dispatch` with environment input
- `.github/workflows/publish-images.yaml` — already keys image tagging off semver via `docker/metadata-action`
