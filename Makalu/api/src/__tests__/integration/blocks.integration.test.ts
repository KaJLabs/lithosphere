/**
 * Integration test: GET /api/blocks against a real Postgres.
 *
 * Skipped unless INTEGRATION_TESTS=1. Bring up the DB with:
 *   docker compose -f Makalu/docker-compose.test.yml up -d postgres
 *
 * Then run from Makalu/api:
 *   INTEGRATION_TESTS=1 \
 *     DATABASE_URL=postgres://litho:litho@localhost:5433/litho_test \
 *     pnpm test src/__tests__/integration
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import pkg from 'pg';

const { Pool } = pkg;
const RUN = process.env.INTEGRATION_TESTS === '1';

// Use describe.skipIf so the test file always compiles but bails out cleanly
// when the integration env isn't set up.
describe.skipIf(!RUN)('integration: GET /api/blocks against Postgres', () => {
  let pool: InstanceType<typeof Pool>;
  let app: Express;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required for integration tests');
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    // Minimal schema — enough for the /blocks endpoint. Production schema lives
    // in the indexer migrations; this is a cut-down version sufficient for
    // exercising the API layer end-to-end.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS blocks (
        height       BIGINT PRIMARY KEY,
        hash         TEXT NOT NULL,
        proposer_address TEXT,
        num_txs      INTEGER NOT NULL DEFAULT 0,
        total_gas    TEXT NOT NULL DEFAULT '0',
        block_time   TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);

    // Lazy-import routes so it picks up DATABASE_URL from the env above.
    const { explorerRouter } = await import('../../routes.js');
    app = express();
    app.use('/api', explorerRouter());
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE blocks');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('returns rows ordered by height DESC and shaped by mapBlock', async () => {
    await pool.query(`
      INSERT INTO blocks (height, hash, proposer_address, num_txs, total_gas, block_time)
      VALUES
        (100, '0xabc', '0xprop', 3, '21000', '2026-05-11T12:00:00Z'),
        (99,  '0xdef', '0xprop', 0, '0',     '2026-05-11T11:59:30Z')
    `);

    const res = await request(app).get('/api/blocks?limit=10');

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
  });

  it('returns an empty array when no blocks are indexed', async () => {
    const res = await request(app).get('/api/blocks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
