import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/browser', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn()
}));

import * as Sentry from '@sentry/browser';
import {
  initErrorTracking,
  resetErrorTrackingForTests,
  resolveErrorTrackingConfig
} from '../../services/errorTracking';

describe('errorTracking', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    resetErrorTrackingForTests();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetErrorTrackingForTests();
  });

  it('flags missing production Sentry configuration with explicit warnings', () => {
    const config = resolveErrorTrackingConfig({
      MODE: 'production',
      VITE_APP_ENV: 'production',
      VITE_EXPLORER_URL: 'https://kamet.litho.ai',
      VITE_SENTRY_DSN: '',
      VITE_APP_VERSION: ''
    });

    expect(config.enabled).toBe(false);
    expect(config.warnings).toContain('VITE_SENTRY_DSN is not configured.');
    expect(config.warnings).toContain('VITE_APP_VERSION or VITE_SENTRY_RELEASE is not configured.');
    expect(config.allowedHosts).toContain('kamet.litho.ai');
  });

  it('initializes Sentry with an allowlist and sample-rate configuration when a valid DSN is provided', () => {
    const config = resolveErrorTrackingConfig({
      MODE: 'production',
      VITE_APP_ENV: 'production',
      VITE_EXPLORER_URL: 'https://kamet.litho.ai',
      VITE_SENTRY_ALLOWED_HOSTS: 'kamet.litho.ai,status.litho.ai',
      VITE_SENTRY_DSN: 'https://abc123@example.ingest.sentry.io/123456',
      VITE_APP_VERSION: '1.2.3',
      VITE_SENTRY_TRACES_SAMPLE_RATE: '0.25'
    });

    expect(config.enabled).toBe(true);
    expect(config.tracesSampleRate).toBe(0.25);

    initErrorTracking(config, Sentry);

    expect(Sentry.init).toHaveBeenCalledTimes(1);
    const initArgs = Sentry.init.mock.calls[0][0];
    expect(initArgs.environment).toBe('production');
    expect(initArgs.release).toBe('1.2.3');
    expect(initArgs.allowUrls.length).toBeGreaterThanOrEqual(2);
    expect(initArgs.allowUrls.some((pattern) => pattern.test('https://kamet.litho.ai/blocks'))).toBe(
      true
    );
    expect(initArgs.allowUrls.some((pattern) => pattern.test('https://status.litho.ai/api/metrics'))).toBe(
      true
    );
    expect(initArgs.beforeSend({}, { originalException: new Error('Script error.') })).toBeNull();
  });

  it('does not initialize Sentry when the configured DSN is invalid', () => {
    const config = resolveErrorTrackingConfig({
      MODE: 'production',
      VITE_APP_ENV: 'production',
      VITE_EXPLORER_URL: 'https://kamet.litho.ai',
      VITE_SENTRY_DSN: 'not-a-dsn',
      VITE_APP_VERSION: '1.2.3'
    });

    expect(config.enabled).toBe(false);
    expect(config.warnings).toContain('VITE_SENTRY_DSN is invalid and Sentry will remain disabled.');

    initErrorTracking(config, Sentry);

    expect(Sentry.init).not.toHaveBeenCalled();
  });
});
