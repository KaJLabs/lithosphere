/**
 * Audit logger — dedicated pino child for security-sensitive state changes.
 *
 * Every line carries `category: 'audit'` so Loki/Grafana (and any future
 * SIEM forwarder) can filter the audit stream cleanly without
 * mis-classifying operational `logger.info()` calls.
 *
 * What goes here:
 *   - Successful and rejected faucet claims (with reason)
 *   - Any future admin endpoints (role grants, config changes)
 *   - Validation rejections on privileged inputs
 *
 * What does NOT go here:
 *   - High-frequency operational events (request logs, EVM RPC failures,
 *     block-index progress) — those use the root `logger`.
 *   - On-chain state changes — those are captured by the indexer into
 *     Postgres and queryable via the REST API. Use this audit channel
 *     only for off-chain actions our API processes.
 *
 * Schema convention:
 *   audit.info({ action, actor?, ...details }, '<human-readable summary>')
 *
 * `action` is the durable filterable key (snake_case verb_object). `actor`
 * is the address or user id when known; omitted for anonymous calls.
 * Any additional fields are details specific to the action.
 *
 * Documented at docs/governance/audit-trail.md.
 */
import { logger } from './logger.js';

export const auditLogger = logger.child({ category: 'audit' });

/**
 * Catalog of audit actions emitted by the API. Listed here so the type
 * system catches typos at every call site — the action key is the
 * primary filter Loki queries on, so a typo silently breaks dashboards.
 */
export type AuditAction =
  | 'faucet_claim_success'
  | 'faucet_claim_rejected'
  | 'faucet_claim_upstream_failed'
  | 'thanos_signin';

export interface AuditFields {
  action: AuditAction;
  /** Address or principal performing the action. Optional for anonymous calls. */
  actor?: string;
  /** Free-form details specific to the action; kept structured for query-ability. */
  [key: string]: unknown;
}

/**
 * Emit an audit line. Lower-friction than `auditLogger.info({...}, msg)` —
 * forces the `action` field (otherwise easy to forget) and renders a
 * stable message format `[audit:<action>] <summary>`.
 */
export function audit(fields: AuditFields, summary: string): void {
  auditLogger.info(fields, `[audit:${fields.action}] ${summary}`);
}
