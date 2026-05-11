/**
 * OpenTelemetry tracing bootstrap.
 *
 * Env-gated: spans are emitted only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set
 * (e.g. `http://localhost:4318` or a deployed collector). When unset, this
 * module is a no-op — zero runtime cost in production today, while keeping
 * the wiring in place so the moment a collector lands, traces start flowing.
 *
 * Imported as a side-effect from the top of `src/index.ts` so the SDK can
 * patch `express`, `http`, `pg`, and `fetch` BEFORE those modules are loaded
 * by the rest of the app. If the import is moved, auto-instrumentation will
 * silently produce empty traces.
 */

import { readBuildInfo } from './lib/build-info.js';

let started = false;

export function startTracing(): { enabled: boolean; reason?: string } {
  if (started) return { enabled: true, reason: 'already_started' };

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    return { enabled: false, reason: 'no_endpoint' };
  }

  // Lazy-require — defers loading the OTel SDK (heavy: ~80 deps) until we know
  // tracing is enabled. Makes test-time import of this module a no-op.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { NodeSDK } = require('@opentelemetry/sdk-node');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { resourceFromAttributes } = require('@opentelemetry/resources');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {
    ATTR_SERVICE_NAME,
    ATTR_SERVICE_VERSION,
  } = require('@opentelemetry/semantic-conventions');

  const build = readBuildInfo();
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'lithosphere-api',
      [ATTR_SERVICE_VERSION]: build.version,
      'litho.git_sha': build.gitSha,
      'litho.build_time': build.buildTime,
    }),
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable noisy default instrumentations
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
    ],
  });

  sdk.start();
  started = true;

  // Graceful shutdown — flush remaining spans before the process exits.
  const shutdown = async () => {
    try {
      await sdk.shutdown();
    } catch {
      // best-effort; nothing actionable on shutdown failure
    }
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return { enabled: true };
}

// Auto-start on import (side-effect import from index.ts).
const result = startTracing();
if (result.enabled && result.reason !== 'already_started') {
  // eslint-disable-next-line no-console
  console.log(`[tracing] OpenTelemetry SDK started, exporting to ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}`);
}
