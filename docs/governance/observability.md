# Observability & Correlation Runbook

Three layers of correlation tie an alert, log line, or user-reported request
back to the commit that produced the running binary:

1. **Build** — every image carries the git SHA, build time, and version as
   runtime env vars and OCI labels. `/version` and a Prometheus `build_info`
   gauge surface them.
2. **Request** — the api stamps every incoming HTTP request with an
   `X-Request-Id` (caller-provided or generated UUID), stored in an
   `AsyncLocalStorage` so every log line in the request scope carries it.
   `fetchWithRequestId` propagates it to downstream services.
3. **Span** — `@opentelemetry/sdk-node` is wired into both api and indexer.
   Spans are emitted when `OTEL_EXPORTER_OTLP_ENDPOINT` is set; otherwise the
   SDK no-ops with zero runtime cost.

This document is the operational guide. Read top-to-bottom the first time;
skip to **§ Where to look first** when an incident lands.

## Where to look first

### "Production is broken — which commit?"

```bash
curl https://makalu.litho.ai/api/version
# { "service": "lithosphere-api",
#   "gitSha": "ebc449d...", "buildTime": "2026-05-11T19:42:13Z",
#   "version": "sha-ebc449d", "nodeVersion": "v20.x", "uptimeSec": 84 }
```

`gitSha` is the answer. Cross-reference with `git log` to see exactly what
landed since the last known-good `/version` snapshot.

### "Which version is each service running?"

Open Grafana → **Build Info** panel on the overview dashboard. PromQL:

```promql
litho_api_build_info{} or litho_indexer_build_info{}
```

The gauge value is always 1; the labels (`git_sha`, `build_time`, `version`,
`node_version`) carry the data. If api and indexer show different `git_sha`,
you have a partial deploy — investigate the failing service.

### "User reported a 500. What happened?"

If they include the `X-Request-Id` header from their bug report:

```logql
{service="lithosphere-api"} | json | requestId = "abc-123"
```

You get every log line for that request, including db queries (when those
sites are migrated to `logger`) and downstream `fetchWithRequestId` calls
(which propagate the same id to the indexer / Cosmos RPC).

If they did *not* include the header but you have an approximate timestamp,
filter by `url` and time range first to narrow to candidates, then pull
`requestId` from the matching `request_completed` log to grab the rest.

### "A particular request was slow — what did it spend time on?"

If `OTEL_EXPORTER_OTLP_ENDPOINT` is set and a collector is receiving spans,
open Jaeger/Tempo and filter by the same `requestId` (carried as a span
attribute by the OTel http auto-instrumentation). You'll see the full
request waterfall: middleware → handler → db → outbound HTTP.

Without a collector deployed: this view is unavailable. Use the `durationMs`
field on the `request_completed` log line for a coarse number and isolate
deeper by reading the handler code.

## The three layers, in detail

### 1. Build metadata

**Injected at**: `docker build` time by `publish-images.yaml` (build-args
`GIT_SHA=${{ github.sha }}`, `BUILD_TIME`, `VERSION`) and by
`deploy-simple.yaml` (`git rev-parse HEAD` of the cloned source).

**Surfaced at**:

- `GET /version` on api (`:4000`) and indexer (`:3001`) — JSON with
  `gitSha`, `buildTime`, `version`, `nodeVersion`, `uptimeSec`.
- `GET /health` on api — `version` field now reads from the env (was
  hardcoded `'1.0.0'` pre-Phase-9).
- Prometheus: `litho_api_build_info` / `litho_indexer_build_info` gauges.
- OCI labels on the image: `org.opencontainers.image.revision`, `.created`,
  `.version`, `.source`, `.title`. Visible via `docker inspect` and on the
  GHCR package page.

**Read it from code**: `readBuildInfo()` in
`Makalu/{api,indexer}/src/lib/build-info.ts`. Both packages keep an
independent copy — they ship as independent Docker images with no shared
workspace dep.

### 2. Request IDs

**Generated at**: the api's request-ID middleware in `Makalu/api/src/index.ts`.
Reads `X-Request-Id` from the incoming request; falls back to
`crypto.randomUUID()`.

**Propagated by**:

- Pino `mixin()` — every `logger.info(...)` / `logger.error(...)` inside a
  request scope automatically includes `requestId` in its JSON output.
- `fetchWithRequestId()` from `Makalu/api/src/lib/logger.ts` — wraps global
  `fetch`, injects the current `requestId` as `X-Request-Id` on outgoing
  calls. Use this instead of bare `fetch` in route handlers when you want
  the trace to cross service boundaries.
- Response header — every response echoes `X-Request-Id`, so clients can
  include it in bug reports without server-side log digging.

**Indexer side**: not request-driven. Each polling iteration generates a
`cycleId` (also a UUID) and wraps its work in `cycleIdStore.run(...)`. Logs
from a single cycle group together by `cycleId`. `fetchWithCycleId()` is the
indexer's equivalent of `fetchWithRequestId` for outgoing RPC calls.

**Migration status**: the highest-traffic logs (request lifecycle, indexer
cycle start/error/fatal, server startup) are switched to pino. Helper-level
`console.log` calls in `routes.ts`, `litho.ts`, and `mappings.ts` are
intentionally left for a follow-up — converting them is mechanical and
better done in small reviewable batches.

### 3. OpenTelemetry tracing

**Wired at**: `Makalu/api/src/tracing.ts` and `Makalu/indexer/src/tracing.ts`,
imported as side-effect at the very top of `index.ts` / `mappings.ts`.

**Enabled by**: setting `OTEL_EXPORTER_OTLP_ENDPOINT` to your collector URL.
Example values:

- `http://localhost:4318` — local OTel collector (see § Running locally)
- `http://tempo.litho.internal:4318` — production (hypothetical, not yet
  deployed)

When unset (production today), the entire OTel stack is dormant — no
spans, no exporter connections, no perf cost. The SDK packages are still
installed so the moment a collector lands, no service-code change is needed.

**Auto-instrumentations enabled**: express, http, pg, fetch. Disabled: fs,
dns (too noisy).

**Resource attributes attached to every span**: `service.name`,
`service.version`, `litho.git_sha`, `litho.build_time`. So a slow-trace
investigation in Jaeger/Tempo can directly identify the build that produced
the trace, without round-tripping through `/version`.

## Running locally

```bash
# Start a collector (terminal 1)
docker run --rm -p 4318:4318 \
  -v $(pwd)/otel-collector-config.yaml:/etc/otelcol/config.yaml \
  otel/opentelemetry-collector:latest

# Run the api with tracing enabled (terminal 2)
cd Makalu/api
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
  GIT_SHA=local-dev \
  BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
  VERSION=local \
  pnpm dev

# Hit an endpoint (terminal 3)
curl -H "X-Request-Id: my-test" http://localhost:4000/api/blocks
```

The collector logs (terminal 1) will show the exported spans with the
matching `request_id` / `litho.git_sha` attributes.

For a fuller stack, see
[the OTel docs](https://opentelemetry.io/docs/collector/quick-start/) on
piping the collector to Jaeger or Tempo.

## SLO dashboard

Grafana panel "Lithosphere — SLO" (uid `lithosphere-slo`) at
`Makalu/infra/grafana/dashboards/slo.json` is the single-pane view for
"are we meeting our service objectives?".

Four stat panels at the top:

- **Availability (24h)** — `1 - 5xx/total` over a trailing day. Target ≥ 99.9%.
- **Error Rate (5xx, 5m)** — recent share of 5xx responses. Sustained > 1% is the regression signal.
- **Request Rate (RPS)** — total API throughput.
- **Indexer Chain Lag** — `litho_indexer_chain_lag_blocks`. Sustained > 100 blocks is the indexing alarm.

Two time-series panels:

- **Request Latency p50 / p95 / p99** — `histogram_quantile()` over `litho_api_http_request_duration_seconds_bucket`.
- **Requests by Status Class** — stacked 2xx/3xx/4xx/5xx rates so post-deploy regressions are visually obvious.

One table:

- **Build Info** — joins `litho_api_build_info` + `litho_indexer_build_info` so the operator can see which `git_sha` each service is running. If they diverge, it's a partial deploy.

The underlying metrics ship from `Makalu/api/src/lib/http-metrics.ts`. Routes are labeled by Express's normalized `req.route.path` (e.g. `/api/blocks/:height`), not the raw URL, so cardinality stays bounded.

## Cost dashboard

Grafana panel "Lithosphere — Cost" (uid `lithosphere-cost`) at
`Makalu/infra/grafana/dashboards/cost.json` gives operators a
single-pane view of "where is my VPS spend going?".

Top row — four stat panels for a 24h spend snapshot:

- **Monthly Budget** — operator-set via the `monthlyBudgetUsd` template
  variable (default $60 ≈ t3.large on-demand). Adjust via the Grafana UI
  or by editing the dashboard JSON.
- **Host CPU (5m)** — fraction of cores busy. Sustained > 80% means
  scale-up is worth pricing.
- **Host Memory (used)** — fraction of physical RAM. Sustained > 85%
  means swap is imminent.
- **Disk Free** — bytes available on `/`. The early-warning is yellow
  at 5 GB.

Middle rows — time series for the underlying drivers:

- **Network Egress (bytes/s)** — host network out; the dominant
  variable cost above the instance fee on EC2.
- **Per-Container CPU** — sum across containers reconciles to the
  Host CPU stat. Identifies which `litho-*` container drives the bill.
- **Per-Container Memory** — same idea for RAM.
- **API Egress per 1k Requests (24h)** — `bytes_out / api_requests * 1000`.
  Multiply by your provider's per-GB bandwidth price for a marginal
  cost-per-1k-requests figure useful for traffic-growth forecasting.

Bottom row — **Resource Footprint Summary** table, one row per container
with CPU cores / working-set memory / network out columns. The row
driving any of the host-level numbers above is your scale-down candidate
(or scale-up justification).

## Glossary

| Term | Where it lives | What it correlates |
|------|----------------|--------------------|
| `gitSha` | `/version`, `litho_*_build_info`, OCI labels, span attributes | Image → commit |
| `requestId` | api logs, response `X-Request-Id` header, outgoing `X-Request-Id` | Single HTTP request → all work it triggered |
| `cycleId` | indexer logs, indexer outgoing `X-Request-Id` | One polling iteration → all logs from it |
| `trace_id` | OpenTelemetry spans | Distributed work across services (requires collector) |

## Out of scope

- **Collector deployment.** SDK is wired, env-gated. Standing up a receiver
  (Jaeger / Tempo / Grafana Cloud) is a separate infra ticket — likely
  validator-team-coordinated since it runs alongside Prometheus / Loki on
  the VPS.
- **SLO / cost dashboards.** Analysis layers on top of metrics we already
  collect; deferred.
- **Migrating every `console.*` to `logger`.** Done for the high-traffic
  paths; the long tail is mechanical and incremental.
- **Explorer (Next.js) instrumentation.** Needs Next's `instrumentation.ts`
  pattern, not the Node SDK pattern. Server-side spans there are a separate
  body of work; client-side `/version` env propagation IS in place so the
  UI can display the deployed build.
