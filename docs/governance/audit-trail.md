# Audit trail

> Last reviewed: 2026-05-12 · Owner: Dev Infra · Linked phase: P10

How security-sensitive off-chain actions are recorded, where to find
them, and what filtering query to point a SIEM forwarder at.

---

## What is "an audit event"?

A pino log line emitted via `audit()` from `Makalu/api/src/lib/audit.ts`.
Distinguishing characteristics:

- Field `category: 'audit'` is set on every line (pino child binding)
- Field `action` is set to a value from the typed `AuditAction` union
- Field `actor` carries the address/principal when known
- `msg` starts with `[audit:<action>]` so a tail-the-log workflow
  surfaces them visually too

**Not audit-worthy** (don't put these in the audit channel):

- Operational events (request received, EVM RPC failed, block indexed)
  → use the root `logger`
- On-chain state changes (LEP100 transfers, validator rotations)
  → captured by the indexer into Postgres; queryable via the REST API
- Health checks, periodic refreshes
  → root `logger` at debug or info

The audit channel is for **off-chain actions our API processes that
could have security or compliance implications**.

---

## Current audit catalog

| `action` | When | `actor` | Other fields |
|----------|------|---------|--------------|
| `faucet_claim_success` | A faucet claim completed successfully upstream | EVM address (normalized) | `amount`, `assetId`, `txHash` |
| `faucet_claim_rejected` | API refused the claim before forwarding to the faucet service | EVM address (if known) | `reason` (one of: `missing_address`, `invalid_address_format`, `non_evm_address`, `invalid_amount`), plus reason-specific fields |
| `faucet_claim_upstream_failed` | The upstream faucet service returned non-2xx | EVM address | `status`, `message` (sanitized) |

Adding a new action is a two-step operation:

1. Extend `AuditAction` in `Makalu/api/src/lib/audit.ts` so the type
   system catches every call site
2. Add a row to the table above

Both steps are intentionally manual to keep the catalog tight.

---

## Finding audit lines in Loki

The standard Promtail/Loki ingest in `Makalu/infra/promtail-config.yaml`
parses each JSON log line and exposes every field as a label. Query
the audit stream by filtering on `category="audit"`:

```logql
{job="lithosphere-api"} | json | category="audit"
```

Drill into a single action class:

```logql
{job="lithosphere-api"} | json | category="audit" | action="faucet_claim_success"
```

Or query everything a specific address did:

```logql
{job="lithosphere-api"} | json | category="audit" | actor="0xabc..."
```

The observability runbook (`observability.md`) lists Grafana dashboard
panels — add `Audit Activity (last 1h)` using the first query above
when wiring this in.

---

## Retention

- **Loki bucket**: 30 days (current Promtail/Loki config). Audit lines
  are no different from other log lines at this layer.
- **SIEM forwarding**: not currently wired. The audit channel exists
  so that the day a SIEM lands, the forwarder is a one-query change:
  `{job=~"lithosphere-.+"} | json | category="audit"` ships only the
  audit stream, no operational noise.

If longer-retention archive is needed before a SIEM lands, the
pragmatic interim is an hourly Loki query exported to S3 — documented
under "Open follow-ups" below.

---

## Operator: investigating a flagged event

1. Get the request ID and timestamp from the user's report.
2. Pull the audit line:
   ```logql
   {job="lithosphere-api"} | json | category="audit" | requestId="<id>"
   ```
   `requestId` comes from the AsyncLocalStorage middleware
   (`Makalu/api/src/lib/logger.ts`); every audit line carries it
   because the audit logger is a pino child of the root logger, so
   the `mixin()` requestId stamping applies.
3. Cross-reference with the operational log for the same `requestId`
   to reconstruct the full request flow:
   ```logql
   {job="lithosphere-api"} | json | requestId="<id>"
   ```
4. If the action is `faucet_claim_upstream_failed`, also pull the
   faucet service's own logs at the matching timestamp.

---

## Open follow-ups (out of P10 ceiling)

- **SIEM destination**: out of scope per the phase tracker; the audit
  channel is in place so it's a one-query export the day a SIEM lands.
- **S3 archival pipeline**: a cron-driven Loki → S3 export filtered on
  `category=audit` would satisfy "audit trail for 1 year" compliance
  requirements without a full SIEM. Defer.
- **Admin endpoint audit coverage**: when admin endpoints land (role
  grants, config flips), wire them through `audit()` at definition
  time — the typed `AuditAction` union makes the call site fail to
  compile if you forget.
