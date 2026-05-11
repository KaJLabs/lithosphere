/**
 * OpenTelemetry tracing bootstrap for the indexer.
 *
 * Mirrors `Makalu/api/src/tracing.ts` — env-gated on
 * `OTEL_EXPORTER_OTLP_ENDPOINT`. Indexer surface is smaller (HTTP + pg only),
 * but we use the same auto-instrumentations pack so a single env var enables
 * tracing across both services.
 */

import { readBuildInfo } from './lib/build-info.js';

let started = false;

export function startTracing(): { enabled: boolean; reason?: string } {
  if (started) return { enabled: true, reason: 'already_started' };

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    return { enabled: false, reason: 'no_endpoint' };
  }

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
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'lithosphere-indexer',
      [ATTR_SERVICE_VERSION]: build.version,
      'litho.git_sha': build.gitSha,
      'litho.build_time': build.buildTime,
    }),
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
    ],
  });

  sdk.start();
  started = true;

  const shutdown = async () => {
    try {
      await sdk.shutdown();
    } catch {
      // best-effort
    }
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return { enabled: true };
}

const result = startTracing();
if (result.enabled && result.reason !== 'already_started') {
  // eslint-disable-next-line no-console
  console.log(`[tracing] OpenTelemetry SDK started, exporting to ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}`);
}
