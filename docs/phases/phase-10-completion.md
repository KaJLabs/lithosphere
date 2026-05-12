# Phase 10 — Security, Compliance & Supply Chain

> **Status:** 100% Dev-Infra ceiling (2026-05-12). AWS OIDC + Cosign + SBOM
> + Trivy + CodeQL + SLSA Build L2 + license policy + npm-strip + key
> rotation runbook + audit-trail emission all shipped. SIEM destination
> stays out-of-scope per the project's Out-of-Scope table.

## What this phase covers

Take the project from "we ship containers and hope they're not vulnerable"
to "every artifact is signed, attested, scanned, license-checked, SAST-
analysed, and every off-chain privileged action emits a structured audit
event." Plus the runbooks the operator needs the day a key rotates or a
CVE lands.

## What we built

### Defense-in-depth layer cake

| Layer | Tool | Where | Gate |
|-------|------|-------|------|
| Secret scanning | gitleaks | `ci.yaml` Secret Scan job | blocking on push |
| Source SAST | CodeQL | `codeql.yaml`, weekly cron + every PR | findings to Security tab |
| Container CVE scan | Trivy | `publish-images.yaml` | CRITICAL blocks; HIGH visibility-only |
| Solidity SAST | Slither | `ci-contracts.yaml` (production + template) | blocking with `fail_on: high` |
| License policy | `scripts/check-licenses.mjs` | `ci.yaml` License Check | blocking |
| Image signing | Cosign (keyless) | `release.yaml` + `publish-images.yaml` | required for prod pull |
| Build provenance | SLSA L2 (`actions/attest-build-provenance@v2`) | `publish-images.yaml` | verifiable via `gh attestation verify` |
| Deploy-side verify | Cosign + `gh attestation verify` | `deploy-simple.yaml` | per-service result in summary table |
| npm provenance | `npm publish --provenance` | `release.yaml` `publish_npm` | links every release to the exact CI run |
| Audit trail emission | pino child `category: 'audit'` | `Makalu/api/src/lib/audit.ts` | structured Loki-filterable lines |

No single layer catches everything; together they cover the OWASP top-10
+ supply-chain attack classes documented in SLSA.

### CodeQL first-scan triage (23 → 0)

CodeQL's first run flagged 23 alerts. Over two triage passes (commits
`ae2c0c7` + `5201549`) they all closed:

- **10 fixed at source** — including 2 CRITICAL `js/request-forgery` (one
  with a real fix: post-resolution origin allow-list at
  `Makalu/api/src/index.ts:86`), 2 HIGH `js/polynomial-redos` in the indexer
  (regex replaced with non-regex), and 6 NOTE-level unused-locals.
- **13 dismissed as false positives** with audit comments — mostly
  `js/log-injection` where CodeQL's local-flow analysis can't trace the
  `sanitizeForLog()` helper, and `js/xss-through-dom` on `router.push()`
  where there is no `dangerouslySetInnerHTML` anywhere in the destination
  components (audit-confirmed by grep).

The triage workflow is documented in `docs/governance/supply-chain.md`
under "Triage workflow for CodeQL findings": fix / dismiss-with-comment /
track-as-work, weekly cadence aligned with the cron.

### npm CVE strip (issue #14)

Production runners shipped with the full npm CLI baked in (11+ HIGH CVEs
across `node:20-alpine`). The runner stages don't need npm — pnpm-installed
deps run via `node` directly. Strip step in each Dockerfile:

```dockerfile
RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/bin/{npm,npx} \
           /opt/yarn-v*
```

Trivy delta: api 11→0 HIGH, indexer 11→0, explorer 14→3 (the residual 3
are explorer app deps — Next.js 14→15 + coinbase-wallet-sdk minor —
tracked in issue #15).

### License allow/deny policy

`.license-policy.yaml` defines 11 allowed + 14 denied license SPDX
identifiers plus per-package exceptions. `scripts/check-licenses.mjs`
spawns `pnpm licenses list --json --prod` and evaluates every prod
package; the `license-check` CI job runs it on every PR.

Currently: **541 prod packages scanned, 1 granted exception**
(caniuse-lite CC-BY-4.0 — data file, not code).

Hand-parsed YAML (same pattern as `scripts/process-test-results.mjs`) so
the gate has no transitive deps that would themselves need policy
checking.

### Audit trail emission

`Makalu/api/src/lib/audit.ts` exposes:

```ts
audit({ action, actor?, ...details }, summary): void
```

backed by a pino child logger with `category: 'audit'` baked into the
child bindings. Typed `AuditAction` union (currently 3 actions:
`faucet_claim_success`, `faucet_claim_rejected`,
`faucet_claim_upstream_failed`) catches typos at every call site.

Wired into `Makalu/api/src/routes.ts` at the 4 faucet decision points.
Operational `logger.warn/error` calls kept alongside — different concerns,
different consumers.

Loki filter to extract the audit stream:

```logql
{job="lithosphere-api"} | json | category="audit"
```

## How to use what was built

**Verify an image's signature + build provenance:**

```bash
IMAGE=ghcr.io/kajlabs/lithosphere-api:sha-$(git rev-parse --short HEAD)
cosign verify \
  --certificate-identity-regexp '^https://github\.com/KaJLabs/Lithosphere/' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  $IMAGE
gh attestation verify oci://$IMAGE --owner KaJLabs
```

**Triage a CodeQL alert:**

1. Open Security → Code scanning → filter by `tool:CodeQL`.
2. Apply the three-way classifier from `supply-chain.md`:
   fix / dismiss-with-comment / track-as-work.
3. If dismissing, the comment is required reading for the next triage
   pass — explain why the analyzer is wrong.

**Add a new audit action:**

```ts
// 1) Extend the union in Makalu/api/src/lib/audit.ts
export type AuditAction =
  | 'faucet_claim_success'
  | 'faucet_claim_rejected'
  | 'faucet_claim_upstream_failed'
  | 'admin_role_granted';   // new

// 2) Call it
audit({ action: 'admin_role_granted', actor, role, target }, 'role granted');

// 3) Add a row to docs/governance/audit-trail.md catalog table.
```

The typed union forces all three steps; you can't ship a new audit
event without touching the doc (because the catalog table key is the
action name).

**Investigate a flagged audit event:**

```logql
# Pull the audit line
{job="lithosphere-api"} | json | category="audit" | requestId="<id>"
# Cross-reference with the operational log for the same request
{job="lithosphere-api"} | json | requestId="<id>"
```

The `requestId` carries across because the audit logger is a pino child
of the root logger — AsyncLocalStorage middleware stamps it.

## Why it matters

- **Defense in depth catches the bugs a single tool misses.** Trivy doesn't
  see SQL injection; CodeQL doesn't see CVE chains in transitive deps;
  Slither doesn't see either. Layering means one weak detector doesn't
  drop the floor.
- **Signed + attested images are non-negotiable for any prod-targeting
  deploy.** Cosign proves provenance of the image content; SLSA L2 proves
  provenance of the build process. The deploy-side verify step turns both
  into pass/fail signals before the image runs.
- **License policy is the cheapest insurance.** A copyleft package
  pulled in transitively can force open-source obligations on the whole
  SDK. The 5-minute CI job prevents the year-long lawyer engagement.
- **Audit emission ahead of SIEM** means the day a SIEM lands, the
  forwarder is a one-query change (`category=audit` filter). No code
  rollout, no instrumentation backfill.

## Files & commits

| Path | Purpose |
|------|---------|
| `.github/workflows/codeql.yaml` | SAST runner |
| `.github/workflows/ci.yaml` (license-check job) | Policy enforcement |
| `.github/workflows/publish-images.yaml` | Trivy + Cosign + SLSA attest |
| `Makalu/api/src/lib/audit.ts` | Audit logger + typed union |
| `Makalu/api/src/routes.ts` (faucet handlers) | 4 audit call sites |
| `.license-policy.yaml` | Allow/deny + exceptions |
| `scripts/check-licenses.mjs` | Policy evaluator |
| `docs/governance/supply-chain.md` | Verification + triage UX |
| `docs/governance/audit-trail.md` | Audit catalog + Loki queries |
| `docs/governance/key-rotation-runbook.md` | Cosign/npm/AWS OIDC rotation |
| `docs/governance/license-policy.md` | Allow/deny rationale + exception process |

Commit chain: `1ccc603` (Trivy), `af4a18d` (npm strip), `ae2c0c7` + `5201549`
(CodeQL triage), `8111e19` + `04ba66d` (Slither blocking flip), `5f7499b`
(audit trail).

## Deferred work

### Architecturally out-of-scope (NOT closable by Dev Infra)

- **SIEM destination.** Listed under Out-of-Scope ("Enterprise requirement,
  premature for testnet"). The audit channel is wired so the SIEM-when-it-
  lands export is a single Loki query change, not a code rollout.

### Closable but deferred (low priority / low ROI)

- **Snyk / GitHub Advanced Security private vuln database**. Trivy +
  CodeQL cover the same surface for public sources; the marginal value
  doesn't justify the cost yet.
- **Policy as code (OPA / Conftest)**. Today the policy is encoded in
  `scripts/check-licenses.mjs` and `slither.config.json`. OPA would
  generalize but adds an OPA-runtime dep with its own CVE surface;
  defer until policy complexity demands it.
- **S3 archival pipeline for audit logs**. Cron-driven Loki→S3 export
  filtered on `category=audit` would satisfy 1-year compliance retention
  without a full SIEM. Defer until a compliance ask arrives.

### Pending issue tracking

- **Issue #15**: explorer Next.js 14→15 major bump to close residual HIGH
  alerts. Risky bump; deferred to a focused session.
