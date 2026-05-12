# Change Advisory Board (CAB) — Mainnet Promotion

A CAB review is the human gate that sits between a green CI pipeline and
a mainnet deploy. It's the "should we do this?" review that complements
the automated "can we do this?" gates (Cosign + SLSA + SHA-verify +
test/lint/license-check).

This runbook describes who attends, what they ask, what artifacts they
read, and what a "go" or "no-go" looks like in writing. It's the
fallback when [`deployment-approvals.md`](./deployment-approvals.md)
calls out a CAB-required change.

## When a CAB is required

The CAB is **not** invoked on every release — that would defeat the
release-train cadence in [RFC 0001](./rfcs/0001-release-trains.md).
It IS required for:

| Change class | Example | CAB required? |
|---|---|---|
| Regular weekly dev-train tag | Bug fixes, doc updates, new endpoints | **No** — auto-promotes per RFC 0001 |
| Regular bi-weekly staging-train tag | Same set, broader audience | **No** — Validator-team approval suffices |
| Mainnet release (first time a change reaches prod) | Same set, after staging soak | **Yes** — single rolling CAB ticket per release |
| Hotfix outside the release calendar | Critical CVE patch, prod incident response | **Yes** — abbreviated CAB (see "Emergency CAB" below) |
| Consensus parameter change | `timeout_commit`, chain-id migration | **Yes** — Chain Team owns, CAB attends |
| Schema-incompatible migration | New required column, dropping a table | **Yes** — Dev Infra owns |
| Anything touching `Makalu/contracts/src/` deployed on-chain | LEP100 upgrade, new precompile | **Yes** — Security Lead owns |
| RPC ingress / TLS / DNS change at the edge | new `*.litho.ai` record, cert rotation | **Yes** — Validator Infra owns |

When in doubt, file the CAB ticket. The cost of an unneeded review is a
5-minute Slack thread; the cost of a missed review is a rollback.

## Who attends

CAB membership maps to the [RACI matrix](./raci.md) roles. The default
quorum for a mainnet CAB:

| Role | Attendance | Why |
|---|---|---|
| **Dev Infra** | Required | Owns the deploy pipeline that will execute the change |
| **Validator Team** | Required | Has the `A` for cutting the staging→mainnet train |
| **Chain Team** | Required for any chain-touching change; informed otherwise | Consensus or migration changes need their sign-off |
| **Security Lead** | Required for security-sensitive changes; informed otherwise | CVE response, key rotation, contract upgrades |
| **Validator Infra** | Informed for service changes; required for ingress/TLS/DNS | Owns the edge layer |

A CAB can proceed with two roles + the change owner if all required
parties are notified and have not objected within the 24-hour comment
window. Don't gate on availability — that just produces post-hoc CABs.

## The CAB ticket

A CAB review lives as a single GitHub issue with the
[`cab` label](https://github.com/KaJLabs/Lithosphere/labels/cab). Every
mainnet release has exactly one. The issue body uses this template:

```markdown
## Change summary
<One sentence: what this release changes. Link the release-please PR or RFC.>

## Risk class
<Low / Medium / High — refer to "When a CAB is required" above.>

## Pre-CAB checklist (Dev Infra fills in)
- [ ] Release-please PR is open and reviewed
- [ ] CI pipelines all green (CI, CI Contracts, CI SDK, CodeQL, integration)
- [ ] Trivy + Cosign + SLSA attestation verified on the published images
  (link to the publish-images run that produced them)
- [ ] Staging soak ≥ 48h with no SLO breach
  (link the Grafana SLO dashboard for the window)
- [ ] Rollback procedure rehearsed for this change class
  (cite the relevant section in deployment-approvals.md)

## Risk assessment
<2-4 bullets. What's the worst-case blast radius? What's the
detection signal? What's the rollback latency?>

## Voting
- [ ] Dev Infra: <name> — approve / object / abstain
- [ ] Validator Team: <name> — approve / object / abstain
- [ ] Chain Team: <name> — approve / object / abstain (mark "informed" if not required)
- [ ] Security Lead: <name> — approve / object / abstain (mark "informed" if not required)

## Decision
<Filled in by Validator Team after the 24h comment window closes.
"Go" / "No-go" / "Go with conditions" — and the conditions if any.>
```

Open the ticket at the time the release-please PR opens. Close the
ticket when the mainnet deploy lands and the SHA-verify step reports
match across all three services.

## The 24-hour comment window

CABs are asynchronous by default. After a member opens the ticket and
fills in the pre-CAB checklist, the comment window is 24 hours from the
"@-mention all required attendees" comment. During that window:

- Any required attendee can **object**, which blocks the change until
  the objection is resolved by the change owner (additional info,
  scope reduction, or schedule shift).
- Silence == implicit approval. Decision-quorum thresholds use the
  required-attendees count.

When everyone has voted before the window expires, the decision can be
recorded early and the change can proceed. The 24h is a maximum, not a
mandatory hold.

## Emergency CAB

For hotfixes (critical CVE, prod incident) the asynchronous 24h window
is replaced by:

- A live thread in `#oncall` Slack pinging the required attendees.
- 60-minute response SLA on attendee acknowledgement.
- Decision recorded in the CAB ticket retroactively, with the Slack
  thread linked.

Emergency CAB sign-off is still **two roles + change owner** minimum.
Don't deploy unilaterally even under emergency pressure; the rollback
cost of a botched hotfix usually exceeds the incident cost.

## Post-CAB

After the change deploys:

- The CAB ticket gets a "Deploy outcome" comment from Dev Infra with:
  the production SHA, the deploy workflow run URL, and a link to the
  10-minute-post-deploy Grafana SLO snapshot.
- If anything went wrong (rollback fired, SLO breach in the 24h after),
  open a [PIR](./pir-template.md) and cross-link it from the CAB ticket.
- Closed CAB tickets remain searchable as the change history — don't
  delete them, don't squash threads.

## Boundaries this runbook does NOT cover

- Marketing / partnership / community-comms release announcements —
  separate org-comms track.
- Validator-team economic parameter changes (slashing, staking
  rewards) — those go through the on-chain governance module, not CAB.
- Internal refactors that don't reach mainnet — covered by the regular
  PR-review process, no CAB needed.

## Related

- [RACI matrix](./raci.md) — role definitions
- [Deployment Approvals](./deployment-approvals.md) — the GitHub
  Environment protection layer that CAB approval translates into
- [Release Process](./release-process.md) — the release-please flow
  that creates the CAB ticket trigger
- [Release Calendar](./release-calendar.md) — the rolling-4-train
  template the CAB approves against
- [PIR template](./pir-template.md) — for post-incident write-ups
  triggered by a CAB'd change that went wrong
- [RFC 0001](./rfcs/0001-release-trains.md) — the cadence proposal CAB
  reviews adhere to
