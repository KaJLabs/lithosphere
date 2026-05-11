# Post-Incident Review: <Incident Title>

| | |
|-|-|
| **Incident ID**       | INC-YYYYMMDD-NNN |
| **Severity**          | SEV1 / SEV2 / SEV3 |
| **Status**            | Draft / In Review / Final |
| **Author**            | @your-handle |
| **Reviewers**         | @reviewer1, @reviewer2 |
| **Incident Start**    | YYYY-MM-DD HH:MM UTC |
| **Incident Resolved** | YYYY-MM-DD HH:MM UTC |
| **PIR Due**           | YYYY-MM-DD (≤ 5 business days post-resolution) |
| **Detection Source**  | Alert / User report / Internal observation |

> **Blameless principle**: this document analyses systems and decisions, not people. Phrasing should describe what the system enabled, not who failed.

## Incident Summary

Two or three sentences a stakeholder can read in 30 seconds: what broke, who was affected, how long, how it was resolved.

## Impact

- **Users affected**: <count or %>
- **Duration of impact**: <minutes>
- **SLO budget consumed**: <% of monthly error budget>
- **Revenue / business impact**: <if applicable>
- **Reputational / partner impact**: <if applicable>
- **Data loss or corruption**: <yes / no, scope>

## Timeline

All times UTC. Include detection, escalation, mitigation, recovery, communications. Aim for granularity of every meaningful event.

| Time   | Event                                                         | Actor             |
|--------|---------------------------------------------------------------|-------------------|
| 14:02  | Latency p95 alert fires on `api-monitoring` dashboard         | Alertmanager      |
| 14:04  | Oncall acknowledges, begins triage                            | @oncall           |
| 14:09  | Identifies indexer pool exhaustion as proximate cause         | @oncall           |
| 14:14  | Rolls back indexer to previous image tag                      | @oncall           |
| 14:16  | Latency recovers                                              | —                 |
| 14:20  | Status page incident closed                                   | @oncall           |

## Root Cause

The **technical** root cause, plus the **organisational / process** root cause if different. Use the "Five Whys" if it helps surface deeper issues, but the writeup should be prose, not a literal numbered list.

## Detection

- How was the incident detected?
- Time-to-detection (TTD) from first symptom to first alert/report.
- Was monitoring sufficient? If not, what was missing?

## Resolution

- Immediate mitigation that stopped customer impact.
- Permanent fix (link to PR if merged, RFC if scoped).
- Did the rollback / mitigation introduce its own risk?

## What Went Well

- Tools, processes, decisions that worked. Document so we don't accidentally regress.

## What Went Poorly

- Where time was lost, where confusion arose, where tooling failed. Be specific.

## Action Items

Each action: owner, due date, tracking issue. Action items must close — track in the same ticket system as features.

| # | Action                                                    | Type        | Owner       | Due        | Issue   |
|---|-----------------------------------------------------------|-------------|-------------|------------|---------|
| 1 | Add saturation alert on indexer DB pool                   | Prevention  | @platform   | 2026-XX-XX | #NNNN   |
| 2 | Document indexer rollback runbook                         | Mitigation  | @docs       | 2026-XX-XX | #NNNN   |
| 3 | Add chaos test for indexer pool exhaustion                | Detection   | @qa         | 2026-XX-XX | #NNNN   |

Action types:
- **Prevention** — stops a recurrence.
- **Detection** — surfaces it faster next time.
- **Mitigation** — reduces blast radius if it happens again.
- **Process** — improves how we respond.

## Lessons Learned

The strategic takeaway, beyond the action items. What does this incident say about our priorities, architecture, or staffing? One or two paragraphs.

## Supporting Evidence

- Links to dashboards (with time range fixed)
- Log excerpts (redacted if needed)
- Slack thread permalinks
- Affected PRs / commits
