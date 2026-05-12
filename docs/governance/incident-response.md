# Incident response

> Last reviewed: 2026-05-12 · Owner: Dev Infra + Validator Team · Linked phase: P11

How we declare, coordinate, and resolve outages. Pairs with the
PIR (post-incident review) template — every Sev-1/Sev-2 gets one.

This runbook is the **operational** flow. For organizational decisions
made *between* incidents (release cadence, CAB approvals, deployment
windows), see `release-calendar.md`, `cab.md`, and
`rfcs/0001-release-trains.md`.

---

## Severity levels

| Sev | Definition | Examples | Response time |
|-----|------------|----------|---------------|
| **Sev-1** | User-facing outage; chain is producing blocks but explorer/api/rpc is unreachable, OR consensus has halted | `api.litho.ai` returning 5xx for >5 min; explorer 502; chain hasn't advanced in >10 blocks | Page Dev Infra + Validator Team simultaneously |
| **Sev-2** | Functional degradation; service is up but a major surface is broken | EVM tx submission failing; explorer returns stale blocks; SLO error budget burned through | Page on-call within 15 min |
| **Sev-3** | Visible but narrow issue; affects a single endpoint or a single dashboard | One Grafana panel showing N/A; faucet upstream flaky; one validator slashed | Open GitHub Issue, acknowledge within 1 business day |
| **Sev-4** | Cosmetic, no functional impact | Wrong copy on explorer; minor log noise; outdated screenshot in docs | Standard PR backlog |

The IC (incident commander, see below) can upgrade or downgrade severity
during the incident; document the decision in the IR ticket.

---

## Declare flow (Sev-1 / Sev-2)

The first responder takes these steps in order. Don't wait for permission
to declare — false-positive declarations are recoverable; missed
declarations aren't.

### 1. Acknowledge

In `#oncall` (Slack):

```
INCIDENT: <one-line symptom>
Severity: Sev-1
Start: <when symptom began, not when you noticed>
Responder: @<your handle>
Status: investigating
```

A skeleton message in the first 60 seconds is more useful than a polished
one in 5 minutes.

### 2. Open the IR ticket

Use the `incident.md` GitHub issue template. The template enforces the
right shape: symptom, severity, timestamp, suspected blast radius,
links to dashboards.

URL: `https://github.com/KaJLabs/Lithosphere/issues/new?template=incident.md`

Tag the issue with `incident` + the severity label (`sev-1`, `sev-2`).
Pin the issue number into the Slack thread so all communication
references the same ID.

### 3. Page the right surface

| Symptom | Page |
|---------|------|
| `api.litho.ai` / `explorer` / `rpc.litho.ai` 5xx | **Dev Infra on-call** |
| Chain halted / forked / validator slashed | **Validator Team on-call** |
| Both simultaneously | Page both; assume coordinated incident |

On-call rotation is documented in `release-calendar.md` (currently
`_TBD_` pending validator-team sign-off — see open follow-up).

### 4. Pick an Incident Commander (IC)

The first responder is the default IC until someone explicitly takes
over. IC owns the ticket: cadence updates, calling severity changes,
deciding when to bring more people in, calling resolved.

**The IC does NOT have to fix the bug.** IC coordinates; engineers
investigate. If you're holding a debugger AND running comms, hand off
the IC role to someone who can focus on comms.

### 5. Start the running log

The IR ticket comment thread is the running log. Every meaningful action
gets a comment with an ISO-8601 timestamp prefix:

```
2026-05-12T15:42:00Z — Restarted litho-api. Health check now returning 200.
2026-05-12T15:43:00Z — Confirmed via grafana panel `api_http_request_duration_p95` recovered to <500ms.
2026-05-12T15:50:00Z — Holding for 10 min to confirm no flapping.
```

The log is the PIR source material. If it's not in the log, it didn't
happen.

---

## Triage (during incident)

### Where to look first

See [`observability.md`](observability.md) for the full three-layer
correlation walkthrough. The TL;DR routing:

| Symptom class | First panel |
|---------------|-------------|
| API 5xx | Grafana → SLO dashboard (`lithosphere-slo`), then Loki on `lithosphere-api` |
| Indexer lag | Grafana → `litho_indexer_chain_lag_blocks`, then Loki on `lithosphere-indexer` filtered by `cycleId` |
| Chain halted | Cosmos RPC `/status` on each validator/sentry; bypass our stack entirely if needed |
| Explorer 502 | Same as API 5xx — the explorer is upstream of api via Nginx |
| Suspected security event | `category=audit` Loki filter (see `audit-trail.md`) |

### Communication cadence

| Severity | Update cadence |
|----------|----------------|
| Sev-1 | Every 15 minutes in `#oncall`, every 30 minutes in `#general` |
| Sev-2 | Every 30 minutes in `#oncall` |
| Sev-3 | Daily summary in the GitHub issue |

If there's nothing new to say, post "no change, still investigating
<thing>." Silence is worse than redundancy.

---

## Resolve

Don't declare resolved on the first signs of recovery. Hold for a
verification window:

| Severity | Hold time after symptom clears |
|----------|--------------------------------|
| Sev-1 | 30 minutes |
| Sev-2 | 15 minutes |
| Sev-3 | None (verify and close) |

The hold catches flapping. Many "fixed" incidents bounce back within
10 minutes.

When you declare resolved:

1. Post in `#oncall`:
   ```
   RESOLVED: <ticket URL>
   Cause: <one-line>
   Verification: <how you confirmed>
   PIR: scheduled for <date>
   ```
2. Update the GitHub issue: add `incident-resolved` label, summary
   comment, link to the PIR ticket (next step).
3. **Open the PIR ticket immediately**, even if the PIR itself isn't
   for a few days. Use `pir-template.md`. The PIR ticket is where the
   investigation notes live going forward; the incident ticket is
   sealed.

---

## Post-incident review (PIR)

Required for Sev-1 and Sev-2. Optional but encouraged for Sev-3 if
the root cause is non-obvious.

Cadence: PIR meeting within **5 business days** of resolution. Late
PIRs lose context fast — the longer between incident and review, the
more "I don't remember" answers in the doc.

Use `pir-template.md`. Key fields the template enforces:

- Timeline (copy-pasted from the IR ticket's running log)
- Root cause (the actual one, not the proximate symptom)
- What went well
- What went poorly
- Action items (with owner + due date)

The PIR is a no-blame artifact. Names appear only in the running log
attribution, not in the "what went poorly" section. Process bugs
get fixed via action items; people bugs get fixed via 1:1s, not via
the PIR.

---

## Comms templates

### Status-page update (Sev-1)

```
We are investigating reports of <symptom>. <Affected surface>.
Last updated: <UTC>.
```

Refresh every 15 minutes. Resolve with:

```
Resolved <UTC>. Root cause: <one-line> (full PIR will follow).
```

### Customer message (Sev-1, if applicable)

Reserved for outages affecting integrators. Default position: no
direct customer comms until resolved + initial root cause known.
Public status-page is the canonical communication surface.

### Internal Slack #general update

```
[INCIDENT Sev-1] Investigating <symptom>. Tracker: <issue URL>.
Updates in #oncall every 15 min.
```

Post once at declaration, once at resolution. Don't spam #general
with status pings — that's #oncall's job.

---

## Anti-checklist

- ❌ Don't fix the bug before declaring. Declare first, fix second.
- ❌ Don't make IC the engineer holding the debugger. Split the roles.
- ❌ Don't resolve without the hold window. Flapping is real.
- ❌ Don't skip the PIR because "we already know the cause." The PIR's
  job is to extract action items, not to find the cause.
- ❌ Don't name-and-shame in the PIR doc. The running log has names;
  the PIR has process gaps.
- ❌ Don't close the incident ticket without opening the PIR ticket.
  The pair stays linked.

---

## Cross-references

- `pir-template.md` — the PIR doc template
- `observability.md` — Grafana / Loki / OTel walkthrough used during
  triage
- `audit-trail.md` — Loki audit-channel query for security-flagged
  incidents
- `raci.md` — who has R/A/C/I on incident-class decisions (chain
  parameter changes, deployment freezes, public comms)
- `release-calendar.md` — current on-call rotation (or `_TBD_`)
- `key-rotation-runbook.md` — when an incident involves credential
  compromise
- `cab.md` — when a fix requires deploy-side approval mid-incident
  (emergency CAB)

---

## Open follow-ups

- **On-call rotation table**: `release-calendar.md` carries `_TBD_`
  placeholders. Validator team sign-off pending on RFC 0001.
- **Status page**: there's a `status.litho.ai` DNS record but no
  status-page tooling wired (StatusPage.io, Better Stack, etc.).
  Currently informal Slack-only comms.
- **PagerDuty / Opsgenie wiring**: no formal pager today; on-call is
  `#oncall` Slack rotation only. Adequate for testnet scale.
