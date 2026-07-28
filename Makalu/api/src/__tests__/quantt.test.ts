import { afterEach, describe, expect, it, vi } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';

vi.mock('../db.js', () => ({
  query: vi.fn(),
  slowQuery: vi.fn(),
  getPool: vi.fn(),
}));

const { explorerRouter } = await import('../routes.js');
const { loadQuanttConfig } = await import('../quantt.js');

const QUANTT_ENV_KEYS = [
  'QUANTT_API_BASE_URL',
  'QUANTT_API_KEY',
  'QUANTT_API_AUTH_HEADER',
  'QUANTT_INSIGHTS_PATH',
  'QUANTT_API_TIMEOUT_MS',
] as const;

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api', explorerRouter());
  return app;
}

afterEach(() => {
  for (const key of QUANTT_ENV_KEYS) delete process.env[key];
  vi.unstubAllGlobals();
});

describe('Quantt integration', () => {
  it('stays unavailable until an approved endpoint and key are configured', async () => {
    const app = makeApp();
    const status = await request(app).get('/api/quantt/status').expect(200);
    expect(status.body).toMatchObject({ configured: false, apiOrigin: null });

    const insights = await request(app).get('/api/quantt/insights?symbol=LITHO').expect(503);
    expect(insights.body.message).toContain('not configured');
  });

  it('rejects non-Quantt, non-HTTPS, and malformed upstream configuration', () => {
    expect(loadQuanttConfig({ QUANTT_API_BASE_URL: 'http://dev.quantt.at', QUANTT_API_KEY: 'key' })).toBeNull();
    expect(loadQuanttConfig({ QUANTT_API_BASE_URL: 'https://quantt.at.evil.example', QUANTT_API_KEY: 'key' })).toBeNull();
    expect(loadQuanttConfig({ QUANTT_API_BASE_URL: 'https://dev.quantt.at', QUANTT_API_KEY: 'key', QUANTT_INSIGHTS_PATH: '//evil.example' })).toBeNull();
  });

  it('proxies an insight without exposing credentials', async () => {
    process.env.QUANTT_API_BASE_URL = 'https://api.quantt.at/root/';
    process.env.QUANTT_API_KEY = 'server-secret';
    process.env.QUANTT_API_AUTH_HEADER = 'x-api-key';
    process.env.QUANTT_INSIGHTS_PATH = '/v1/market/insights';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ signal: 'bullish', score: 0.82 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await request(makeApp()).get('/api/quantt/insights?symbol=litho').expect(200);
    expect(response.body).toEqual({
      ok: true,
      provider: 'quantt',
      symbol: 'LITHO',
      data: { signal: 'bullish', score: 0.82 },
    });
    expect(JSON.stringify(response.body)).not.toContain('server-secret');

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://api.quantt.at/v1/market/insights?symbol=LITHO');
    expect(init.headers).toMatchObject({ 'X-API-Key': 'server-secret' });
  });

  it('validates asset symbols before calling Quantt', async () => {
    process.env.QUANTT_API_BASE_URL = 'https://api.quantt.at';
    process.env.QUANTT_API_KEY = 'server-secret';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await request(makeApp()).get('/api/quantt/insights?symbol=../../admin').expect(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
