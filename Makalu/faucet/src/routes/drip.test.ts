import assert from 'node:assert/strict';
import test from 'node:test';

import Fastify from 'fastify';

import { getAssetAvailability } from '../services/availability.js';
import { dripRoutes, type DripRouteDependencies } from './drip.js';

const recipient = '0x2222222222222222222222222222222222222222';

function dependencies(
  overrides: Partial<DripRouteDependencies> = {},
): DripRouteDependencies {
  return {
    getAssetBalance: async () => '100',
    getAssetAvailability,
    checkCooldown: async () => ({ allowed: true, retryAfterSeconds: 0 }),
    setCooldown: async () => undefined,
    drip: async (_address, asset, amount) => ({
      txHash: '0xabc',
      amount: amount ?? asset.defaultAmount,
      symbol: asset.symbol,
      assetId: asset.id,
    }),
    ...overrides,
  };
}

async function makeApp(overrides: Partial<DripRouteDependencies> = {}) {
  const app = Fastify();
  await dripRoutes(app, { dependencies: dependencies(overrides) });
  return app;
}

test('balance-read failure rejects the claim before cooldown or transfer', async () => {
  let cooldownChecked = false;
  let transferAttempted = false;
  const app = await makeApp({
    getAssetBalance: async () => {
      throw new Error('RPC unavailable');
    },
    checkCooldown: async () => {
      cooldownChecked = true;
      return { allowed: true, retryAfterSeconds: 0 };
    },
    drip: async (_address, asset, amount) => {
      transferAttempted = true;
      return {
        txHash: '0xabc',
        amount: amount ?? asset.defaultAmount,
        symbol: asset.symbol,
        assetId: asset.id,
      };
    },
  });

  const response = await app.inject({
    method: 'POST',
    url: '/drip',
    payload: { address: recipient, assetId: 'litho', amount: '1' },
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().available, false);
  assert.equal(cooldownChecked, false);
  assert.equal(transferAttempted, false);
  await app.close();
});

test('funded asset completes the transfer and records cooldown', async () => {
  let cooldownAsset: string | null = null;
  const app = await makeApp({
    setCooldown: async (_address, assetId) => {
      cooldownAsset = assetId ?? null;
    },
  });

  const response = await app.inject({
    method: 'POST',
    url: '/drip',
    payload: { address: recipient, assetId: 'litho', amount: '1' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    success: true,
    txHash: '0xabc',
    amount: '1 LITHO',
    recipient,
    cooldownHours: 24,
    assetId: 'litho',
    symbol: 'LITHO',
  });
  assert.equal(cooldownAsset, 'litho');
  await app.close();
});
