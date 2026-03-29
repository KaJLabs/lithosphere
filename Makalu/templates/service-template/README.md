# @lithosphere/service-template

Production-grade Node.js/TypeScript microservice template for the Lithosphere blockchain ecosystem.

## Features

- **Fastify** HTTP framework with Pino structured logging
- **Health & readiness** endpoints for container orchestration
- **Prometheus metrics** via `prom-client` (HTTP latency, active connections, business ops)
- **OpenTelemetry** distributed tracing with auto-instrumentation
- **Zod** config validation at startup
- **Docker** multi-stage build with non-root user
- **Vitest** test runner with coverage

## Getting Started

```bash
# Install dependencies
pnpm install

# Run in development (hot reload)
pnpm dev

# Run tests
pnpm test

# Build
pnpm build

# Start production
pnpm start

# Docker
pnpm docker:build
pnpm docker:run
```

## Endpoints

| Path | Method | Description |
|------|--------|-------------|
| `/` | GET | Service info (name, version, environment) |
| `/health` | GET | Liveness probe (always 200 if running) |
| `/ready` | GET | Readiness probe (200 when ready, 503 otherwise) |
| `/metrics` | GET | Prometheus metrics |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment (`development`, `staging`, `production`) |
| `PORT` | `3000` | HTTP server port |
| `HOST` | `0.0.0.0` | Bind address |
| `LOG_LEVEL` | `info` | Pino log level |
| `LOG_PRETTY` | `false` | Pretty-print logs in dev |
| `METRICS_ENABLED` | `true` | Enable `/metrics` endpoint |
| `SERVICE_NAME` | `lithosphere-service` | Service identifier for metrics/tracing |
| `SERVICE_VERSION` | `0.1.0` | Reported in health checks and traces |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | _(disabled)_ | OTLP collector URL (e.g. `http://localhost:4318`) |
| `DATABASE_URL` | _(optional)_ | PostgreSQL connection string |
| `RPC_URL` | _(optional)_ | Blockchain RPC endpoint |
| `SHUTDOWN_TIMEOUT_MS` | `30000` | Graceful shutdown timeout |

## Project Structure

```
src/
  server.ts    # Entry point (imports tracing, starts Fastify)
  tracing.ts   # OpenTelemetry SDK init (must be first import)
  app.ts       # Fastify app builder, routes, plugins
  config.ts    # Zod-validated environment config
  metrics.ts   # Prometheus metrics registry and helpers
```
