# Phase 11 — Governance & Change Management

> **Status:** 100% Dev-Infra ceiling (2026-05-12). Templates + RFC 0001 +
> release calendar + CAB approvals + incident response + documentation
> governance meta-runbook all live. RFC 0001 cadence sign-off + on-call
> rotation table remain validator-team-blocked — sign-off, not engineering.

## What this phase covers

Codify how decisions get made, recorded, reviewed, and audited. The phase
splits into three sub-areas:

- **Process templates** — RFC, PIR (post-incident review), GitHub issue
  forms — so a contributor doesn't have to invent the shape of an artifact
  each time.
- **Operational runbooks** — incident response, CAB approvals, release
  calendar, deployment approvals — so the team has a written playbook
  for things that happen rarely enough that no one remembers the right
  sequence in the moment.
- **Meta-governance** — a registry of every runbook with owners + review
  cadence, so the docs don't quietly rot.

## What we built

### Templates

| Template | When used |
|----------|-----------|
| `rfc-template.md` | Significant design decisions (release cadence, security policy, API breaks) |
| `pir-template.md` | Required after every Sev-1/Sev-2 incident; optional for Sev-3 with non-obvious cause |
| `.github/ISSUE_TEMPLATE/bug_report.md` | Bug filing — enforces repro steps |
| `.github/ISSUE_TEMPLATE/feature_request.md` | Feature requests — enforces problem statement before solution |
| `.github/ISSUE_TEMPLATE/incident.md` | First-responder declares an incident; this is the form |
| `.github/ISSUE_TEMPLATE/config.yml` | Disables blank issues so every issue lands in a template |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR description checklist |

### RFC 0001 — Release Trains

`docs/governance/rfcs/0001-release-trains.md` proposes:
- **Weekly dev train** — cut every Monday, ships whatever's on `main` to
  staging
- **Bi-weekly staging promotion** — Tuesday of week 2, promotes the
  current dev train to mainnet candidate
- **On-demand hotfix train** — out-of-band for Sev-1/Sev-2 fixes

Tag scheme reuses the existing `docker/metadata-action` semver patterns —
zero workflow change needed. Status: **pending validator-team sign-off**
on the cadence + on-call rotation specifics.

### CAB approvals runbook

`docs/governance/cab.md` (Change Advisory Board). Covers:

- **When CAB is required** — matrix by change class: chain parameter
  changes (always); contract redeploys (always); API breaking changes
  (always); deploy-pipeline edits (conditional); doc updates (never).
- **Default quorum** — mapped to RACI roles (Dev Infra + Validator Team
  + Security Lead, with Chain Team for contract changes).
- **Ticket template** — pre-CAB checklist + risk assessment + voting +
  decision sections, all in a GitHub issue.
- **Async window** — 24h comment window; emergency CAB cuts it to
  60-min `#oncall` SLA with a 2-role-minimum quorum for hotfixes.
- **Post-deploy outcome** — tied to the SHA-verify step in
  `deploy-simple.yaml` so the CAB ticket auto-closes on green deploy.

### Release calendar

`docs/governance/release-calendar.md` carries a rolling-4-train template
(cut/promote/in-flight/recently-shipped) with:

- Cut/promote workflow per train
- Hotfix log (separate from the regular train)
- Postponement rule (any single role can postpone with rationale)
- Pre-filled `_TBD_` on-call placeholders pending validator-team sign-off

### Incident response runbook

`docs/governance/incident-response.md` — the operational IR flow:

| Sev | Examples | Page |
|-----|----------|------|
| Sev-1 | `api.litho.ai` 5xx >5min; chain halted | Dev Infra + Validator Team simultaneously |
| Sev-2 | EVM tx submission failing; SLO error budget burned through | On-call within 15 min |
| Sev-3 | Single endpoint broken; one validator slashed | GitHub issue, 1-business-day ack |
| Sev-4 | Cosmetic; wrong copy | Standard PR backlog |

Declare flow (ack → open ticket → page → pick IC → start running log),
triage routing table (symptom class → first dashboard), comms cadence by
severity, resolve hold-window discipline (30min Sev-1, 15min Sev-2 — catches
flapping), PIR linkage (mandatory for Sev-1/2, 5-business-day cadence),
copy-paste comms templates, anti-checklist of forbidden moves.

### Documentation governance meta-runbook

`docs/governance/documentation.md` — the meta-doc. Registry of every
governance doc (17 entries) with owner + review cadence (quarterly /
semi-annual / annual / triggered) + the trigger artifact that forces an
inline update. Plus:

- **Last-reviewed marker convention** — every runbook starts with
  `> Last reviewed: YYYY-MM-DD · Owner: <role> · Linked phase: P<n>`.
- **Quarterly governance pass** — 30-min timebox to walk the registry,
  either update content or refresh the marker.
- **Triggered-review discipline** — PRs that change a trigger artifact
  (e.g. `AuditAction` union) must update the linked doc in the same PR.
- **Doc style conventions** — lead with why, concrete examples, anti-
  checklists, cross-refs at bottom, no emojis, plain markdown.

## How to use what was built

**Declare an incident:**

```
# 1. Post to #oncall in Slack:
INCIDENT: <one-line symptom>
Severity: Sev-1
Start: <when symptom began>
Responder: @<your handle>
Status: investigating

# 2. Open the IR ticket:
https://github.com/KaJLabs/Lithosphere/issues/new?template=incident.md

# 3. Page the right surface (Dev Infra / Validator Team / both per the
#    routing table in incident-response.md)
```

**Open a CAB ticket for a change:**

Use the template at `docs/governance/cab.md` — pre-CAB checklist + risk
assessment + voting + decision sections live in a single GitHub issue.
24h async comment window; emergency flow for hotfixes.

**Propose an RFC:**

```bash
cp docs/governance/rfc-template.md docs/governance/rfcs/0002-<slug>.md
# Edit. Open a PR. The PR review IS the RFC review.
```

**Run the quarterly governance pass:**

```bash
# 30-minute timebox. Walk docs/governance/documentation.md's table.
# For each row whose Last-reviewed is stale per the cadence column,
# either:
#   (a) Update content + bump Last-reviewed, or
#   (b) Touch only Last-reviewed with comment "audited, no changes needed"
# Open one PR with all the updates.
```

## Why it matters

- **Runbooks are insurance against personnel turnover.** The day the
  person who knows how to run a CAB ticket leaves, the runbook becomes
  the institutional memory. Cheap to maintain (quarterly pass); expensive
  to write under pressure during an incident.
- **Templates lock in shape early.** A PIR that uses the template has
  the same structure as every other PIR — searchable across years,
  comparable across incidents.
- **The doc registry catches rot before it bites.** A runbook that says
  to `argocd app rollback` will mislead an operator at 3am if no one
  has reviewed it since K8s was deleted. The triggered-review discipline
  + the quarterly pass surface the discrepancy.
- **Incident response without a runbook is improv theatre.** The hold-
  window discipline alone catches the most common Sev-1 failure (declare
  resolved on first sign of recovery, watch it flap, second declaration
  loses credibility).

## Files & commits

| Path | Purpose |
|------|---------|
| `docs/governance/rfc-template.md` | RFC shape |
| `docs/governance/pir-template.md` | Post-incident review shape |
| `docs/governance/rfcs/0001-release-trains.md` | Release cadence RFC |
| `docs/governance/release-calendar.md` | Rolling 4-train template |
| `docs/governance/cab.md` | CAB approvals runbook |
| `docs/governance/incident-response.md` | IR flow + comms templates |
| `docs/governance/documentation.md` | Meta-runbook + doc registry |
| `docs/governance/raci.md` | Role × decision matrix (P0) |
| `docs/governance/deployment-approvals.md` | Admin toggle reference |
| `.github/ISSUE_TEMPLATE/*` | 4 issue forms (bug, feature, incident, config) |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR checklist |

Commit chain: `5c40b72` (CAB), `25c7e20` (incident response + doc
governance meta-runbook). Earlier templates (RFC, PIR, issues) are
pre-existing.

## Deferred work

### Validator-team-blocked (NOT closable by Dev Infra)

- **RFC 0001 cadence sign-off**. The dev/staging/hotfix train cadence
  needs explicit agreement from the validator team because they own
  the on-call rotation and the deploy windows.
- **On-call rotation table in `release-calendar.md`**. Currently
  `_TBD_` placeholders. Lifts the moment rotation is agreed.

### Out-of-scope for Dev Infra

- **PagerDuty / Opsgenie wiring**. No formal pager today; on-call is
  `#oncall` Slack rotation only. Adequate for testnet scale.
- **Status page tooling** (StatusPage.io, Better Stack, etc.).
  `status.litho.ai` DNS record exists but no status-page service is
  wired. Currently informal Slack-only public comms during incidents.

### Closable follow-ups (low priority)

- **CI lint for last-reviewed markers.** A script that scans
  `docs/governance/**/*.md` for the marker, compares to the review
  cadence registry, and posts a list of stale docs as a CI annotation.
  Defer until enough docs are stale that the manual quarterly pass
  becomes expensive.
- **Per-doc CODEOWNERS routing.** Repo-wide CODEOWNERS today; per-doc
  ownership would auto-route reviews to the right human. Nice-to-have.
