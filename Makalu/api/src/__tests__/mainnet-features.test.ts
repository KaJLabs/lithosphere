import express, { type Express } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db.js', () => ({
  query: vi.fn(),
  slowQuery: vi.fn(),
  getPool: vi.fn(),
}));

const { explorerRouter } = await import('../routes.js');

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api', explorerRouter());
  return app;
}

afterEach(() => {
  delete process.env.FAUCET_ENABLED;
  delete process.env.BRIDGE_ENABLED;
  delete process.env.MULTX_ENABLED;
  delete process.env.SWAP_ENABLED;
  delete process.env.SWAP_ROUTER_ADDRESS;
  delete process.env.LITHO_CHAIN_ID;
  delete process.env.COSMOS_CHAIN_ID;
});

describe('mainnet launch feature gates', () => {
  it('reports chain 9005 and fails closed for value-moving integrations', async () => {
    process.env.LITHO_CHAIN_ID = '9005';
    process.env.COSMOS_CHAIN_ID = 'lithosphere_9005-1';
    process.env.FAUCET_ENABLED = 'false';
    process.env.BRIDGE_ENABLED = 'false';
    process.env.MULTX_ENABLED = 'false';
    process.env.SWAP_ENABLED = 'false';
    process.env.SWAP_ROUTER_ADDRESS = '';

    const app = makeApp();
    const config = await request(app).get('/api/config');
    expect(config.status).toBe(200);
    expect(config.body).toMatchObject({
      network: { evmChainId: 9005, cosmosChainId: 'lithosphere_9005-1' },
      features: { faucet: false, bridge: false, swap: false },
    });

    expect((await request(app).get('/api/faucet/info')).status).toBe(404);
    expect((await request(app).get('/api/bridge/config')).status).toBe(404);
  });
});
