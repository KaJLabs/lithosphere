/**
 * Next.js instrumentation hook — bootstraps OpenTelemetry on server startup.
 *
 * Picked up automatically by Next.js when:
 *   - This file sits next to `next.config.js` (the project root), AND
 *   - `experimental.instrumentationHook: true` is set in next.config.js
 *     (stable in Next 15; flag-gated in Next 14, which we're on).
 *
 * Same env-gated pattern as `Makalu/api/src/tracing.ts`:
 *   - If `OTEL_EXPORTER_OTLP_ENDPOINT` is unset, this is a no-op. The OTel
 *     SDK (~80 transitive deps) is dynamically imported only when tracing
 *     is enabled, so production today pays zero runtime cost.
 *   - The moment a collector is reachable, set the env var and traces start
 *     flowing on the next deploy.
 *
 * Why `register()` and not a side-effect import: Next.js's contract for
 * instrumentation. The hook is invoked exactly once per process, before any
 * request handlers are loaded, which is the only moment we can patch
 * `http`/`undici`/`pg` modules so auto-instrumentation has something to
 * wrap. Same constraint as the api's side-effect import at the top of
 * `src/index.ts`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    // Edge runtime — OTel NodeSDK can't run there. Skip silently; the same
    // request will be traced once the server-side handler picks it up.
    return;
  }

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    return;
  }

  const { NodeSDK } = await import('@opentelemetry/sdk-node');
  const { getNodeAutoInstrumentations } = await import(
    '@opentelemetry/auto-instrumentations-node'
  );
  const { OTLPTraceExporter } = await import(
    '@opentelemetry/exporter-trace-otlp-http'
  );
  const { resourceFromAttributes } = await import('@opentelemetry/resources');
  const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = await import(
    '@opentelemetry/semantic-conventions'
  );
  const { readBuildInfo } = await import('./lib/build-info');

  const build = readBuildInfo();
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'lithosphere-explorer',
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

  const shutdown = async () => {
    try {
      await sdk.shutdown();
    } catch {
      // best-effort; nothing actionable on shutdown failure
    }
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // eslint-disable-next-line no-console
  console.log(`[tracing] OpenTelemetry SDK started, exporting to ${endpoint}`);
}
