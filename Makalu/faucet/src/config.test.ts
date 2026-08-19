import assert from 'node:assert/strict';
import test from 'node:test';

import { parseTokenAssets, validateStrictRuntimeConfig } from './config.js';

const requiredAssets = [
  'wlitho',
  'litbtc',
  'lax',
  'jot',
  'colle',
  'image',
  'agii',
  'bldr',
  'fgpt',
  'musa',
].map((id, index) => ({
  id,
  name: id.toUpperCase(),
  symbol: id.toUpperCase(),
  contractAddress: `0x${(index + 1).toString(16).padStart(40, '0')}`,
}));

const validEnvironment: NodeJS.ProcessEnv = {
  FAUCET_CHAIN_ID: '700777',
  FAUCET_RPC_URL: 'https://rpc.litho.ai',
  FAUCET_PRIVATE_KEY: `0x${'11'.repeat(32)}`,
};

test('strict token parsing rejects malformed or duplicate assets', () => {
  assert.throws(
    () => parseTokenAssets(JSON.stringify([...requiredAssets, requiredAssets[0]]), true),
    /invalid or duplicate asset/,
  );
});

test('strict runtime validation accepts the complete Makalu asset set', () => {
  const assets = parseTokenAssets(JSON.stringify(requiredAssets), true);
  assert.doesNotThrow(() => validateStrictRuntimeConfig(validEnvironment, assets));
});

test('strict runtime validation rejects a missing required Makalu asset', () => {
  const assets = parseTokenAssets(JSON.stringify(requiredAssets.slice(0, -1)), true);
  assert.throws(
    () => validateStrictRuntimeConfig(validEnvironment, assets),
    /missing required Makalu assets: musa/,
  );
});

test('strict runtime validation rejects non-Makalu chain identity', () => {
  const assets = parseTokenAssets(JSON.stringify(requiredAssets), true);
  assert.throws(
    () => validateStrictRuntimeConfig({ ...validEnvironment, FAUCET_CHAIN_ID: '9005' }, assets),
    /must be 700777/,
  );
});

test('strict runtime validation rejects plaintext RPC and malformed keys', () => {
  const assets = parseTokenAssets(JSON.stringify(requiredAssets), true);
  assert.throws(
    () => validateStrictRuntimeConfig({ ...validEnvironment, FAUCET_RPC_URL: 'http://rpc.litho.ai' }, assets),
    /must use HTTPS/,
  );
  assert.throws(
    () => validateStrictRuntimeConfig({ ...validEnvironment, FAUCET_PRIVATE_KEY: 'not-a-key' }, assets),
    /32-byte hexadecimal/,
  );
  assert.throws(
    () => validateStrictRuntimeConfig({ ...validEnvironment, FAUCET_PRIVATE_KEY: `0x${'00'.repeat(32)}` }, assets),
    /not a valid secp256k1 private key/,
  );
});

test('zero-valued claim amounts are rejected instead of becoming defaults', () => {
  const [asset] = parseTokenAssets(JSON.stringify([{
    ...requiredAssets[0],
    allowedAmounts: ['0', '10'],
    defaultAmount: '0',
  }]));

  assert.deepEqual(asset.allowedAmounts, ['10']);
  assert.equal(asset.defaultAmount, '10');
});
