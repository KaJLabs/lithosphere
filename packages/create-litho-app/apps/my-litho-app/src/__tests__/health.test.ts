import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp, setReady, setDependencyStatus } from '../app.js';
import { loadConfig } from '../config.js';
import type { FastifyInstance } from 'fastify';

describe('Health Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'development';
    process.env.LOG_LEVEL = 'silent';

    // Load config
    loadConfig();

    // Build app
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('should return 200 with healthy status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.status).toBe('healthy');
      expect(body.timestamp).toBeDefined();
      expect(body.uptime).toBeGreaterThanOrEqual(0);
      expect(body.version).toBeDefined();
    });

    it('should return correct content-type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.headers['content-type']).toContain('application/json');
    });
  });

  describe('GET /ready', () => {
    it('should return 503 when not ready', async () => {
      setReady(false);

      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(503);

      const body = JSON.parse(response.payload);
      expect(body.status).toBe('not_ready');
    });

    it('should return 200 when ready', async () => {
      setReady(true);

      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.status).toBe('ready');
      expect(body.timestamp).toBeDefined();
      expect(body.checks).toBeDefined();
    });

    it('should return 503 when dependencies fail', async () => {
      setReady(true);
      setDependencyStatus('database', false);

      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(503);

      const body = JSON.parse(response.payload);
      expect(body.status).toBe('not_ready');
      expect(body.checks.database).toBe('fail');
    });

    it('should return 200 when all dependencies pass', async () => {
      setReady(true);
      setDependencyStatus('database', true);
      setDependencyStatus('cache', true);

      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.checks.database).toBe('pass');
      expect(body.checks.cache).toBe('pass');
    });
  });

  describe('GET /metrics', () => {
    it('should return Prometheus metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.payload).toContain('process_cpu_');
      expect(response.payload).toContain('http_requests_total');
    });
  });

  describe('GET /', () => {
    it('should return service info', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.payload);
      expect(body.service).toBeDefined();
      expect(body.version).toBeDefined();
      expect(body.environment).toBeDefined();
      expect(body.timestamp).toBeDefined();
    });
  });
});

describe('Configuration', () => {
  it('should load default configuration', () => {
    process.env.NODE_ENV = 'development';
    const config = loadConfig();

    expect(config.NODE_ENV).toBe('development');
    expect(config.PORT).toBe(3000);
    expect(config.HOST).toBe('0.0.0.0');
  });

  it('should use custom port from environment', () => {
    process.env.PORT = '4000';
    const config = loadConfig();

    expect(config.PORT).toBe(4000);

    // Reset
    delete process.env.PORT;
  });
});
