# RFC: <Title>

| | |
|-|-|
| **Status**       | Draft / In Review / Accepted / Rejected / Superseded |
| **Author(s)**    | @your-handle |
| **Sponsor**      | @approver-handle |
| **Created**      | YYYY-MM-DD |
| **Last Updated** | YYYY-MM-DD |
| **Discussion**   | <link to PR or issue> |
| **Supersedes**   | <prior RFC, if any> |

## Summary

One paragraph (≤ 5 sentences) describing the proposal as if you were pitching it to a colleague at the whiteboard. A reader who only reads this section should understand **what** and **why**, but not necessarily **how**.

## Motivation

Why does this change need to happen? What problem does it solve? Include:

- The status quo and its failure mode (with a specific incident, metric, or pain point — not a hypothetical).
- Who is affected (users, validators, dev infra, partners).
- The cost of inaction.

## Goals & Non-Goals

**Goals**
- Concrete, measurable outcomes this RFC commits to delivering.

**Non-Goals**
- Adjacent problems intentionally excluded from this RFC. Naming them prevents scope creep in review.

## Detailed Design

The body of the RFC. Required sub-sections:

### Architecture

Component diagram (mermaid or link to drawio). Identify new components, modified components, deleted components.

### Data Model / Schema Changes

- Tables, columns, indexes added/changed/removed.
- Migration strategy (online vs offline; backfill plan).
- Backwards compatibility.

### API / Interface Changes

- New endpoints, deprecated endpoints, breaking changes.
- SDK impact.
- Versioning approach.

### Operational Considerations

- New runtime dependencies (services, env vars, secrets).
- Resource impact (CPU, memory, storage, network).
- Observability hooks (metrics, traces, logs added).
- Failure modes and recovery.

### Security & Privacy

- Threat model deltas.
- New attack surfaces.
- Compliance impact (audit trail, data residency, PII).

## Alternatives Considered

For each alternative: one sentence describing it, then one sentence on why it was rejected. Reviewers will ask if missing — pre-empt by listing 2–3.

## Drawbacks

Why might this be a bad idea? Be honest. Reviewers trust RFCs more when authors acknowledge real tradeoffs.

## Rollout Plan

- Feature flag (default off → canary → 100%)? Direct release?
- Migration triggers and rollback criteria.
- Environments: devnet → staging → mainnet timeline.
- Owner for each phase.

## Unresolved Questions

Open questions that should be resolved **before** acceptance, not deferred to implementation. Each question gets a checkbox.

- [ ] Question 1
- [ ] Question 2

## Success Metrics

How will we know this worked, 30 days after rollout? Concrete metric + threshold per goal listed above.

## References

- Linked tickets, prior RFCs, external standards (EIPs, RFCs), papers.
