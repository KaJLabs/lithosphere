# RACI Matrix — Lithosphere Service Operations

This document maps the recurring **decisions** that affect Lithosphere
service operations to the **roles** responsible for making them. It's the
"who decides what" reference an on-call engineer reaches for when an
incident, RFC review, or release-train cut needs a sign-off and the obvious
person isn't around.

If the obvious person IS around: ignore this document and ask them. The
matrix is a fallback, not a substitute for the human.

## Roles

| Role | Scope | Primary contact |
|------|-------|-----------------|
| **Dev Infra** | Service repos (api, indexer, explorer, faucet), CI/CD pipelines, SDK packages, observability stack, build + deploy tooling. | @bachal-abro |
| **Validator Team** | Chain validators, consensus participation, block production, slashing posture, governance proposals. | (rotation; lead via #oncall) |
| **Validator Infra Team** | Host infrastructure for validator + sentry nodes — DNS (`*.litho.ai`), TLS certs, nginx RPC routing, Prometheus/Loki/Grafana stack ownership at the VPS layer. | (rotation) |
| **Chain Team** | Cosmos SDK fork + EVM module + consensus engine (Linear Comm BFT). Block-time tuning, hard-fork upgrades, denomination changes. | (rotation) |
| **Security Lead** | Audit findings triage, key-rotation events, incident response sign-off, CVE response prioritisation, license-policy exceptions. | (rotation) |

Roles are functional, not headcounts — one person can wear several
hats simultaneously. The matrix below uses role names so the document
survives team turnover.

## Legend

- **R** — Responsible. Does the work (or directly oversees it).
- **A** — Accountable. Signs off; owns the outcome. **Exactly one A per row.**
- **C** — Consulted. Asked for input before action. Two-way conversation.
- **I** — Informed. Told after the fact (or alongside). One-way notification.

## Matrix

### Service operations

| Decision / activity | Dev Infra | Validator Team | Validator Infra | Chain Team | Security Lead |
|---|---|---|---|---|---|
| Deploy service change to testnet (Makalu)             | A,R | I   | I   | I   | I   |
| Deploy service change to a future mainnet             | R   | A   | C   | C   | C   |
| Cut a dev-train tag (RFC 0001)                        | A,R | I   | I   | I   | I   |
| Cut a staging-train tag                               | R   | A   | C   | I   | I   |
| Roll back a failed deploy                             | A,R | I   | I   | I   | I   |
| Hotfix outside the release calendar                   | A,R | I   | I   | I   | I   |
| Change `deploy-simple.yaml` (CD pipeline)             | A,R | C   | I   | I   | I   |
| Modify GitHub Environment protection rules            | R   | C   | I   | I   | A   |
| Update SDK npm release process                        | A,R | I   | I   | I   | I   |

### Chain operations

| Decision / activity | Dev Infra | Validator Team | Validator Infra | Chain Team | Security Lead |
|---|---|---|---|---|---|
| Promote a validator to live block production          | I   | A,R | C   | C   | I   |
| Decommission a validator (e.g. AWS 10.0.10.65 stale)  | I   | A,R | C   | C   | I   |
| Adjust `timeout_commit` or block-time params          | I   | C   | C   | A,R | I   |
| Cosmos chain-ID change (700777-1 → 700777-2 etc.)     | I   | C   | C   | A,R | C   |
| Hard-fork / consensus upgrade                         | C   | C   | C   | A,R | C   |
| Reset / re-seed a network                             | I   | A,R | C   | C   | I   |

### Infrastructure & networking

| Decision / activity | Dev Infra | Validator Team | Validator Infra | Chain Team | Security Lead |
|---|---|---|---|---|---|
| Add / change `*.litho.ai` DNS record                  | C   | I   | A,R | I   | I   |
| Issue / rotate TLS cert (Let's Encrypt + nginx)       | I   | I   | A,R | I   | C   |
| Open a new public RPC endpoint (e.g. evm-rpc)         | C   | C   | A,R | C   | C   |
| Expose a service to the internet via Traefik         | R   | I   | A   | I   | C   |
| Scale up VPS instance class (cost increase)           | C   | I   | A,R | I   | I   |
| Change Prometheus scrape targets or Loki config       | C   | I   | A,R | I   | I   |
| Add / remove Grafana dashboard                        | A,R | I   | C   | I   | I   |

### Security & supply chain

| Decision / activity | Dev Infra | Validator Team | Validator Infra | Chain Team | Security Lead |
|---|---|---|---|---|---|
| Triage a new HIGH/CRITICAL Trivy finding              | R   | I   | I   | I   | A   |
| Add a license-policy exception (`.license-policy.yaml`) | R | I   | I   | I   | A   |
| Add a flaky-test quarantine entry                     | A,R | I   | I   | I   | I   |
| Respond to a leaked-secret incident                   | C   | C   | C   | C   | A,R |
| Rotate signing / deployment / RPC keys                | R   | I   | C   | I   | A   |
| Add a new dependency under a non-allow-listed license | R   | I   | I   | I   | A   |
| Disclose a vulnerability publicly                     | C   | C   | C   | C   | A,R |

### Governance & change management

| Decision / activity | Dev Infra | Validator Team | Validator Infra | Chain Team | Security Lead |
|---|---|---|---|---|---|
| Author an RFC                                         | R   | R   | R   | R   | R   |
| Accept/reject an RFC                                  | C   | C   | C   | C   | C   |
| Sign off on the release-train cadence                 | C   | A,R | C   | I   | I   |
| Fill in the next on-call slot on the release calendar | R   | A   | I   | I   | I   |
| Update CODEOWNERS                                     | R   | C   | C   | C   | A   |
| Change PR-merge protection rules                      | R   | C   | I   | I   | A   |

> RFC authorship is intentionally `R` for every role: anyone can write
> one. Acceptance is `C` for every role because RFC acceptance happens
> through PR review with consensus, not single-role sign-off. If a future
> RFC genuinely deserves a single accountable role, the RFC itself
> should name them and override this default.

## Worked examples

**"A push to `main` broke the api. Can I roll back without paging the validator team?"**

→ "Roll back a failed deploy" row → Dev Infra is `A,R`. Validator Team is
`I`. Roll back now, post a message in #oncall after the fact. The
existing `rollback` job in `deploy-simple.yaml` already runs on
failure() so this is the auto path; the manual path is reverting the
offending commit on `main`.

**"A LinkedIn-tier security researcher reports an issue at `security@litho.ai`. Who runs point?"**

→ "Respond to a leaked-secret incident" / "Disclose a vulnerability
publicly" rows → Security Lead is `A,R`. They coordinate; Dev Infra +
Validator Team + Chain Team are `C` (consulted on technical detail).
Use the [PIR template](./pir-template.md) for the write-up.

**"`mtest-val-01` is drifting on `timeout_commit` again. Do I just `sed` it?"**

→ "Adjust `timeout_commit` or block-time params" row → Chain Team is
`A,R`. Validator Team is `C` (knows what's running). Dev Infra is `I`
(told after the fact so the SLO dashboard expectations align). Do NOT
edit live config without Chain Team sign-off — see the project memory
on the 2026-05-08 mtest-val-01 re-roll for the cautionary tale on
Ansible drift vs surgical edits.

**"A PR adds an `AGPL-3.0`-licensed dependency. Can it merge?"**

→ "Add a new dependency under a non-allow-listed license" row →
Security Lead is `A`. Dev Infra is `R` (will be the one to edit
`.license-policy.yaml` if approved). The `license-check` CI gate
already blocks the merge; the human review is for whether to swap
the dep, add an exception, or globally allow.

## Boundaries this matrix does NOT cover

- **Hiring / role changes.** Out of scope; tracked elsewhere.
- **Budget approvals beyond VPS scale-ups.** Owner-level decision.
- **Marketing / partner integrations.** Different organisational track.
- **Anything the chain team manages internally** — block-production
  algorithms, mempool policy, fee market design. The Chain Team row in
  the matrix is the *touchpoint*, not the full scope of their work.

## Maintenance

This document is updated by Dev Infra whenever a new recurring decision
emerges that doesn't map cleanly to an existing row. Pure renames
(e.g. "Validator Infra" → "Platform Engineering") are mechanical edits.
A new R/A/C/I distribution for an existing row requires sign-off from the
gaining and losing role's `A`.

Last reviewed: 2026-05-12 (initial draft).

## Related

- [Deployment Approvals runbook](./deployment-approvals.md) — the protection-rules layer behind every deploy-related decision in the matrix.
- [Release Calendar](./release-calendar.md) — the artifact populated by the Validator Team's `A` on release-train cadence.
- [RFC 0001 — Release Trains](./rfcs/0001-release-trains.md) — the proposal whose acceptance produced the calendar.
- [Test Quarantine runbook](./test-quarantine.md) — Dev Infra owned per the matrix.
- [License Policy runbook](./license-policy.md) — Security Lead is `A` on exceptions.
- [Key Rotation runbook](./key-rotation-runbook.md) — Security Lead-owned.
- [PIR template](./pir-template.md) — used for the incident-response cases above.
