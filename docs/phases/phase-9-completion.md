# Phase 9 — Observability & Correlation

> **Status:** **100% Dev-Infra ceiling** (2026-05-12). Build-info chain
> across all 3 services + full helper-level pino sweep + OTel SDK +
> HTTP request metrics + SLO + Cost dashboards. OTel collector deploy
> is a validator-team infra ticket (external blocker); explorer OTel
> re-deferred after f8109de broke 4 deploys via webpack/grpc-js.
>
> First written at ~90% on 2026-05-11. See [§ Updates](#updates-since-first-writing-2026-05-11)
> below for what shipped after.

## Updates since first writing (2026-05-11)

Six observability deltas between the original write-up and the
2026-05-12 ceiling close.

### HTTP request metrics + SLO dashboard (2026-05-11)

`Makalu/api/src/lib/http-metrics.ts` exposes:

- `litho_api_http_requests_total` (Counter)
- `litho_api_http_request_duration_seconds` (Histogram)

Labeled by `method` / `route` (Express normalized pattern, not raw URL —
keeps cardinality bounded) / `status_code`.

Grafana dashboard at `Makalu/infra/grafana/dashboards/slo.json` (uid
`lithosphere-slo`), 7 panels: 24h availability, 5m error rate, RPS,
indexer lag, p50/p95/p99 latency, status-class breakdown, build-info
table. 4 new metrics tests on api (138 total at the time).

### Cost dashboard (2026-05-11)

`Makalu/infra/grafana/dashboards/cost.json` (uid `lithosphere-cost`),
9 panels: budget stat (template variable), host CPU/memory/disk,
network egress/ingress timeseries, per-container CPU/memory timeseries,
"egress per 1k requests" marginal-cost proxy, resource-footprint
summary table. Pure analysis on the existing node-exporter + cAdvisor +
`litho_api_http_requests_total` metrics — no new scrape targets.

### Explorer build-info chain (2026-05-12)

`Makalu/explorer/lib/build-info.ts` + `Makalu/explorer/pages/api/version.ts`
(Pages-router handler beats the `/api/*` rewrite for the literal path)
surface the same `gitSha` / `buildTime` / `version` triple as api +
indexer. `deploy-simple.yaml` SHA-verify step hits all three `/version`
endpoints (explorer via `docker exec litho-explorer wget ... /api/version`)
and reports a three-row match table.

Lockfile note: explorer is intentionally NOT a workspace member, but
pnpm walks up to find `Makalu/pnpm-workspace.yaml` by default. The
committed `.npmrc` carries `ignore-workspace=true` so both local and
CI `pnpm install` operate on the explorer's own lockfile.

5 new build-info tests bring the explorer suite to 84 (was 79).

### Full helper-level pino sweep (2026-05-12)

`Makalu/api/src/routes.ts` (~30 `console.{error,warn}` call sites),
`Makalu/api/src/db.ts` (pg pool error handler), and every
`console.*` in `Makalu/indexer/src/mappings.ts` migrated to the
existing pino logger with structured fields:

```ts
// Before
console.error('[api] /blocks error:', err);

// After
logger.error({ err: err instanceof Error ? err.message : String(err) },
             '[api] /blocks error');
```

Loki ingests structured `err` / `height` / `evmHash` / `address` /
etc. as queryable JSON keys instead of free-form text.

`backfill-fee-collector.ts` intentionally keeps `console.*` — it's a
one-shot CLI invoked from a developer terminal where plain TTY output
beats JSON. Documented inline.

User-controlled values continue to flow through `sanitizeForLog()`
before interpolation, satisfying CodeQL's `js/log-injection` flow
analysis.

### Explorer OTel instrumentation — re-deferred (2026-05-12)

Attempted in `f8109de` via `instrumentation.ts` + `@opentelemetry/sdk-node`.
Broke 4 consecutive deploys (auto-rollback ran each time): Next.js's
webpack tries to bundle sdk-node's transitive dep `@grpc/grpc-js`
and fails on `Module not found: Can't resolve 'zlib'` (a Node built-
in). `experimental.serverComponentsExternalPackages` only covers
server components, not `instrumentation.ts`.

Path forward when revisited: switch to the lighter
`@opentelemetry/sdk-trace-node` (no grpc, no metrics) OR add a
webpack hook in `next.config.js` that externalizes `@opentelemetry/*`
+ `@grpc/grpc-js` AND ensures those packages are copied into the
Next standalone output's `node_modules/`. Reverted in `a9d2a6d`.

### Audit-trail emission (P10 overlap, 2026-05-12)

`Makalu/api/src/lib/audit.ts` adds a pino child with
`category: 'audit'` baked in so security-sensitive off-chain actions
(faucet claims, future admin endpoints) emit on a separate Loki-
filterable channel. Strictly P10's deliverable but uses the same
logger infrastructure this phase built.

The point-in-time content below describes the 2026-05-11 snapshot.

---

## What this phase covers

The work plan's Phase 9 acceptance criterion: an operator can pull on any
single thread — a Prometheus alert, a log line, a slow request — and trace
it back to the commit that produced the running binary.

Coming into this phase that wasn't possible. `/health` returned a hardcoded
`version: '1.0.0'`. Every container's `process.env` had no link back to git.
Every log was unstructured `console.log` output with no per-request context.
Zero OpenTelemetry packages anywhere. An incident responder traced
"production is broken" → "which commit?" by SSHing to the bastion and
running `git rev-parse HEAD` — a 2–3 step manual correlation.

Leaving the phase: three discoverability layers (build metadata, request
IDs, OTel spans) all wired end-to-end through CI → image → container →
runtime. Loki ingests the new JSON logs natively; Prometheus has a
`build_info` gauge to join metrics back to the deployed commit; the OTel
SDK no-ops until a collector is deployed (zero production runtime cost
today, zero service-code change required when one lands).

## What we built

### Build metadata propagation (commit `20f0233`)

The chain from `git push` to a running container now carries `GIT_SHA`,
`BUILD_TIME`, and `VERSION` at every step.

| Layer | What happens |
|-------|--------------|
| `publish-images.yaml` | Computes `build_time` (RFC 3339) and `version` (tag if pushed, `sha-<short>` otherwise) once per run. Passes all three as `--build-arg` to api + indexer + explorer image builds. |
| Dockerfiles | `ARG GIT_SHA / BUILD_TIME / VERSION` in the **runner** stage; promoted to `ENV` so they're visible to the running process. Emits OCI labels (`org.opencontainers.image.{revision,created,version,source,title}`) so `docker inspect` and the GHCR UI surface the chain. |
| `deploy-simple.yaml` | Captures `git rev-parse HEAD` right after `git clone --depth 1` (before the temp dir is removed) and writes `GIT_SHA / BUILD_TIME / VERSION` into the bastion's `.env`. Docker Compose threads the values through `build: { args }` so bastion-side rebuilds carry the same metadata. |
| `docker-compose.yaml` | Both build-time `args:` and runtime `environment:` pass the three vars to api, indexer, and explorer. |
| api / indexer | New `/version` endpoint returns `{service, gitSha, buildTime, version, nodeVersion, uptimeSec}`. `/health` now reads `version` from the env. New Prometheus gauges `litho_api_build_info` and `litho_indexer_build_info` (value = 1, labels carry the data — standard Prometheus build-info pattern). |

Helpers live at `Makalu/{api,indexer}/src/lib/build-info.ts` (independent
copies — the two packages ship as independent Docker images with no shared
workspace dep).

### Structured logging with request IDs (commit `8bf7fda`)

Replaces `console.log` with pino JSON output and wires per-request
correlation.

| Component | Purpose |
|-----------|---------|
| `Makalu/api/src/lib/logger.ts` | Root pino logger + `requestIdStore` (AsyncLocalStorage) + `resolveRequestId()` + `fetchWithRequestId()` |
| `Makalu/indexer/src/lib/logger.ts` | Root pino logger + `cycleIdStore` + `fetchWithCycleId()` |
| Request-ID middleware | Reads `X-Request-Id` from the client or generates a UUID. Echoes it back as a response header. Stores it in ALS so any downstream `await` sees the same id. Logs a `request_completed` line on response finish with `method`, `url`, `status`, `durationMs`. |
| Pino `mixin()` | Every log line in a request/cycle scope automatically includes `requestId` / `cycleId` — no arg-threading needed at call sites. |
| `fetchWithRequestId` | Wraps global `fetch` to inject the current `requestId` as `X-Request-Id` on outgoing calls. Caller can override with an explicit header. Falls through to plain `fetch` outside a request scope. |

JSON output is what Loki + Promtail (already running in `Makalu/infra/`)
ingest natively — flipping the format light up full-text search in Grafana
with zero infra changes.

**Migration scope**: highest-traffic logs (server startup,
`metrics_server_listening`, `request_completed`, `cycle_sync_range`,
`cycle_failed`, fatal) are switched. The long tail of helper-level
`console.log` calls in `routes.ts` / `litho.ts` is intentionally deferred —
it's mechanical work better done in small reviewable batches.

### OpenTelemetry SDK (commit `ebc449d`)

Env-gated on `OTEL_EXPORTER_OTLP_ENDPOINT`. Wired in both api and indexer.

| Aspect | Behaviour |
|--------|-----------|
| When env unset | SDK packages installed but never instantiated. Zero perf cost, no network calls, no transitive-package load on cold start (lazy-require keeps them off the import path). |
| When env set | `NodeSDK` starts with the standard auto-instrumentations pack (express, http, pg, fetch — fs and dns disabled as noise). Spans export via OTLP/HTTP to `${endpoint}/v1/traces`. |
| Span resource attributes | `service.name`, `service.version`, `litho.git_sha`, `litho.build_time` — so a slow trace in Jaeger/Tempo identifies the build that produced it. |
| Lifecycle | Idempotent (`startTracing()` no-ops if already started). Graceful shutdown on `SIGTERM` / `SIGINT` flushes remaining spans. |
| Wiring | `import './tracing.js'` is the very first import in `src/index.ts` / `src/mappings.ts`. Must precede `express` / `pg` / `fetch` imports so auto-instrumentation can patch them. |

The point of shipping this dormant: the moment a collector lands (Jaeger,
Tempo, or Grafana Cloud), no service-code change is required to start
producing traces.

### Documentation

- New runbook at [`docs/governance/observability.md`](../governance/observability.md):
  the three correlation layers, where to look first per incident type,
  worked examples for build-info / request-id / span lookups, a local-dev
  walkthrough with an OTel collector, and a glossary.
- This phase completion report, following the existing
  [`docs/phases/`](./README.md) pattern.

## How to use what was built

**See which commit is running in production:**

```bash
curl https://makalu.litho.ai/api/version
# { "service": "lithosphere-api", "gitSha": "ebc449d...", ... }
```

**Find every log line for a single request:**

```logql
{service="lithosphere-api"} | json | requestId = "abc-123"
```

(Once the helper-level migrations land — currently only the high-traffic
lifecycle logs carry `requestId` automatically. Adding more is a one-line
change per call site: `logger.info({ ... }, '...')` instead of `console.log`.)

**Compare deployed builds between services:**

```promql
litho_api_build_info or litho_indexer_build_info
```

If `git_sha` differs across services you have a partial deploy.

**Enable distributed tracing locally:**

```bash
docker run --rm -p 4318:4318 otel/opentelemetry-collector:latest
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 pnpm --filter @lithosphere/api dev
```

Full walkthrough in [observability.md § Running locally](../governance/observability.md#running-locally).

## Why it matters

- **Incident response is now a single curl.** "Which commit?" answered in
  one HTTP call instead of an SSH-and-`git log` dance. `/version` is on the
  same port the load balancer already exposes — no firewall changes needed.
- **Build-info gauges close the metrics-to-commit gap.** Today every
  Prometheus alert that fires has zero idea which build produced it.
  Post-Phase-9, `litho_*_build_info{}` is a one-line join from a metric to
  the deployed sha.
- **JSON logs unlock Loki immediately.** The Grafana stack already runs Loki
  and Promtail. Before this commit, log search was string-greps on
  unstructured `console.log`; after, it's structured queries on a JSON
  schema. Zero new infra.
- **Request IDs make user-reported bugs actionable.** A user with a 500
  page can include the `X-Request-Id` header (it's in their browser's
  network tab) and ops can grab the full log thread in one query.
- **OTel SDK is free insurance.** Wired now, off by default. The day a
  collector lands, distributed tracing is one env var away. Doing it later
  means another full deploy cycle for what could have been a config flip.
- **Loose coupling beats lock-in.** The SDK exports via standard OTLP/HTTP,
  meaning Jaeger / Tempo / Grafana Cloud / Datadog all accept it without
  code changes. We don't have to pick a vendor today to keep the option
  open.

## Files & commits

| Path | What |
|------|------|
| `.github/workflows/publish-images.yaml` | edit (build-args for GIT_SHA / BUILD_TIME / VERSION) |
| `.github/workflows/deploy-simple.yaml` | edit (capture SHA at clone, inject env on bastion) |
| `Makalu/api/Dockerfile` | edit (ARG + ENV + OCI labels) |
| `Makalu/indexer/Dockerfile` | edit (same) |
| `Makalu/explorer/Dockerfile` | edit (same — explorer also gets `/version` env) |
| `Makalu/docker-compose.yaml` | edit (`build: { args }` + `environment:` passthrough, OTEL + LOG_LEVEL vars) |
| `Makalu/api/package.json` | edit (pino, pino-http, six `@opentelemetry/*` packages) |
| `Makalu/indexer/package.json` | edit (pino, six `@opentelemetry/*` packages) |
| `Makalu/api/src/index.ts` | edit (`/version`, request-id middleware, request_completed log, top-of-file tracing import) |
| `Makalu/api/src/lib/build-info.ts` | create |
| `Makalu/api/src/lib/logger.ts` | create |
| `Makalu/api/src/tracing.ts` | create |
| `Makalu/api/src/__tests__/build-info.test.ts` | create (5 tests) |
| `Makalu/api/src/__tests__/logger.test.ts` | create (12 tests) |
| `Makalu/api/src/__tests__/tracing.test.ts` | create (2 tests) |
| `Makalu/indexer/src/mappings.ts` | edit (`/version`, cycleId scope around poll loop, top-of-file tracing import) |
| `Makalu/indexer/src/lib/build-info.ts` | create |
| `Makalu/indexer/src/lib/logger.ts` | create |
| `Makalu/indexer/src/tracing.ts` | create |
| `Makalu/indexer/src/__tests__/build-info.test.ts` | create (3 tests) |
| `docs/governance/observability.md` | create |
| `docs/phases/phase-9-completion.md` | create |
| `_sidebar.md` | edit (surface observability runbook + this report) |

Commits: `20f0233` (build metadata), `8bf7fda` (structured logging),
`ebc449d` (OpenTelemetry SDK), + this docs commit. **22 new tests**
(api +19, indexer +3) — total now 122 api + 41 indexer.

## Deferred work

- **OTel collector deployment.** Wiring is dormant until a receiver
  (Jaeger / Tempo / Grafana Cloud / Datadog) is stood up. Likely
  validator-team coordinated — runs alongside Prometheus + Loki on the
  VPS or in a dedicated container. Separate ticket.
- **SLO + cost dashboards.** The work-plan's Phase 9 lists both. They're
  analysis layers on top of metrics we already collect; deferred.
- **Helper-level `console.log` → `logger` migration.** This phase ships
  enough call sites (lifecycle + cycle + startup) to prove the pattern
  and unblock Loki queries. The long tail (`routes.ts`, `litho.ts`,
  `mappings.ts`) is mechanical and best done in small batches.
- **Explorer (Next.js) instrumentation.** Server-side tracing in Next
  uses an `instrumentation.ts` register pattern, not the NodeSDK pattern.
  Out of scope for this phase. `/version` env vars ARE propagated (so the
  UI can display the deployed build), but no span emission.
- **Promoting OTel from advisory to production-required.** Once a
  collector is deployed and we have signal on what cardinality / cost
  looks like in steady state, we can flip from "env-gated, off in prod"
  to "always on, sampling configured."
