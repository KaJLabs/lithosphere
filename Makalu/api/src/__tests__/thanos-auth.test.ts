import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { Wallet } from 'ethers';

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

function siweMessage(address: string, nonce: string, chainId = 700777): string {
  return [
    'makalu.litho.ai wants you to sign in with your Ethereum account:',
    address,
    '',
    'Sign in to Lithosphere Makalu Explorer with your Thanos Wallet.',
    '',
    'URI: https://makalu.litho.ai',
    'Version: 1',
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    'Issued At: 2026-07-22T00:00:00.000Z',
  ].join('\n');
}

beforeEach(() => {
  process.env.AUTH_SESSION_SECRET = 'test-only-stable-thanos-session-secret';
});

describe('Thanos SIWE API', () => {
  it('issues a one-time nonce, verifies the signer, and validates the session', async () => {
    const app = makeApp();
    const wallet = Wallet.createRandom();
    const nonce = await request(app).get(`/api/auth/nonce?address=${wallet.address}`);
    expect(nonce.status).toBe(200);
    expect(nonce.text).toMatch(/^[0-9a-f]{32}$/);

    const message = siweMessage(wallet.address, nonce.text);
    const signature = await wallet.signMessage(message);
    const verified = await request(app)
      .post('/api/auth/verify')
      .send({ message, signature, address: wallet.address });
    expect(verified.status).toBe(200);
    expect(verified.body).toMatchObject({ ok: true, address: wallet.address });
    expect(verified.body.sessionToken).toMatch(/^[^.]+\.[^.]+$/);

    const identity = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${verified.body.sessionToken}`);
    expect(identity.status).toBe(200);
    expect(identity.body).toMatchObject({ ok: true, address: wallet.address, chainId: 700777 });

    const replay = await request(app)
      .post('/api/auth/verify')
      .send({ message, signature, address: wallet.address });
    expect(replay.status).toBe(401);
    expect(replay.body.error).toContain('nonce');
  });

  it('rejects signatures from another wallet and unexpected chains', async () => {
    const app = makeApp();
    const wallet = Wallet.createRandom();
    const attacker = Wallet.createRandom();
    const nonce = (await request(app).get(`/api/auth/nonce?address=${wallet.address}`)).text;
    const message = siweMessage(wallet.address, nonce);
    const wrongSignature = await attacker.signMessage(message);
    const wrongSigner = await request(app)
      .post('/api/auth/verify')
      .send({ message, signature: wrongSignature, address: wallet.address });
    expect(wrongSigner.status).toBe(401);

    const nonce2 = (await request(app).get(`/api/auth/nonce?address=${wallet.address}`)).text;
    const wrongChainMessage = siweMessage(wallet.address, nonce2, 1);
    const wrongChain = await request(app)
      .post('/api/auth/verify')
      .send({
        message: wrongChainMessage,
        signature: await wallet.signMessage(wrongChainMessage),
        address: wallet.address,
      });
    expect(wrongChain.status).toBe(400);
    expect(wrongChain.body.error).toContain('chain id');
  });

  it('rejects missing, forged, and malformed bearer tokens', async () => {
    const app = makeApp();
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', 'Bearer bad.token')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', 'Basic abc')).status).toBe(401);
  });

  it('accepts chain 9005 when the API is configured for mainnet', async () => {
    process.env.AUTH_ALLOWED_CHAIN_ID = '9005';
    try {
      const app = makeApp();
      const wallet = Wallet.createRandom();
      const nonce = (await request(app).get(`/api/auth/nonce?address=${wallet.address}`)).text;
      const message = siweMessage(wallet.address, nonce, 9005);
      const verified = await request(app)
        .post('/api/auth/verify')
        .send({ message, signature: await wallet.signMessage(message), address: wallet.address });

      expect(verified.status).toBe(200);
      const identity = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${verified.body.sessionToken}`);
      expect(identity.body).toMatchObject({ ok: true, chainId: 9005 });
    } finally {
      delete process.env.AUTH_ALLOWED_CHAIN_ID;
    }
  });
});
