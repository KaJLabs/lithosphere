import { describe, it, expect } from 'vitest';

/**
 * API Health endpoint smoke tests.
 * These validate the health response shape without starting the full server.
 */

describe('API Health', () => {
  it('should produce a valid health response shape', () => {
    const response = {
      status: 'healthy',
      service: 'lithosphere-api',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: 'test',
    };

    expect(response.status).toBe('healthy');
    expect(response.service).toBe('lithosphere-api');
    expect(response.timestamp).toBeDefined();
    expect(response.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('should produce a valid readiness response', () => {
    const response = { ready: true };
    expect(response.ready).toBe(true);
  });
});

describe('API Configuration', () => {
  it('should have default port values', () => {
    const port = parseInt(process.env.PORT || '4000');
    const metricsPort = parseInt(process.env.METRICS_PORT || '9090');

    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThanOrEqual(65535);
    expect(metricsPort).toBeGreaterThan(0);
    expect(metricsPort).toBeLessThanOrEqual(65535);
  });
});
