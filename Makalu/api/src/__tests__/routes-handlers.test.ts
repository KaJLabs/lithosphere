import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';

vi.mock('../db.js', () => ({
  query: vi.fn(),
  getPool: vi.fn(),
}));

const { query } = await import('../db.js');
const { explorerRouter } = await import('../routes.js');

const mockQuery = vi.mocked(query);

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api', explorerRouter());
  return app;
}

beforeEach(() => {
  mockQuery.mockReset();
});

describe('GET /api/config', () => {
  it('returns LITHO token config (no DB call)', async () => {
    const res = await request(makeApp()).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      token: { symbol: 'LITHO', decimals: 18 },
      fiat: { symbol: 'USD', price: null, fetchedAt: null },
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe('GET /api/blocks', () => {
  it('returns mapped blocks with default pagination', async () => {
    mockQuery.mockResolvedValueOnce([
      {
        height: 100,
        hash: '0xabc',
        block_time: new Date('2026-05-11T12:00:00Z'),
        num_txs: 3,
        total_gas: '21000',
      },
      {
        height: 99,
        hash: '0xdef',
        block_time: new Date('2026-05-11T11:59:30Z'),
        num_txs: 0,
        total_gas: '0',
      },
    ]);

    const res = await request(makeApp()).get('/api/blocks');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        height: 100,
        hash: '0xabc',
        timestamp: '2026-05-11T12:00:00.000Z',
        txCount: 3,
        gasUsed: '21000',
      },
      {
        height: 99,
        hash: '0xdef',
        timestamp: '2026-05-11T11:59:30.000Z',
        txCount: 0,
        gasUsed: '0',
      },
    ]);
    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT * FROM blocks ORDER BY height DESC LIMIT $1 OFFSET $2',
      [20, 0],
    );
  });

  it('honours an explicit limit query param', async () => {
    mockQuery.mockResolvedValueOnce([]);
    await request(makeApp()).get('/api/blocks?limit=5');
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [5, 0]);
  });

  it('caps the limit at MAX_LIMIT (100) regardless of input', async () => {
    mockQuery.mockResolvedValueOnce([]);
    await request(makeApp()).get('/api/blocks?limit=9999');
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [100, 0]);
  });

  it('applies a 1-indexed page query param when offset is absent', async () => {
    mockQuery.mockResolvedValueOnce([]);
    await request(makeApp()).get('/api/blocks?limit=10&page=3');
    // page=3, limit=10 → offset = (3 - 1) * 10 = 20
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [10, 20]);
  });

  it('returns 500 when the DB throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('connection refused'));
    const res = await request(makeApp()).get('/api/blocks');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });
});

describe('GET /api/blocks/:height', () => {
  it('returns 404 when the block does not exist', async () => {
    mockQuery.mockResolvedValueOnce([]); // SELECT * FROM blocks WHERE height = $1
    const res = await request(makeApp()).get('/api/blocks/999');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Block not found' });
  });
});

describe('GET /api/validators', () => {
  it('returns mapped validators with formatted voting power and commission', async () => {
    mockQuery.mockResolvedValueOnce([
      {
        operator_address: 'lithovaloper1abc',
        moniker: 'Node-A',
        // 5000 LITHO expressed in ulitho (18 decimals)
        tokens: '5000000000000000000000',
        commission_rate: '0.100000000000000000',
        status: 3, // Bonded
      },
      {
        operator_address: 'lithovaloper1def',
        moniker: null,
        tokens: '1500000000000000000000',
        commission_rate: '0.075000000000000000',
        status: 2, // Unbonding
      },
    ]);

    const res = await request(makeApp()).get('/api/validators');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        address: 'lithovaloper1abc',
        moniker: 'Node-A',
        votingPower: '5,000',
        commission: '10%',
        status: 'Bonded',
      },
      {
        address: 'lithovaloper1def',
        moniker: 'lithovaloper1def...', // null moniker falls back to address prefix
        votingPower: '1,500',
        commission: '7.5%',
        status: 'Unbonding',
      },
    ]);
  });

  it('returns 500 on DB failure', async () => {
    mockQuery.mockRejectedValueOnce(new Error('boom'));
    const res = await request(makeApp()).get('/api/validators');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });
});

describe('GET /api/faucet/info', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns the upstream payload merged with ok:true when faucet is healthy', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ remaining: 5, cooldown: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as typeof fetch;

    const res = await request(makeApp()).get('/api/faucet/info');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, remaining: 5, cooldown: 3600 });
  });

  it('returns the upstream status with sanitized message on non-200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Rate limit exceeded' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as typeof fetch;

    const res = await request(makeApp()).get('/api/faucet/info');

    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      ok: false,
      message: 'Rate limit exceeded',
    });
  });

  it('returns 502 when the upstream fetch throws', async () => {
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED')) as typeof fetch;

    const res = await request(makeApp()).get('/api/faucet/info');

    expect(res.status).toBe(502);
    expect(res.body).toEqual({
      ok: false,
      message: 'Faucet service is unavailable. Please try again later.',
    });
  });
});
