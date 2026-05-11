import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { startTracing } from '../tracing.js';

describe('startTracing', () => {
  const originalEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  beforeEach(() => {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  });

  afterEach(() => {
    if (originalEndpoint === undefined) {
      delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    } else {
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = originalEndpoint;
    }
  });

  it('no-ops when OTEL_EXPORTER_OTLP_ENDPOINT is unset', () => {
    const result = startTracing();
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe('no_endpoint');
  });

  it('is idempotent — repeated calls do not throw or reinitialize', () => {
    const a = startTracing();
    const b = startTracing();
    expect(a.enabled).toBe(false);
    expect(b.enabled).toBe(false);
  });
});
